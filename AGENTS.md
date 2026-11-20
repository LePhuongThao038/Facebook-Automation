# Đọc trước khi lấy mã (cho agent và đồng nghiệp)

> ⚠️ **Cập nhật FB Desk: KHÔNG Load unpacked một thư mục mới.** Làm vậy Chrome tạo ID extension mới: hàng chờ và tiến độ trống, Media Bridge và bộ lưu CSV từ chối ID. Hãy chép đè vào **đúng thư mục Chrome đang nạp** bằng `Update-InPlace.ps1` (xem trước với `-Preview`, có sao lưu và tự phục hồi khi lỗi), rồi bấm ↻ trong `chrome://extensions`:
> ```
> powershell -ExecutionPolicy Bypass -File Update-InPlace.ps1 -Target "<thư mục Chrome đang nạp>" -Preview
> powershell -ExecutionPolicy Bypass -File Update-InPlace.ps1 -Target "<thư mục Chrome đang nạp>"
> ```
> Đường dẫn đang nạp xem ở `chrome://extensions` → Chi tiết → "Đã tải từ". Nếu đã lỡ cài ra ID mới, chạy `Install-Start-Video.cmd` với ID mới (script giờ ghép ID vào cả `media-native-host.json` và `media-bridge-config.json`).


> **Kết quả sửa 6 lỗi của báo cáo 20/11:** [docs/KET-QUA-SUA-6-LOI-3.8.7.md](docs/KET-QUA-SUA-6-LOI-3.8.7.md). Có một điểm chờ người dùng quyết định (ghi "Đã đăng" khi hộp soạn đóng mà chưa có link).

> **Báo cáo mới từ máy vận hành (20/11/2026):** 3.8.7 chạy thật còn 6 lỗi (video trong bài nhiều media, caption lấy nhầm comment, cài làm đổi ID…). Đọc [docs/BAO-CAO-VAN-HANH-3.8.7-2026-11-20.md](docs/BAO-CAO-VAN-HANH-3.8.7-2026-11-20.md) trước khi sửa tiếp.


Repo này có nhiều người và nhiều agent cùng đẩy mã. Đọc hết trang này trước khi pull, sửa hoặc push.

## Lấy bản nào

| Mục đích | Lấy | Ghi chú |
|---|---|---|
| **Bản mới nhất đã gộp đủ tính năng** | tag **`v3.8.7-4`** (đầu nhánh `release/3.8.7`, PR #1): FB Desk 3.8.7 (sửa 6 lỗi vận hành) + **Post Research 0.2.26**. Các tag `v3.8.7` … `v3.8.7-3` là mốc cũ hơn | FB Desk 3.8.7 (đã gộp 3.8.6.3) + Post Research **0.2.26** trong `post-research/` |
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

**Post Research 0.2.26 (20/11, người dùng đã xác nhận Docs mới đúng):** câu trả lời bình luận và thụt lề xuất hiện trong Docs. Nguyên nhân gốc: khóa chống trùng làm mọi câu trả lời trùng với bình luận cha và bị bỏ (có từ mã gốc). Gồm cả: mở "Xem N câu trả lời", dựng cây theo thứ tự trang, giới hạn theo comment gốc, đưa tab Facebook lên trước khi đọc, link riêng từng video, caption trang ảnh, cờ caption nghi là trả lời bình luận.

**Quy tắc phiên bản:** chỉ tăng số phiên bản sau khi vấn đề người dùng báo đã được xác nhận khắc phục. Đang sửa thì giữ nguyên số.

Post Research 0.2.25 (chưa tăng số, chờ người dùng xác nhận Docs mới): **cây bình luận dựng lại theo đúng thứ tự trên trang** mỗi lượt đọc; giới hạn tính theo số comment GỐC; luôn mở mọi "Xem N câu trả lời / Xem 1 phản hồi" của các comment gốc được lấy. Bản trước ngừng mở phản hồi khi đủ N comment, và nối phản hồi vào cuối danh sách. Đã kiểm tra trên bài thật của Giang: chuỗi Ngô Mai Phương ↔ Tác giả ra đủ 5 cấp, đúng thứ tự.

Post Research 0.2.25, **kiểm tra trên trang cá nhân thật của Nguyễn Tùng Giang**: trang không có thẻ h1 và tiêu đề chỉ là "Facebook", nên bản cũ không đọc được tên, kéo theo mất avatar. Nay tên lấy từ nhãn avatar lớn ở đầu trang. Biệt danh, hạng mục và ngày tham gia lấy từ hộp "Giới thiệu về …", mở bằng cách bấm vào tên rồi đóng lại. Kết quả: Tên, Biệt danh "Giang", Mô tả "Người sáng tạo nội dung số", Sống tại, Avatar và Ảnh bìa đều có. Ngày sinh và tình trạng hôn nhân của trang này không công khai.

Post Research 0.2.24: đọc **Biệt danh**, mô tả kiểu "Người sáng tạo nội dung số", và avatar không còn bắt buộc nằm trước thẻ tên (chọn ảnh lớn nhất có nhãn trùng tên hoặc "ảnh đại diện"). Gộp thêm 2 cải tiến từ bản `E:\HQV\Post-Research-0_2_22` (16/11, một bản 0.2.22 **khác** bản trong repo): ảnh bìa cỡ gốc, và chỉ nhận đúng ảnh đại diện hiện tại. Lưu ý: từng có 2 bản cùng tên 0.2.22; bản trong repo là bản đã gộp cả hai.

Post Research 0.2.22:
- Loại chữ giao diện khỏi caption. Reel/video không có caption trong DOM thì dùng `og:description` của đúng trang đó.
- Bỏ nhãn "của tác giả", "người theo dõi" khỏi nội dung comment.
- Phân cấp comment đã kiểm tra trên 2 bài Facebook thật: đúng cấp, đúng comment cha.

Chi tiết: [CHANGELOG-3.8.7.md](CHANGELOG-3.8.7.md). Kiến trúc: [docs/FLOW.md](docs/FLOW.md).

## Chưa kiểm chứng trên Facebook thật

- Bước sau khi bấm Đăng (`published`) và việc album/video lên đủ. Nick đang chạy (UID 61578904126150) bị Facebook **tạm chặn** ngày 19/11, nên chưa đăng thử. Hãy dùng "Chạy thử" trước, sau đó thử 1 bài album + 1 bài video trên một nick khỏe đặt đối tượng "Chỉ mình tôi".
- Luồng Post Research ghi Docs mới rồi FB Desk đọc lại (mới test bằng HTML giả lập).

## Pain point chưa khắc phục: bio và Story/Highlight

- **Cào thông tin nhân vật/bio chưa đủ sạch.** Trường Trang cá nhân có thể có Giới thiệu, Trang/Trò chơi điện tử, Vị trí, website, liên kết Twitch/YouTube, thời gian hoạt động, hạng mục, thành viên và các thông tin khác. Code hiện chỉ trích một tập trường cố định; screenshot thật có thể vẫn xuất "Chưa thấy". Agent sửa phải đọc toàn bộ hộp/Giới thiệu/Details, chống trùng, nhận cả liên kết và năm hoạt động, không bịa dữ liệu từ UI.
- **Bio: đã sửa (20/11, chờ người dùng xác nhận, chưa tăng số).** Nguyên nhân: Facebook chuyển trang Giới thiệu của cả trang cá nhân lẫn Page sang các tab con `directory_*` (Giới thiệu, Hạng mục, Thông tin cá nhân, Công việc, Học vấn, Tên, Chi tiết, Liên kết, Thông tin liên hệ); các đường dẫn `about_*` cũ không còn nội dung. `character.js` nay mở `/about`, đọc lần lượt mọi tab con (`readAboutTabs`, `readAboutPanel`), chỉ lấy khung nội dung (không lẫn Reels), ghép nhãn phụ như năm làm việc hoặc loại tên vào giá trị, chống trùng, lấy link thật qua `l.php`. Các trường cố định còn trống được điền từ đó (`fillFromAbout`). Toàn bộ được xuất thêm ở khối "Giới thiệu đầy đủ" trong Docs (FB Desk bỏ qua phần Thông tin nhân vật). Đã chạy trên trang thật 23 Dota TV và Nguyễn Yến. Test: `tests/research-profile-0226.mjs`.
- **Bài nhiều media bị lấy link theo ảnh đầu: đã sửa (20/11).** Dòng thời gian có lúc chỉ cho link `/photo/?fbid=` (Docs 23 Dota TV bài 10: chỉ có ảnh, mất video, caption ra "Ảnh này nằm trong một bài viết."). `recovery.js` nay thấy trang ảnh có "Xem bài viết" thì đọc bài gốc, và Docs ghi Mã nguồn là link bài gốc.
- **Story/Highlight: CHƯA làm.** Chưa có trang mẫu thật có Tin nổi bật để soi giao diện trình xem (trang Nguyễn Yến, Mark Zuckerberg không có). Lưu ý: Story Archive chỉ chủ nick xem được; mở Story đang hiện của người khác sẽ để lại lượt xem.
- **Chưa có cơ chế cào Story/Highlight ở Post Research.** Chưa kiểm chứng luồng mở từng Highlight, duyệt từng slide, lưu thứ tự slide, nhận ảnh/video riêng và xuất Docs. `character.js` hiện chỉ lấy thumbnail của `Tin nổi bật`; không mở từng Story/Highlight để đọc media. Không coi tin nổi bật, story đang hiện và story archive là một bài.
- Khi làm, tách rõ: **Story đang hiện (24 giờ)**, **Story Archive sau hết hạn**, **Highlight/album nổi bật** và nguồn media của từng slide. Ghi link/ID, thứ tự, ngày giờ, loại ảnh/video và trạng thái truy cập. Không gom mã của cột đề xuất/gợi ý hoặc bài khác vào Media JSON.
- Dữ liệu profile/Story thực tế cần test bằng Playwright trên Facebook thật, không chỉ test DOM giả lập.

## Đăng Story (FB Desk, 20/11, chưa chạy trên Facebook thật)

Vùng riêng: tab **04 Đăng Story** (`story-ui.js`), dữ liệu `d.stories`, tệp trong IndexedDB `desk-story-files` (`story-files.js`), mô hình `story-model.js`, lượt chạy `kind:'story'` (nhánh riêng trong `runner.js`, các bước `story-*` trong `facebook-bot.js`, lệnh `bot-story-schedule`/`bot-story-confirm` trong `automation.js`, `story-list/add/remove/move` trong `background.js`). Dùng chung hàng chờ, giãn cách bấm, kiểm tra UID và `bot-permit` với bài viết; không đụng luồng bài viết. Chi tiết và việc cần kiểm chứng: [CHANGELOG-3.8.7.md](CHANGELOG-3.8.7.md).

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
