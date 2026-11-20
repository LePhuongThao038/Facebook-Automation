# Kết quả sửa 6 lỗi vận hành 3.8.7 (theo đề xuất `DE-XUAT-SUA-6-LOI-3.8.7.md`)

Ngày 20/11/2026, trên nhánh `release/3.8.7`. **Số phiên bản giữ nguyên** (FB Desk 3.8.7, Post Research 0.2.25) cho tới khi người vận hành xác nhận trên dữ liệu thật.

| # | Lỗi | Đã sửa | Kiểm chứng |
|---|---|---|---|
| 1 | Video trong bài nhiều media: Bridge nhận link bài viết | **Post Research** ghi link riêng của từng video trong vùng media (ô "Video trong album" có link `/<uid>/videos/pcb.<album>/<mã>`), mỗi video một dòng Media JSON. **FB Desk** đọc nhiều Media JSON/bài; nếu nguồn vẫn là link bài viết sau khi thử tìm mã video thì dừng TRƯỚC khi gọi Bridge, báo "Media nguồn ghi link BÀI VIẾT… quét lại" (không tự thử lại) | Trên bài thật `bacuphom2018/posts/pfbid02eh…` (bài 6 của báo cáo): lấy đúng 1 link video; yt-dlp đọc link đó (`watch?v=916384724525827`, 14 s, 1080×1920), còn link bài viết thì báo "only available for registered users". Test `ops-387` |
| 2 | Caption là lời trả lời bình luận | Post Research: phản hồi dạng "X đáp lại phản hồi của Y" là comment (0.2.23). Thêm cờ: caption lấy theo cách dự phòng (`text-block`) mà mở đầu bằng tên một người bình luận trong chính bài thì đánh dấu `nghi-tra-loi-binh-luan` + rút gọn. FB Desk chặn với lý do riêng; người vận hành sửa caption thì được đăng | Test `ops-387`. **Chưa** kiểm chứng trên Bài 5/7 của báo cáo (không có link bài) |
| 3 | Cài thư mục mới làm đổi ID | `Update-InPlace.ps1`: xem trước (`-Preview`), xác minh đúng FB Desk, theo junction, sao lưu cạnh thư mục, chỉ chép tệp mã, giữ cấu hình máy, tự phục hồi khi lỗi. `Install-Start-Video` ghép ID vào cả `media-native-host.json` và `media-bridge-config.json`. Cảnh báo đặt ở đầu README và AGENTS | Chạy trên bản sao `v3.8.7`: xem trước, cập nhật, chạy lần 2 (không còn gì), giữ cấu hình máy, khóa một tệp giữa chừng → tự phục hồi |
| 4 | Caption rút gọn | Trang ảnh (`/photo/?fbid=`): caption nằm ở khung bên phải `[role=complementary]`, ngoài `[role=main]`. Đọc khung đó (bấm "Xem thêm" nếu có, bỏ dòng ngày có ký tự ẩn U+034F và số đếm ảnh) | Trên trang ảnh thật của Giang: caption đủ 370 ký tự, Docs cũ chỉ có bản cắt "…" |
| 5 | Dashboard ghi "3.8.5 RC11" | Nhãn, tiêu đề, hộp "Kiểm tra bản đang chạy" lấy từ manifest; tab mở từ bản trước khi ↻ được nhắc mở lại. Tiêu đề tab vẫn là tên tệp CSV nên không chèn số phiên bản | Test `ops-387`, `autosave` (tên CSV không đổi) |
| 6 | Nick không có tên | Tên dùng chung cho tab, CSV tự lưu, tải tay: tên Facebook → hồ sơ nhân vật → `DANH-BA-TU-SHEET.json` trong thư mục cài (giữ khi cập nhật tại chỗ) → tên tự đặt tại máy (bấm vào tên nick trên dashboard). Đăng bài vẫn theo UID. CSV cũ không bị đổi tên | Test `ops-387` |

## Nguyên nhân gốc: Post Research không bao giờ xuất được câu trả lời (20/11)

Đã tái hiện bằng đúng `caption.js` + `scan.js`, gọi `researchScan('post',30)` trên bài thật `yenzo22501/posts/pfbid02rEWtt…` (Bài 1 trong Docs `1g0Ax5w…`). Bản quét **mở được** các câu trả lời (trang có 29 bình luận, trong đó 17 câu trả lời), nhưng chỉ trả về 11 bình luận gốc. Lý do: khóa chống trùng lấy `comment_id` số ở link cuối của mục, mà link đó của một câu trả lời trỏ về **bình luận cha**. Mọi câu trả lời vì thế trùng khóa với cha và bị loại. Lỗi có từ mã gốc, nên các sửa trước (mở "câu trả lời", dựng cây, đưa tab lên trước) chưa có tác dụng. Đã sửa khóa thành mã riêng của từng mục. Chạy lại trên cùng bài: **28 mục**, có câu trả lời cấp 1–3, đúng comment cha và đúng vai Tác giả.

## Điểm cần người duyệt quyết định

Đề xuất ghi: "Facebook chỉ đóng ô soạn mà chưa có bằng chứng đăng phải giữ trạng thái cần đối soát". Bản 3.8.7 hiện làm **ngược lại theo yêu cầu trước đó của người dùng** (19/11): hộp soạn đóng mà không báo lỗi thì ghi **Đã đăng** và đóng tab, link tìm lại sau. Chưa đổi; chờ người dùng chọn.

## Chưa kiểm chứng

- Lượt đăng thật bằng 3.8.7 (bước `published`, "Chạy thử").
- Docs mới quét bằng Post Research có các sửa này (cây bình luận, đưa tab lên trước, link video, caption trang ảnh).
