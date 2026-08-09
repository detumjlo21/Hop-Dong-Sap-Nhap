# PHOENIX 禄 — Branch Agreement Agreement Portal

Web riêng cho thỏa thuận **TB● Warriors → PHOENIX 禄 — Nhánh 3**.

## Stack
- HTML / CSS / JavaScript tĩnh
- Supabase Database + Auth + RLS
- GitHub
- Vercel (không cần Next.js, không cần npm build)

## File chính
- `index.html` — trang người đại diện gửi hồ sơ
- `merger-admin.html` — trang Admin
- `styles.css` — giao diện PHOENIX, responsive PC/mobile
- `app.js` — gửi hồ sơ bằng Supabase RPC
- `admin.js` — Supabase Auth + duyệt/từ chối/khóa
- `config.js` — chỉ chứa Project URL + publishable/anon key
- `supabase/schema.sql` — database, RPC, RLS và bảng admins

## 1. Supabase
Mở SQL Editor và chạy toàn bộ `supabase/schema.sql`.

## 2. Cấu hình frontend
Mở `config.js` và thay 2 giá trị:

```js
window.PHOENIX_MERGER_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseKey: "YOUR_PUBLISHABLE_OR_ANON_KEY"
};
```

Publishable/anon key được phép xuất hiện ở frontend. **Không dùng `service_role` hoặc `sb_secret_...` trong repo.**

## 3. Tạo Admin
Trong Supabase: Authentication > Users > Add user. Tạo email/mật khẩu Admin.
Copy UUID của user rồi chạy:

```sql
insert into public.admins(user_id)
values ('UUID_USER_ADMIN');
```

Sau đó truy cập `merger-admin.html` và đăng nhập bằng email/mật khẩu vừa tạo.

## 4. Deploy Vercel
Upload toàn bộ file/thư mục của repo ở root GitHub rồi Import repo vào Vercel.

Đây là web static:
- Framework Preset: `Other`
- Root Directory: `./`
- Build Command: để trống / Override OFF
- Output Directory: để trống / Override OFF
- Install Command: để trống / Override OFF

Vercel sẽ phục vụ `index.html` trực tiếp. Không có bước `next build`.

## Bảo mật
- Khách không được SELECT bảng `merger_applications`.
- Khách không được UPDATE/DELETE hồ sơ.
- Khách chỉ gọi RPC `submit_merger_application` để tạo hồ sơ và nhận mã.
- Admin phải đăng nhập Supabase Auth và có UUID trong `public.admins`.
- RLS kiểm soát SELECT/UPDATE của Admin.
