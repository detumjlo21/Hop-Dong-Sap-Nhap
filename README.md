# PHOENIX 禄 — Branch Agreement V4

Web ký kết hai bên để tiếp nhận **TB● Warriors** trở thành **PHOENIX 禄 — Nhánh 3**. Đây là thỏa thuận cơ cấu/quản lý; không phải chuyển thành viên sang một quân đoàn khác.

## V4 có gì mới?

- Trang Admin có 2 khu: **Hồ sơ ký kết** và **Nội dung website**.
- Admin chỉnh trực tiếp tiêu đề, tên quân đoàn, tên nhánh, UID, ghi chú, Điều 1–6, các câu xác nhận và footer.
- Nội dung lưu trong bảng `merger_site_content` của Supabase.
- Trang public tự tải nội dung CMS. Nếu Supabase không tải được, trang vẫn dùng nội dung mặc định trong source.
- Giữ nguyên đăng nhập Admin, duyệt/ký/từ chối/khóa hồ sơ và toàn bộ logic hồ sơ cũ.

## Cập nhật từ V3

1. Thay source trên GitHub bằng bộ V4 này (giữ nguyên `config.js` đang chứa URL + publishable key của bạn nếu cần).
2. Vào **Supabase > SQL Editor**.
3. Chạy **toàn bộ `supabase/schema.sql`**. Script có thể chạy lại và không xóa hồ sơ cũ.
4. Vercel tự deploy lại sau khi push GitHub.
5. Mở `merger-admin.html`, đăng nhập, chọn tab **NỘI DUNG WEBSITE**.
6. Chỉnh nội dung → **LƯU NỘI DUNG WEBSITE** → bấm **XEM TRANG** để kiểm tra.

## Bảo mật

- Frontend chỉ dùng Supabase publishable/anon key.
- `anon` chỉ được đọc nội dung website và gọi RPC tạo hồ sơ; không đọc danh sách hồ sơ.
- Chỉ user có UID trong `public.admins` mới được chỉnh nội dung hoặc duyệt hồ sơ.
