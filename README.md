# Hendy Tools Vietsub 2.1.0

Bộ biên tập phụ đề chạy phía trình duyệt, ưu tiên xử lý cục bộ. Không cần backend, framework, build step hay npm dependencies để chạy ứng dụng.

## Tính năng 2.1

- Nhập SRT/WebVTT, sắp xếp theo thời gian, sửa lời gốc và Vietsub riêng biệt.
- Xem trước video từ máy tính và hiển thị phụ đề theo thời gian phát; video không được tải lên máy chủ.
- Tìm/lọc dòng chưa dịch, thêm/xóa dòng và sửa thời gian trực tiếp.
- Hoàn tác/làm lại, tự lưu nháp cục bộ và khôi phục khi mở lại cùng trình duyệt.
- Căn chỉnh toàn bộ timeline, tìm/thay thế, làm sạch khoảng trắng, kiểm tra dòng trống, thứ tự và chồng lấn.
- Xuất SRT/VTT theo bản dịch, bản gốc hoặc song ngữ; sao lưu/khôi phục JSON.
- Dịch qua API tương thích OpenAI Chat Completions hoặc LibreTranslate-compatible do người dùng tự cấu hình.
- Có shell cache service worker để ứng dụng tiếp tục tải khi đã mở online một lần trên origin hỗ trợ HTTPS.
- Kèm Tampermonkey userscript dạng cửa sổ nổi với trình sửa, video cục bộ, thao tác timeline và dịch API.
- Không có analytics hoặc gửi dữ liệu nền.

## Chạy cục bộ

Mở `index.html` bằng Chrome/Edge/Firefox hiện đại để biên tập và xuất tệp. Trên Windows có thể chạy `run-local.bat`. Để bật service worker/PWA, chạy qua HTTP(S), ví dụ:

```bash
npx serve .
```

Hoặc dùng Live Server trong trình soạn thảo. Không cần chạy `npm install`.

## Kiểm thử

Yêu cầu Node.js 20 trở lên:

```bash
npm run check
```

Bộ kiểm thử sử dụng `node:test` tích hợp, không tải thư viện bên ngoài.

## Dịch API

1. Chọn nhà cung cấp và nhập endpoint HTTPS, tên model (nếu dùng Chat Completions), ngôn ngữ nguồn/đích.
2. Dán API key trực tiếp vào trường phiên hiện tại. **API key không được lưu vào localStorage, bản nháp hoặc file JSON.**
3. Xác nhận hộp thoại trước khi gửi phụ đề. Chỉ văn bản các dòng được chọn được gửi; video không được gửi.
4. Endpoint phải cho phép CORS phù hợp và chấp nhận payload của nhà cung cấp.

Chi phí API (nếu có) do tài khoản của bạn chịu. Chỉ gửi văn bản đến máy chủ mà bạn tin cậy. Tránh dùng khóa có quyền quản trị rộng trong trình duyệt.

## Tampermonkey

Cài `userscript/hendy-vietsub-subtitle-studio.user.js` để mở bảng công cụ trên trang web. Script không chạy trong iframe. Video và phụ đề vẫn được xử lý trong tab trình duyệt; chỉ nội dung phụ đề được gửi đi khi bạn chủ động chạy dịch API.

`userscript/hendy-tools-vietsub.user.js` là launcher gọn nhẹ. Launcher mở URL GitHub Pages mặc định; URL này chỉ hoạt động sau khi repository đã bật Pages.

## GitHub Pages

Ứng dụng là static site: đặt `index.html` ở root và publish thư mục root bằng GitHub Pages (Settings → Pages). Có thể mở trực tiếp link Pages sau khi repository đã bật Pages. GitHub Pages không được tự bật bởi mã nguồn này.

## Cấu trúc

```text
.
├── index.html
├── assets/app.css
├── src/app.js
├── src/subtitles.js
├── tests/subtitles.test.cjs
├── userscript/
│   ├── hendy-tools-vietsub.user.js
│   └── hendy-vietsub-subtitle-studio.user.js
├── manifest.webmanifest
├── sw.js
└── .github/workflows/ci.yml
```

## Giới hạn có chủ đích

- Không tự nhận dạng giọng nói (ASR) hay tự lấy transcript từ video.
- Không hard-burn/ghép phụ đề vào video và không thay thế công cụ dựng phim.
- Dịch tự động cần endpoint tương thích và có thể bị chặn bởi CORS hoặc giới hạn nhà cung cấp.
- Nháp cục bộ nằm trong storage của trình duyệt hiện tại; nên xuất JSON để sao lưu.

## License

MIT. Xem `LICENSE`.
