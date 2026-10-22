# Đưa bản 2.1.0 lên GitHub

Kết nối GitHub dùng cho phiên làm việc này chỉ có quyền đọc, vì vậy không thể tạo nhánh/commit trực tiếp bằng connector. Gói mã nguồn đã được chuẩn bị sẵn; dùng các bước dưới đây trong máy có quyền ghi vào repository.

```bash
git clone https://github.com/hendyngo-servers/hendy-tools-vietsub.git
cd hendy-tools-vietsub
git checkout -b upgrade/v2.1.0
```

Giải nén toàn bộ nội dung `hendy-tools-vietsub-v2.1.0.zip` vào thư mục `hendy-tools-vietsub` vừa clone và cho phép ghi đè tệp trùng tên. Không xóa thư mục `.git`.

```bash
npm run check
git add -A
git commit -m "feat: upgrade Hendy VietSub Tools to v2.1.0"
git push -u origin upgrade/v2.1.0
```

Sau khi push, mở PR tại:

`https://github.com/hendyngo-servers/hendy-tools-vietsub/compare/main...upgrade/v2.1.0?expand=1`

CI sẽ chạy tự động trên nhánh/PR. Chỉ gộp PR khi CI xanh và đã xem lại phần thay đổi.
