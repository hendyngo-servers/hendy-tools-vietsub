# Changelog

## 2.1.0 — 2026-10-22

- Tách parser, định dạng SRT/VTT và các phép biến đổi phụ đề thành `src/subtitles.js` để dễ kiểm thử.
- Nâng cấp giao diện responsive cho editor, preview video, công cụ timeline và cấu hình dịch.
- Bổ sung WebVTT cue settings, kiểm tra import JSON, giới hạn kích thước file, tìm/thay thế, làm sạch văn bản, sắp xếp và kiểm tra chồng lấn.
- Thêm xuất SRT/VTT bản gốc, Vietsub hoặc song ngữ; xuất/khôi phục JSON.
- Dịch API tùy chọn qua OpenAI-compatible Chat Completions hoặc LibreTranslate-compatible.
- Không lưu API key vào localStorage, bản nháp hay JSON export.
- Thêm PWA shell cache, userscript studio, CI và bộ kiểm thử `node:test` không cần dependency ngoài.
