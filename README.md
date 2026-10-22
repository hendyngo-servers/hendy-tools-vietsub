# Hendy Tools Vietsub 2.2.0 — Offline Studio

Bộ công cụ Vietsub tích hợp mô hình dịch và nhận dạng giọng nói mã nguồn mở. Khi container đã được build, dịch phụ đề và nhận dạng giọng nói không gọi API suy luận bên ngoài; không cần API key, tài khoản nhà cung cấp hay gói dịch vụ AI tính phí theo lượt.

## Công cụ tích hợp

- Nhập, sửa và xuất SRT/WebVTT; sửa timeline, hoàn tác/làm lại, lưu nháp cục bộ.
- Xem trước video cục bộ, tìm/lọc, sắp xếp, căn chỉnh thời gian, thay thế văn bản, làm sạch và kiểm tra phụ đề.
- Nhận dạng lời thoại từ video thành phụ đề nháp bằng mô hình Whisper tiny chạy cục bộ trong backend.
- Dịch phụ đề offline sang tiếng Việt bằng Argos Translate, hỗ trợ tiếng Anh, Nhật, Hàn, Trung, Tây Ban Nha, Pháp, Đức, Indonesia và Thái. Với nguồn ngoài tiếng Anh, mô hình đi qua tiếng Anh.
- Ghép phụ đề vĩnh viễn vào một file MP4 mới bằng FFmpeg.

## Cách dùng

Các công cụ biên tập, xem trước và xuất SRT/VTT/JSON hoạt động trực tiếp trong trình duyệt mà không cần backend.

Để bật dịch neural offline, nhận dạng giọng nói và xuất MP4 có phụ đề, chạy backend tự quản lý. GitHub Pages chỉ phục vụ tệp tĩnh, không thể tự chạy mô hình Python hoặc FFmpeg, vì vậy giao diện cần URL của backend riêng — đây không phải API dịch vụ bên thứ ba và không cần khóa API.

### Chạy trên Windows bằng một tệp BAT

1. Cài và mở Docker Desktop, đợi Docker báo đang chạy.
2. Tải repository về máy hoặc mở bản clone trong thư mục dự án.
3. Chạy `run-offline.bat` bằng cách nhấp đúp. Script sẽ build mô hình, khởi động frontend/backend và mở `http://localhost:8080`.
4. Kiểm tra `http://localhost:8080/health`. Chỉ khi bộ máy báo sẵn sàng mới dùng dịch offline/Whisper/FFmpeg.

Lần build đầu cần internet và dung lượng đĩa lớn để cài mô hình; các tác vụ suy luận sau đó không gọi dịch vụ API bên thứ ba. Nếu chỉ dùng công cụ biên tập thủ công, `run-local.bat` hoặc mở `index.html` vẫn đủ.

### Chạy với Docker

Yêu cầu Docker Desktop hoặc Docker Engine và kết nối internet trong lần build đầu để tải mô hình mã nguồn mở vào image:

\`\`\`bash
docker build -t hendy-vietsub .
docker run --rm -p 10000:10000 -e ALLOWED_ORIGINS=http://localhost:8080 hendy-vietsub
\`\`\`

Mở giao diện, đến tab **Dịch & tạo Vietsub**, nhập URL backend \`http://localhost:10000\`, rồi bấm **Kiểm tra bộ máy**. Với frontend GitHub Pages, nhập URL public của backend và bảo đảm origin frontend nằm trong biến \`ALLOWED_ORIGINS\`.

### Render

Tạo Blueprint từ \`render.yaml\`. Lần build đầu tải mô hình Argos và Whisper (image lớn hơn static site và mất nhiều thời gian hơn). Sau deploy, kiểm tra \`/health\`; các cờ \`offlineEngineReady\`, \`offlineTranslation\`, \`speechRecognition\`, \`videoRendering\` cần là \`true\`.

Gói Free có thể ngủ, hết thời gian hoặc thiếu RAM khi chạy mô hình. Khuyến nghị môi trường có ít nhất 2 GB RAM; hãy kiểm tra giới hạn và giá Render trước khi chọn gói trả phí.

## Quyền riêng tư và giới hạn

Video/âm thanh chỉ được tải lên backend khi người dùng chủ động chọn **Tạo phụ đề từ giọng nói** hoặc **Xuất MP4 có phụ đề**. Tệp được xử lý tạm thời và xóa sau tác vụ. Sửa phụ đề và xuất SRT/VTT vẫn làm trong trình duyệt. Hãy chỉ dùng backend bạn kiểm soát hoặc tin cậy.

Mặc định giới hạn video 200 MB/10 phút; dịch tối đa 40 dòng mỗi nhóm; 3 tác vụ media mỗi IP trong 15 phút. Dịch máy có thể sai tên riêng, thành ngữ và ngữ cảnh nên cần rà soát trước khi xuất.

## Công nghệ

- Argos Translate: https://github.com/argosopentech/argos-translate
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- FFmpeg: xử lý và ghép phụ đề vào video.

## Kiểm thử

Node.js 20 trở lên:

\`\`\`bash
npm run check
\`\`\`

Các kiểm tra mã nguồn không thay thế thử nghiệm end-to-end trong Docker với mô hình đã build.
