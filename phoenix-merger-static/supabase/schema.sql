-- PHOENIX MERGER — STATIC HTML/CSS/JS + SUPABASE
-- Có thể chạy lại nhiều lần. Tương thích cả bảng merger_applications đã tạo ở bản trước.

create extension if not exists pgcrypto;

create sequence if not exists public.merger_agreement_seq start 1;

create or replace function public.next_merger_agreement_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  next_no bigint;
begin
  next_no := nextval('public.merger_agreement_seq');
  return 'PXN-' || extract(year from now())::int || '-' || lpad(next_no::text, 4, '0');
end;
$$;

revoke all on function public.next_merger_agreement_code() from public, anon, authenticated;

create table if not exists public.merger_applications (
  id uuid primary key default gen_random_uuid(),
  agreement_code text unique not null,
  legion_name text not null,
  current_leader_name text not null,
  current_leader_id text,
  current_leader_uid text not null,
  member_count integer not null check (member_count > 0 and member_count <= 500),
  representative_name text not null,
  representative_id text,
  email text,
  management_confirmed boolean not null default false,
  long_term_confirmed boolean not null default false,
  discipline_confirmed boolean not null default false,
  rights_confirmed boolean not null default false,
  final_confirmed boolean not null default false,
  status text not null default 'pending' check (status in ('pending','approved','rejected','locked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  locked_at timestamptz
);

-- Tương thích schema V2 cũ nếu bảng đã tồn tại.
alter table public.merger_applications add column if not exists updated_at timestamptz not null default now();
alter table public.merger_applications add column if not exists reviewed_by uuid;
alter table public.merger_applications add column if not exists locked_at timestamptz;
alter table public.merger_applications alter column representative_id drop not null;

-- Danh sách tài khoản được phép vào Admin.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;
alter table public.merger_applications enable row level security;

-- Xóa policy của bản static này nếu chạy lại SQL.
drop policy if exists "admins_read_self" on public.admins;
drop policy if exists "merger_admin_select" on public.merger_applications;
drop policy if exists "merger_admin_update" on public.merger_applications;

create policy "admins_read_self"
on public.admins
for select
to authenticated
using (user_id = auth.uid());

create policy "merger_admin_select"
on public.merger_applications
for select
to authenticated
using (exists(select 1 from public.admins a where a.user_id = auth.uid()));

create policy "merger_admin_update"
on public.merger_applications
for update
to authenticated
using (exists(select 1 from public.admins a where a.user_id = auth.uid()))
with check (exists(select 1 from public.admins a where a.user_id = auth.uid()));

-- Public KHÔNG có SELECT/UPDATE/DELETE/INSERT trực tiếp vào bảng.
-- Public chỉ được gọi RPC dưới đây. RPC tự tạo mã hồ sơ và trả đúng mã vừa tạo.
create or replace function public.submit_merger_application(
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
  p_confirm_final boolean
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
  if p_member_count is null or p_member_count < 1 or p_member_count > 200 then raise exception 'Số thành viên không hợp lệ'; end if;
  if length(trim(coalesce(p_representative_name,''))) < 1 then raise exception 'Thiếu người đại diện'; end if;
  if not coalesce(p_confirm_structure,false)
     or not coalesce(p_confirm_long_term,false)
     or not coalesce(p_confirm_discipline,false)
     or not coalesce(p_confirm_rights,false)
     or not coalesce(p_confirm_final,false) then
    raise exception 'Chưa xác nhận đầy đủ điều khoản';
  end if;

  v_code := public.next_merger_agreement_code();

  insert into public.merger_applications (
    agreement_code, legion_name, current_leader_name, current_leader_uid,
    member_count, representative_name, email,
    management_confirmed, long_term_confirmed, discipline_confirmed,
    rights_confirmed, final_confirmed, status
  ) values (
    v_code, trim(p_legion_name), trim(p_current_leader_name), trim(p_current_leader_uid),
    p_member_count, trim(p_representative_name), nullif(trim(coalesce(p_email,'')),''),
    true, true, true, true, true, 'pending'
  );

  return v_code;
end;
$$;

revoke all on function public.submit_merger_application(text,text,text,integer,text,text,boolean,boolean,boolean,boolean,boolean) from public;
grant execute on function public.submit_merger_application(text,text,text,integer,text,text,boolean,boolean,boolean,boolean,boolean) to anon, authenticated;

-- Chặn quyền bảng trực tiếp cho anon.
revoke all on table public.merger_applications from anon;

-- Authenticated cần quyền SQL nền để RLS quyết định ai được đọc/cập nhật.
grant select, update on table public.merger_applications to authenticated;
grant select on table public.admins to authenticated;

-- BƯỚC TẠO ADMIN SAU KHI TẠO USER TRONG Authentication > Users:
-- insert into public.admins(user_id) values ('UUID_USER_ADMIN');
