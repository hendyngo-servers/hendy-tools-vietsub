# Hendy Tools Vietsub v2.0.0

Bộ công cụ biên tập phụ đề trên trình duyệt, không cần build step.

## Tính năng
- Nhập SRT / WebVTT.
- Biên tập bản gốc, Vietsub và mốc thời gian.
- Tìm kiếm, lọc dòng chưa dịch, tự lưu nháp cục bộ, hoàn tác/làm lại.
- Xem trước phụ đề đồng bộ với video trên máy.
- Xuất SRT, VTT, song ngữ SRT và JSON.
- Dịch hàng loạt qua endpoint tương thích LibreTranslate do bạn cấu hình.

## Chạy
Mở `index.html` bằng Chrome hoặc Edge. Nhập SRT/VTT, sửa bản dịch, rồi chọn định dạng xuất.

## Dịch API
Nhập URL endpoint LibreTranslate, mã nguồn và đích (mặc định `auto` → `vi`), cùng API key nếu cần. CORS của máy chủ phải cho phép trình duyệt. Khóa API được lưu trong localStorage; không commit khóa vào Git. Chỉ gửi nội dung đến máy chủ bạn tin cậy.

## Tampermonkey
Cài `userscript/hendy-tools-vietsub.user.js`. Script cung cấp nút mở trang dự án; để biên tập, mở `index.html` từ bản tải xuống hoặc Pages deployment.

## Giới hạn
Không tự nhận dạng giọng nói và không ghép phụ đề vĩnh viễn vào video. Dịch máy yêu cầu dịch vụ API hoạt động. Đây là ứng dụng phía trình duyệt, không cần backend bắt buộc.
