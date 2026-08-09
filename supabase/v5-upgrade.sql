-- ============================================================
-- V5 — MẪU HỢP ĐỒNG DÙNG NHIỀU LẦN + LOGO 2 BÊN + SNAPSHOT
-- ============================================================
alter table public.merger_applications add column if not exists agreement_snapshot jsonb not null default '{}'::jsonb;
alter table public.merger_applications add column if not exists confirmed_at timestamptz;

-- Bucket public chỉ dùng cho logo/mẫu giao diện. Upload/xóa chỉ Admin.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('merger-assets','merger-assets',true,3145728,array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "merger_assets_admin_insert" on storage.objects;
drop policy if exists "merger_assets_admin_update" on storage.objects;
drop policy if exists "merger_assets_admin_delete" on storage.objects;

create policy "merger_assets_admin_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'merger-assets'
  and exists(select 1 from public.admins a where a.user_id = auth.uid())
);

create policy "merger_assets_admin_update"
on storage.objects for update to authenticated
using (
  bucket_id = 'merger-assets'
  and exists(select 1 from public.admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'merger-assets'
  and exists(select 1 from public.admins a where a.user_id = auth.uid())
);

create policy "merger_assets_admin_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'merger-assets'
  and exists(select 1 from public.admins a where a.user_id = auth.uid())
);

-- RPC V5: người đại diện xác nhận một lần, hồ sơ hoàn tất ngay.
create or replace function public.submit_merger_application_v2(
  p_legion_name text,
  p_current_leader_name text,
  p_current_leader_uid text,
  p_member_count integer,
  p_representative_name text,
  p_email text,
  p_confirm_structure boolean,
  p_confirm_long_term boolean,
  p_confirm_discipline boolean,
  p_confirm_rights boolean,
  p_confirm_final boolean,
  p_snapshot jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if length(trim(coalesce(p_legion_name,''))) < 2 then raise exception 'Tên Quân Đoàn không hợp lệ'; end if;
  if length(trim(coalesce(p_current_leader_name,''))) < 1 then raise exception 'Thiếu tên Chủ Quân Đoàn'; end if;
  if length(trim(coalesce(p_current_leader_uid,''))) < 3 then raise exception 'UID Chủ Quân Đoàn không hợp lệ'; end if;
  if p_member_count is null or p_member_count < 1 or p_member_count > 500 then raise exception 'Số thành viên không hợp lệ'; end if;
  if length(trim(coalesce(p_representative_name,''))) < 1 then raise exception 'Thiếu người đại diện'; end if;
  if not coalesce(p_confirm_structure,false)
     or not coalesce(p_confirm_long_term,false)
     or not coalesce(p_confirm_discipline,false)
     or not coalesce(p_confirm_rights,false)
     or not coalesce(p_confirm_final,false) then
    raise exception 'Chưa xác nhận đầy đủ điều khoản';
  end if;
  if p_snapshot is null or jsonb_typeof(p_snapshot) <> 'object' then raise exception 'Thiếu nội dung thỏa thuận'; end if;
  if octet_length(p_snapshot::text) > 150000 then raise exception 'Nội dung thỏa thuận quá lớn'; end if;

  v_code := public.next_merger_agreement_code();
  insert into public.merger_applications (
    agreement_code, legion_name, current_leader_name, current_leader_uid,
    member_count, representative_name, email,
    management_confirmed, long_term_confirmed, discipline_confirmed,
    rights_confirmed, final_confirmed, status, agreement_snapshot, confirmed_at
  ) values (
    v_code, trim(p_legion_name), trim(p_current_leader_name), trim(p_current_leader_uid),
    p_member_count, trim(p_representative_name), nullif(trim(coalesce(p_email,'')),''),
    true, true, true, true, true, 'approved', p_snapshot, now()
  );
  return v_code;
end;
$$;

revoke all on function public.submit_merger_application_v2(text,text,text,integer,text,text,boolean,boolean,boolean,boolean,boolean,jsonb) from public;
grant execute on function public.submit_merger_application_v2(text,text,text,integer,text,text,boolean,boolean,boolean,boolean,boolean,jsonb) to anon, authenticated;

-- Chỉ trả các trường cần thiết cho bản thỏa thuận; không trả email.
create or replace function public.get_merger_agreement_document(p_code text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'agreement_code', m.agreement_code,
    'legion_name', m.legion_name,
    'current_leader_name', m.current_leader_name,
    'current_leader_uid', m.current_leader_uid,
    'member_count', m.member_count,
    'representative_name', m.representative_name,
    'status', m.status,
    'created_at', m.created_at,
    'confirmed_at', coalesce(m.confirmed_at,m.created_at),
    'agreement_snapshot', m.agreement_snapshot
  )
  from public.merger_applications m
  where m.agreement_code = trim(p_code)
    and m.status in ('approved','locked','pending')
  limit 1;
$$;

revoke all on function public.get_merger_agreement_document(text) from public;
grant execute on function public.get_merger_agreement_document(text) to anon, authenticated;
