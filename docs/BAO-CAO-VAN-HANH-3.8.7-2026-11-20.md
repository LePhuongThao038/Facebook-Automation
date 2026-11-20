# Báo cáo từ máy vận hành: 3.8.7 chạy thật ngày 20/11/2026

Gửi agent/đồng nghiệp phụ trách nhánh `release/3.8.7`. Người vận hành đánh giá bản này **chưa dùng được cho sản xuất**. Dưới đây là các lỗi thấy trên dashboard và trong CSV tự lưu, kèm bằng chứng và hướng sửa đề xuất. Mỗi mục ghi rõ đã kiểm chứng hay chưa.

- **Máy:** Windows 10, 10 Chrome profile chạy song song, mỗi nick một profile.
- **Bản kiểm tra:** tag `v3.8.7-3`, nạp unpacked từ một thư mục mới.
- **Dữ liệu:** CSV tự lưu của nick UID 61593376541721 (Profile 1), đang chạy 3.8.7: 24 bài, gồm 23 nháp và 1 lỗi.

## Tóm tắt

| # | Mức | Lỗi | Thuộc phần |
|---|---|---|---|
| 1 | **Cao** | Bài có 4 ảnh + 1 video: "Dựng MP4: Không lấy được video công khai" | Post Research ghi link video là link **bài viết** |
| 2 | **Cao** | Caption là một **comment** ("Duy Nguyễn tks bro. Quá hữu ích") | Post Research |
| 3 | **Cao** | Cài 3.8.7 bằng thư mục mới thì ra ID mới: mất hàng chờ, Media Bridge và bộ lưu CSV từ chối ID | Hướng dẫn cài / AGENTS.md |
| 4 | Trung bình | 4/24 bài bị "Có caption nhưng nguồn đánh dấu còn rút gọn" (caption kết thúc bằng "…") | Post Research không mở "Xem thêm" |
| 5 | Trung bình | Tiêu đề tab dashboard vẫn ghi "3.8.5 RC11", và kiểm tra bản build so với "3.8.5 RC11" | `dashboard.html`, `build-info-ui.js` |
| 6 | Thấp | Nick liên kết không có tên ("UID 61593376541721"); CSV tự lưu tên "Chưa xác định tên" | Liên kết tài khoản |

## Chi tiết

### 1. Video trong bài nhiều media: Bridge nhận link bài viết

Bài 6 (4 ảnh, 1 video, nguồn: video). Lỗi: `Tải tệp 5: Dựng MP4: Khong lay duoc video cong khai.`

Media JSON của tệp video:

```json
{"kind":"video","schema":"desk.media/1","sourceUrl":"https://www.facebook.com/bacuphom2018/posts/pfbid02ehPBq1SF5VSusdBKAi5hZtxZ2ynDH7SVu3cXhod4UsdzaHwh2XAXFHDLDETdFTjdl"}
```

`sourceUrl` là **link bài viết**, không phải link của chính video.

- **Đã kiểm chứng trên máy này:** yt-dlp 2026.10.26 báo `Cannot parse data` với link `/posts/…` khi không có cookie. Khi chưa đăng nhập, Facebook trả HTTP 400 cho trang bài. Với `/reel/<id>`, yt-dlp đọc được.
- Bản 3.8.6.3 có `resolveVideoSource` trong `background.js`: đọc trang bài bằng phiên đăng nhập rồi lấy mã video áp đảo. Hàm này không tìm được với bài nhiều media, vì bài chứa nhiều mã ảnh/video, nên giữ nguyên link bài viết.
- **Đề xuất (Post Research):** khi quét bài có video, ghi link riêng của **từng video** (`/videos/<id>`, `/reel/<id>` hoặc `watch/?v=<id>`) vào `sourceUrl`, lấy từ thẻ video hoặc link "Xem video" của chính mục media đó. Không dùng link bài viết.
- **Đề xuất (FB Desk):** nếu `sourceUrl` là link bài viết thì báo lỗi rõ ở bước đọc nguồn ("Nguồn ghi link bài viết thay vì link video, cần quét lại"), thay vì để tới lúc Media Bridge thất bại.

### 2. Caption lấy nhầm comment

Bài 5: caption `Duy Nguyễn tks bro. Quá hữu ích`. Bài 7: caption `Duy Nguyễn dạ thế em book vé luôn nha a.`

Cả hai là **phản hồi của chủ trang dưới comment** (gọi tên người comment), không phải caption bài. Nếu đăng, nick sẽ đăng một bài vô nghĩa. AGENTS.md ghi Post Research 0.2.23 đã sửa lỗi "caption lấy nhầm comment", nhưng Docs của nick này vẫn có hai bài như vậy.

- **Chưa xác định** Docs này được quét bằng bản Post Research nào. Đề xuất ghi số phiên bản Post Research vào mỗi bài trong Docs để truy vết.
- **Đề xuất (FB Desk):** đánh dấu nghi ngờ khi caption bắt đầu bằng tên một người có trong danh sách comment của chính bài đó, và không cho vào hàng chờ khi chưa có người xác nhận.

### 3. Cài 3.8.7 làm đổi ID extension

Người vận hành làm theo cách thông thường: Load unpacked thư mục `v3.8.7-3`. Kết quả:

- ID mới (`fogmdhbh…`) có **hàng chờ và tiến độ trống**. Ở Profile 16, bản cũ đã bị gỡ, nên phải nhập lại CSV.
- Native host (`media-native-host.json`) và `media-bridge-config.json` trên máy chưa có ID mới, nên bộ lưu CSV báo "native messaging host is forbidden" và Media Bridge báo "Extension chưa được ghép nối". Máy vận hành phải tự thêm ID bằng tay.
- AGENTS.md có câu "Chép đè tệp mới vào đúng thư mục Chrome đang nạp", nhưng câu này nằm cuối trang, sau rất nhiều mục khác.
- **Đề xuất:**
  - Đưa cảnh báo **"Không Load unpacked thư mục mới, hãy chép đè vào thư mục cũ"** lên đầu AGENTS.md và README.
  - Thêm script `Update-InPlace.ps1` để chép các tệp mã sang thư mục đang nạp, giữ nguyên các tệp cấu hình riêng của máy.
  - Cho `Install-Start-Video` tự thêm ID đang chạy vào cả 2 tệp cấu hình.

### 4. Caption bị rút gọn

Bài 2, 4, 10 và 13 có `caption_partial = 1`, caption kết thúc bằng "…". Ví dụ Bài 13 chỉ có `Góc sang nhượng:…`. FB Desk chặn đúng ("Có caption nhưng nguồn đánh dấu còn rút gọn"), nhưng đến tay người vận hành thì 4/24 bài không đăng được.

- **Đề xuất (Post Research):** bấm "Xem thêm" / "See more" trong khối caption trước khi đọc, rồi đọc lại tới khi hết dấu "…". Nếu vẫn rút gọn thì đọc `og:description` của trang bài.

### 5. Nhãn phiên bản cũ trên dashboard

`dashboard.html` có `<title>Facebook Desk K-Global 3.8.5 RC11 · Kiểm tra kết nối</title>`. `build-info-ui.js` so `version_name` với `'3.8.5 RC11'`, nên bản 3.8.7 bị coi là "khác bản giao". Người vận hành nhìn tab thấy chữ "3.8.5", nên không tin là mình đang chạy 3.8.7.

Lỗi này có từ 3.8.6 (do bên tôi, LePhuongThao038, quên cập nhật) và 3.8.7 giữ nguyên. **Đề xuất:** lấy nhãn từ `chrome.runtime.getManifest()` thay vì viết cứng.

### 6. Nick không có tên

Nick liên kết có `actor_name = "UID 61593376541721"`, nên CSV tự lưu có tên "Chưa xác định tên · UID …". Chưa ảnh hưởng tới việc đăng, vì từ 3.8.6 bot xác minh nick theo UID. Nhưng nó gây nhầm khi đối chiếu log.

## Đã kiểm chứng tốt trên máy này

- Media Bridge của 3.8.7: Reel `2215910718814116` dựng ra MP4 **H.264** 24,5 MB qua `/prepare` (trước đó báo "không tìm được định dạng"). Phần chuyển AV1 sang H.264 hoạt động.
- Mã FB Desk 3.8.7 giữ nguyên các sửa của 3.8.6.3: `ensureVisible`, giới hạn chờ quyền bấm Đăng 5 phút, `resolveVideoSource`, đếm ảnh theo `src`.

## Chưa kiểm chứng

- Chưa có lượt **đăng thật** nào bằng 3.8.7 trên máy này. Nick đang chạy 3.8.7 mới có 1 bài lỗi; các bài còn lại là nháp.
- Bước `published` (Facebook đóng hộp soạn thì ghi Đã đăng) và "Chạy thử".

## Dữ liệu đính kèm

Log tiến độ của các nick khác: `logs/` trên nhánh `main` (cập nhật đến 19/11). CSV đầy đủ của nick UID 61593376541721 nằm trên máy vận hành: `%LOCALAPPDATA%\FacebookDesk\Autosave\Chưa xác định tên · UID 61593376541721__…_fogmdhbh.csv`.
