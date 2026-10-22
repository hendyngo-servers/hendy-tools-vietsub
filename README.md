# Hendy Tools Vietsub 2.2.1 — Offline Studio

Bộ công cụ biên tập phụ đề với dịch máy Argos Translate, nhận dạng giọng nói Whisper và xử lý video bằng FFmpeg. Sau khi mô hình đã được tải trong bước build backend, các tác vụ suy luận chạy tại backend do bạn quản lý, **không cần API key hoặc gọi dịch vụ dịch thuật/AI bên thứ ba**.

> GitHub Pages và Cloudflare Workers ở cấu hình này chỉ host giao diện. Dịch offline, nhận dạng lời nói và xuất MP4 cần backend Python/FFmpeg được chạy riêng.

## Tính năng

- Nhập, sửa và xuất SRT, WebVTT, JSON; hoàn tác/làm lại, lưu nháp cục bộ.
- Xem trước video, sửa timeline, tìm/thay thế, làm sạch, kiểm tra thứ tự và chồng lấn.
- Tạo phụ đề nháp từ giọng nói bằng Whisper tiny.
- Dịch Vietsub offline bằng gói Argos đóng kèm: English, Japanese, Korean, Chinese, French, German, Indonesian, Italian, Finnish và Hindi. Các ngôn ngữ nguồn không phải English được Argos chuyển qua English khi có đủ cặp mô hình.
- Ghép phụ đề vĩnh viễn vào file MP4 mới bằng FFmpeg.
- Giới hạn upload mặc định 200 MB/10 phút; tối đa 40 dòng mỗi lượt dịch.

## 1. Chạy đầy đủ trên Windows (cách đơn giản nhất)

1. Cài Docker Desktop và mở ứng dụng cho đến khi Docker Engine báo sẵn sàng.
2. Tải hoặc clone repository này về Windows.
3. Nhấp đúp **run-offline.bat**.
4. Đợi Docker build thành công, tải các gói dịch và mô hình Whisper, sau đó mở http://localhost:8080.
5. Kiểm tra backend tại http://localhost:10000/health. Trường **ok** phải là **true**.

Lần build đầu cần Internet, thời gian và dung lượng đĩa đáng kể để tải các mô hình. Những lần chạy sau sẽ dùng mô hình trong image/container; không gọi API suy luận bên ngoài.

Dừng các dịch vụ bằng lệnh:

~~~bash
docker compose down
~~~

Xem log backend nếu bộ máy chưa sẵn sàng:

~~~bash
docker compose logs -f api
~~~

## 2. GitHub Pages (giao diện công khai)

Workflow **.github/workflows/pages.yml** tự kiểm tra và deploy khi có commit vào **main**. Workflow chạy **npm run check**, tạo **dist/**, rồi chỉ tải **dist/** lên GitHub Pages. Mã backend, tests, userscript và cấu hình Docker không được đưa vào artifact tĩnh.

Trong repository, bật **Settings → Pages → Build and deployment → Source: GitHub Actions** nếu Pages chưa được thiết lập. Sau lần deploy thành công, mở:

https://hendyngo-servers.github.io/hendy-tools-vietsub/

Các công cụ biên tập SRT/VTT/JSON chạy trên trình duyệt. Để bật dịch và xử lý video, tạo backend ở bước 4 rồi nhập URL backend trong thẻ **Dịch & tạo Vietsub** và chọn **Kiểm tra bộ máy**.

## 3. Cloudflare Workers (giao diện công khai)
Hướng dẫn từng bước để tạo API Token, thêm hai GitHub Actions Secrets, chạy workflow và xác nhận deployment thật: [docs/DEPLOY_CLOUDFLARE.md](docs/DEPLOY_CLOUDFLARE.md).


Đã có cấu hình **wrangler.jsonc** và workflow **.github/workflows/cloudflare.yml**. Worker chỉ phục vụ frontend tĩnh đã đóng gói trong **dist/**, không chạy mô hình Python/Whisper/FFmpeg.

Trong GitHub repository vào **Settings → Secrets and variables → Actions → New repository secret**, thêm:

- **CLOUDFLARE_API_TOKEN**: API Token tối thiểu có quyền deploy Workers Scripts/Static Assets cho đúng account.
- **CLOUDFLARE_ACCOUNT_ID**: Account ID của Cloudflare.

Sau khi có hai secret, commit frontend vào **main** hoặc chạy workflow **Deploy static site to Cloudflare Workers** thủ công. Nếu chưa cấu hình secret, workflow sẽ bỏ qua bước deploy Cloudflare và báo notice; không cần token để chạy CI hoặc GitHub Pages.

## 4. Backend offline trên Render

1. Mở Render Dashboard và tạo **New → Blueprint**.
2. Kết nối repository **hendyngo-servers/hendy-tools-vietsub** và chọn nhánh **main**.
3. Render đọc **render.yaml**, build Docker image có FFmpeg, Argos, faster-whisper và các mô hình.
4. Sau khi service tạo xong, chờ health check tại **/health** chuyển sang HTTP 200.
5. Trong giao diện công khai, nhập URL backend Render, ví dụ https://TEN-DICH-VU.onrender.com.
6. Nếu giao diện chạy ở tên miền Cloudflare riêng, vào Render → service → Environment và thêm origin giao diện đó vào biến **ALLOWED_ORIGINS**, phân cách bằng dấu phẩy. Origin chỉ gồm scheme + host + port (nếu có), không thêm đường dẫn.

Mô hình được build sẵn trong image; deployment đầu tiên có thể tải dữ liệu lớn và mất nhiều thời gian. Bộ xử lý offline không phù hợp với instance RAM thấp. Blueprint hiện để **plan: free** để thử nghiệm tiết kiệm chi phí; Render nêu rõ Free instances không dành cho production. Trước khi phát hành chính thức, hãy chọn instance phù hợp với RAM/CPU và chi phí trong Render Dashboard. Không thay đổi plan nếu chưa chấp nhận chi phí.

## 5. Kiểm tra và phát hành phiên bản

Cần Node.js 20+ và Python 3.11+ để chạy toàn bộ kiểm tra mã nguồn:

~~~bash
npm run check
~~~

Lệnh này kiểm tra cú pháp JavaScript, các test parser/UI/backend và tạo artifact **dist/**; script build xác minh các file giao diện cần thiết và từ chối nếu mã server-only lọt vào artifact.

Khi muốn tạo GitHub Release, hãy bảo đảm trường **version** trong **package.json** khớp tag. Với bản này, dùng tag **v2.2.1**; workflow **.github/workflows/release.yml** sẽ chạy test, đóng gói frontend ZIP và tạo Release nếu tất cả bước thành công.

## Quyền riêng tư và giới hạn

- Import, sửa, lưu nháp và xuất SRT/VTT/JSON chạy trực tiếp trong trình duyệt.
- Video/âm thanh chỉ được gửi tới backend đã cấu hình khi bạn chủ động yêu cầu nhận dạng lời thoại hoặc xuất MP4. Backend xóa tệp tạm sau tác vụ.
- Chỉ dùng backend do bạn quản lý hoặc tin cậy. Không đưa URL backend riêng vào nơi công khai nếu không muốn người khác sử dụng.
- Dịch máy có thể sai tên riêng, thành ngữ và sắc thái; hãy rà soát bản dịch trước khi xuất.
- Test CI và build artifact không thay thế kiểm thử đầu-cuối bằng mô hình trong Docker/Render thực tế.

## Thành phần mã nguồn mở

- Argos Translate: https://github.com/argosopentech/argos-translate
- Argos model index: https://github.com/argosopentech/argospm-index
- faster-whisper: https://github.com/SYSTRAN/faster-whisper
- FFmpeg: https://ffmpeg.org/
