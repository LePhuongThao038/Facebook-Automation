# Facebook Desk K-Global

> ⚠️ **Cập nhật FB Desk: KHÔNG Load unpacked một thư mục mới.** Làm vậy Chrome tạo ID extension mới: hàng chờ và tiến độ trống, Media Bridge và bộ lưu CSV từ chối ID. Hãy chép đè vào **đúng thư mục Chrome đang nạp** bằng `Update-InPlace.ps1` (xem trước với `-Preview`, có sao lưu và tự phục hồi khi lỗi), rồi bấm ↻ trong `chrome://extensions`:
> ```
> powershell -ExecutionPolicy Bypass -File Update-InPlace.ps1 -Target "<thư mục Chrome đang nạp>" -Preview
> powershell -ExecutionPolicy Bypass -File Update-InPlace.ps1 -Target "<thư mục Chrome đang nạp>"
> ```
> Đường dẫn đang nạp xem ở `chrome://extensions` → Chi tiết → "Đã tải từ". Nếu đã lỡ cài ra ID mới, chạy `Install-Start-Video.cmd` với ID mới (script giờ ghép ID vào cả `media-native-host.json` và `media-bridge-config.json`).


Extension Chrome (Manifest V3) dùng để quản lý nội dung từ Google Docs, xếp lịch và tự đăng bài lên trang cá nhân Facebook. Đi kèm có Media Bridge (Python + yt-dlp) để dựng MP4.

Phiên bản hiện tại: **3.8.7**. **Agent/đồng nghiệp: đọc [AGENTS.md](AGENTS.md) trước khi lấy hoặc đẩy mã.** Post Research 0.2.22 nằm trong `post-research/`. Hệ thống hoạt động thế nào, các lỗi đã gặp và cách vận hành: xem [docs/FLOW.md](docs/FLOW.md). Danh sách thay đổi: [CHANGELOG-3.8.7.md](CHANGELOG-3.8.7.md), [CHANGELOG-3.8.6.md](CHANGELOG-3.8.6.md).

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
