# Facebook Desk K-Global

Extension Chrome (Manifest V3) dùng để quản lý nội dung từ Google Docs, xếp lịch và tự đăng bài lên trang cá nhân Facebook. Đi kèm có Media Bridge (Python + yt-dlp) để dựng MP4.

Phiên bản hiện tại: **3.8.6.2**. Hệ thống hoạt động thế nào, các lỗi đã gặp và cách vận hành: xem [docs/FLOW.md](docs/FLOW.md). Danh sách thay đổi: [CHANGELOG-3.8.6.md](CHANGELOG-3.8.6.md).

## Cài đặt

1. Mở `chrome://extensions`, bật **Developer mode**.
2. Bấm **Load unpacked** và chọn thư mục này.
3. Nếu dùng video: chạy `Install-Start-Video.cmd` một lần, cài `python -m pip install -U yt-dlp`, có `ffmpeg` trong PATH.

## Không có trong repo

Repo chỉ chứa mã nguồn. Các tệp dữ liệu và cấu hình riêng của máy đã được loại ra, xem `.gitignore`:

- `DANH-BA-TU-SHEET.json` (danh bạ nhân vật), `CROSS-COMMENT-FIXED-ROLES.json`, các nguồn comment chéo. Tính năng nhân vật và comment chéo cần bạn tự cung cấp các tệp này.
- `media-native-host.json`, `media-bridge-config.json`: tạo khi chạy `Install-Start-Video.ps1` trên máy đích.
- Các tệp `.exe` của native host: build lại từ `DeskNativeHost.cs` và `MediaNativeHost.cs`.

## Kiểm thử

```
node tests/post-flow-386.mjs
node --test tests/ai-provider.mjs tests/comment-review.mjs tests/autosave.mjs
```

`post-flow-386.mjs` chạy trên Chrome với hộp soạn Facebook mô phỏng, cần Playwright.
