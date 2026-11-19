# Đọc trước khi lấy mã (cho agent và đồng nghiệp)

Repo này có nhiều người và nhiều agent cùng đẩy mã. Đọc hết trang này trước khi pull, sửa hoặc push.

## Lấy bản nào

| Mục đích | Lấy | Ghi chú |
|---|---|---|
| **Bản mới nhất đã gộp đủ tính năng** | tag **`v3.8.7-2`** (đầu nhánh `release/3.8.7`, PR #1). Tag `v3.8.7` và `v3.8.7-1` là các mốc cũ hơn | FB Desk 3.8.7 (đã gộp 3.8.6.3) + Post Research **0.2.24** trong `post-research/` |
| Quay lại bản trước khi gộp 3.8.7 | tag **`backup/main-2026-11-19-before-3.8.7`** | Đúng trạng thái `main` lúc 17:51 19/11/2026 (commit `f70da96`, bản 3.8.6.3 + log thống kê) |
| Bản 3.8.6.2 gốc | tag **`backup/3.8.6.2`** (commit `9e5483d`) | |

Chưa gộp vào `main` khi chưa có người duyệt. Kiểm tra trạng thái pull request của nhánh `release/3.8.7` trước khi giả định `main` đã có 3.8.7.

## Có gì trong 3.8.7 (so với 3.8.6.3)

FB Desk (thư mục gốc repo, `manifest.json` 3.8.7):

1. **Ghi nhận "Đã đăng" và đóng tab.** Sau khi bấm Đăng, bot chờ Facebook đóng hộp soạn (hết "Đang đăng/Đang tải lên"). Hộp soạn đóng mà không báo lỗi thì bài được ghi Đã đăng, kể cả khi chưa có link. Link được tìm lại sau, khi hàng chờ rảnh. Code: `facebook-bot.js` action `published`, `runner.js`.
2. **Album/video không bị cắt ngang.** Bot không chuyển trang đi tìm link khi bài còn đang gửi.
3. **Tìm link bài có emoji.** So khớp bỏ emoji (`published-link.js`); tác giả xác minh theo UID; caption ngắn khớp tuyệt đối.
4. **Video.** Media Bridge chuyển AV1/VP9 sang H.264 + AAC (`media-bridge.py`), và `/probe` trả caption công khai.
5. **Caption là chữ giao diện** ("Facebook", "của tác giả"): bài ảnh đăng không kèm chữ; Reel/video đọc lại caption thật qua Media Bridge (`scenario.js` `isUiCaption`, `automation.js` `runner-caption`).
6. **Đồng hồ xoay hẹn giờ** (`schedule-dial.js`), thay danh sách 3/5/10 phút. Quay để chọn giờ bắt đầu và khoảng cách bất kỳ (1 phút – 24 giờ). Bot không còn tự ép hàng chờ về 3 phút (`useThreeMinuteSchedule` đã bỏ). Bài kế tiếp được mở sớm tối đa 90 giây để chuẩn bị, rồi bấm Đăng đúng mốc. Runner nhận nhịp từ Web Worker (`runner-tick.js`).
7. **Chạy thử** (nút "Chạy thử" trên thẻ bài): bot làm đủ các bước tới trước nút Đăng rồi bỏ bản nháp, **không đăng**. Kết quả có nút "Tải cấu trúc giao diện" (JSON đã ẩn caption, tên nick và dãy số dài) để dựng test giống Facebook thật.
8. **Phân nhánh comment.** FB Desk đọc thụt lề Docs (18pt mỗi cấp) thành cấp phản hồi và gắn reply vào comment cha (`scenario.js` `htmlBlocks`, `cross-comment-model.js` `parseCommentLines`).

Post Research 0.2.23 (`post-research/`, extension riêng), kiểm tra trên bài thật của Nguyễn Tùng Giang ngày 19/11:
- **Phân nhánh comment:** Facebook đổi nút thành "Xem N câu trả lời", nên bản cũ không mở phản hồi và mọi comment nằm cấp 0. Đã nhận chữ "câu trả lời"; trên bài thật ra đúng cấp 0–3.
- **Vai Tác giả:** nhãn "Tác giả" giờ là chữ thường cạnh tên, không phải `aria-label`; trang ảnh không có hộp thoại "Bài viết của …". Nay nhận theo nhãn chữ hoặc UID chủ bài.
- **Caption lấy nhầm comment:** phản hồi dạng "X đáp lại phản hồi của Y" giờ được nhận là comment.
- **Thông tin nhân vật:** tên chủ trang lấy từ tiêu đề trang thay vì thẻ h1 đầu tiên (đã gây ra "Tên: Hoàng Quốc Việt"). **Chưa kiểm chứng** trên trang cá nhân thật, vì nick dùng để kiểm tra bị Facebook chặn xem trang cá nhân.

Post Research 0.2.24: đọc **Biệt danh**, mô tả kiểu "Người sáng tạo nội dung số", và avatar không còn bắt buộc nằm trước thẻ tên (chọn ảnh lớn nhất có nhãn trùng tên hoặc "ảnh đại diện"). Gộp thêm 2 cải tiến từ bản `E:\HQV\Post-Research-0_2_22` (16/11, một bản 0.2.22 **khác** bản trong repo): ảnh bìa cỡ gốc, và chỉ nhận đúng ảnh đại diện hiện tại. Lưu ý: từng có 2 bản cùng tên 0.2.22; bản trong repo là bản đã gộp cả hai.

Post Research 0.2.22:
- Loại chữ giao diện khỏi caption. Reel/video không có caption trong DOM thì dùng `og:description` của đúng trang đó.
- Bỏ nhãn "của tác giả", "người theo dõi" khỏi nội dung comment.
- Phân cấp comment đã kiểm tra trên 2 bài Facebook thật: đúng cấp, đúng comment cha.

Chi tiết: [CHANGELOG-3.8.7.md](CHANGELOG-3.8.7.md). Kiến trúc: [docs/FLOW.md](docs/FLOW.md).

## Chưa kiểm chứng trên Facebook thật

- Bước sau khi bấm Đăng (`published`) và việc album/video lên đủ. Nick đang chạy (UID 61578904126150) bị Facebook **tạm chặn** ngày 19/11, nên chưa đăng thử. Hãy dùng "Chạy thử" trước, sau đó thử 1 bài album + 1 bài video trên một nick khỏe đặt đối tượng "Chỉ mình tôi".
- Luồng Post Research ghi Docs mới rồi FB Desk đọc lại (mới test bằng HTML giả lập).

## Quy tắc khi sửa và đẩy mã

- **Không push thẳng `main`, không `--force`.** Tạo nhánh, mở pull request.
- Trước khi sửa: `git fetch`, xem `git log origin/main` để biết người khác vừa đẩy gì. Gộp bằng merge, không rebase nhánh người khác đang dùng.
- Đánh dấu chỗ sửa bằng comment kèm số phiên bản (ví dụ `// 3.8.7: ...`), để người khác gộp được.
- Không commit dữ liệu thật hoặc cấu hình riêng của máy (xem `.gitignore`): `media-bridge-config.json`, `media-native-host.json`, `*.exe`, danh bạ, CSV.
- Trước khi push, chạy đủ test bên dưới. Test có Playwright cần chạy `npm install --no-save playwright` và Chrome tại `C:/Program Files/Google/Chrome/Application/chrome.exe`.

```
node tests/fixes-387.mjs
node tests/dial-387.mjs
node tests/post-flow-387.mjs
node tests/post-flow-386.mjs
node tests/link-lookup-386.mjs
python tests/start-video.py
python tests/video-limit.py
python tests/video-health-origin.py
```

## Cập nhật extension đang chạy mà không mất dữ liệu

ID extension phụ thuộc đường dẫn thư mục. Chép đè tệp mới vào **đúng thư mục** Chrome đang nạp, bấm **Dừng bot**, rồi **Tải lại (↻)** trong `chrome://extensions`. Không Remove extension: làm vậy mất hàng chờ.
