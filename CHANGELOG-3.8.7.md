# FB Desk 3.8.7: sửa 6 lỗi từ lượt chạy thật ngày 19/11

Ngày 19/11/2026 · manifest 3.8.7 · cập nhật tại chỗ. Cần **Tải lại** extension trong `chrome://extensions`.

Nguồn phân tích: dữ liệu `deskV2` của Profile 7 (UID 61578904126150) sau 23 lượt đăng. Trong đó có 1 bài thành công, 9 bài "cần đối soát", 6 bài video lỗi Media Bridge. Các lần bắt đầu cách nhau 4–8 phút dù đã chọn 3 phút.

| # | Lỗi | Nguyên nhân tìm được | Sửa |
|---|---|---|---|
| 1 | Bài đã lên nhưng không tự đóng tab, không ghi "Đã đăng" | Facebook vẽ emoji bằng `<img alt>`, nên chữ đọc được của bài trên trang không có emoji. Hầu hết caption có emoji, nên bước tìm link luôn báo "khớp chữ=0". Ngoài ra nick liên kết tên "UID …" nên bước kiểm tra tác giả theo tên cũng luôn trượt. Không có link thì bài sang "cần đối soát" và tab được giữ lại. | So khớp sau khi bỏ emoji ở cả hai phía. Tác giả xác minh theo UID. Caption ngắn (dưới 12 ký tự) được tìm nếu trùng khớp hoàn toàn. Sau khi bấm Đăng, bot chờ Facebook **đóng hộp soạn** mà không báo lỗi, khi đó bài được ghi **Đã đăng** và tab được đóng. Nếu chưa có link, link được tìm lại khi hàng chờ rảnh. |
| 2 | Album nhiều ảnh không lên | 12 giây sau khi bấm Đăng, bot chuyển tab sang trang cá nhân để tìm link. Lúc đó album vẫn đang gửi ("Đang đăng…"), nên việc chuyển trang cắt ngang bài. | Không rời trang tới khi hộp soạn đóng và hết thông báo "Đang đăng / Đang tải lên" (tối đa 3 phút cho ảnh, 10 phút cho video). Đếm media thêm theo nhãn "Ảnh/video, đã thêm N" của Facebook. |
| 3 | Không đăng được video | (a) Media Bridge chưa được cài/ghép ID: "Failed to fetch". (b) Video Facebook tải về đang dùng mã AV1/VP9 (kể cả bản hd/sd). (c) Giống album, tab bị chuyển đi khi video còn đang tải lên. | Đã cài native host + Media Bridge cho ID `kmanmpkdflcibpijninobefginbflakp`. Bridge tự chuyển video không phải H.264 sang H.264 + AAC, giữ nguyên độ phân giải. `Start-Media.ps1` không còn dừng vì cảnh báo của venv trên PowerShell 5.1. Bot chờ video tải lên xong mới rời trang. |
| 4 | Không ra caption | Ở trang Reel, Post Research không có khối caption kiểu bài thường nên lấy khối chữ đầu tiên, tức chữ "Facebook" của giao diện. Ví dụ Reel 1640085867682202 có caption thật "Clean girlll ✨ #hiennho". | **FB Desk:** caption Reel/video chỉ là chữ giao diện thì runner đọc lại caption công khai qua Media Bridge (`/probe`, yt-dlp) rồi lọc hashtag/tên như bình thường. Không đọc được thì dừng trước khi đăng. **Post Research 0.2.22:** loại các chữ giao diện khỏi caption. Ở trang Reel/video không có caption trong DOM, dùng `og:description` của đúng trang đó. |
| 5 | Caption "Facebook" tự sinh khi bài gốc không có caption | Cùng nguyên nhân với #4. Bài ảnh không caption còn bị lấy nhãn "của tác giả". | Bài ảnh có caption là chữ giao diện được đăng như bài chỉ có ảnh. Caption người dùng tự sửa thì giữ nguyên. |
| 6 | Chọn 3 phút nhưng chạy 5 phút | (a) Tab "Bot đang chạy" nằm sau tab Facebook nên Chrome hãm timer còn 1 lần/phút; mọi lượt đều bắt đầu ở giây :52. (b) 3 phút được tính từ lần bấm Đăng trước tới lúc **bắt đầu mở** bài sau, cộng thêm 30–60 giây chuẩn bị. (c) Bước tìm link cho các bài "cần đối soát" chạy mỗi phút, tối đa 3 bài, giữ khóa và chặn runner. | Runner nhận nhịp từ Web Worker (không bị hãm). Bài kế tiếp được mở sớm tối đa 90 giây để chuẩn bị, nút Đăng được giữ tới đúng mốc 3 phút kể từ lần đăng trước. Tìm link chỉ chạy khi không có bài nào sắp tới lượt trong 4 phút, mỗi lần 1 bài. |

## Phân nhánh comment (bổ sung cùng ngày)

Đã kiểm tra trên 2 bài thật bằng logic quét của Post Research 0.2.22. Facebook hiện gắn nhãn "Bình luận dưới tên X" cho comment gốc, "Phản hồi bình luận của X dưới tên Y" cho phản hồi cấp 1 và "X đáp lại phản hồi của Y" cho cấp 2. Các comment nằm phẳng trong DOM.

| Lỗi có thể gặp | Kết quả kiểm tra | Sửa |
|---|---|---|
| Phản hồi bị dàn phẳng ở Post Research | **Không mắc:** ra đúng cấp 0/1/2 | Không cần |
| Phản hồi gắn nhầm comment khác | **Không mắc:** ví dụ Tạ Quang Ninh → Trường Giang, Pham Huyen Trang → Hiền Nhỏ → Pham Huyen Trang | Không cần |
| FB Desk không đọc thụt lề trong Docs | **Có mắc:** FB Desk đọc comment thành chữ phẳng, nên reply của tác giả luôn báo "Docs không ghi rõ tác giả đang reply cho ai" | `htmlBlocks` đọc `margin-left`/`padding-left` (18pt mỗi cấp) thành `depth`. Bài lưu thêm `commentDepths`. `parseCommentLines` gắn reply cấp d vào dòng gần nhất phía trên có cấp d-1. Docs cũ không có thụt lề thì giữ hành vi cũ. Khi đọc lại Docs, bài đã có sẵn được bổ sung `commentDepths` nếu nội dung comment không đổi. |
| Nhãn "của tác giả" lọt vào nội dung comment | Có mắc (Post Research) | Post Research 0.2.22 bỏ các nhãn "của tác giả", "người theo dõi" khỏi nội dung comment |

**Chưa kiểm tra:** một lượt Post Research thật ghi ra Docs mới, rồi FB Desk đọc lại Docs đó. Test hiện mô phỏng HTML Docs có thụt lề 18pt/36pt.

## Đồng hồ xoay hẹn giờ (thay cơ chế 3/5/10 phút)

- Ô "Tần suất đăng" (3 phút, 5 phút, 10 phút, 15 phút, 1 tiếng, 5 tiếng, Tùy chỉnh) được thay bằng **một đồng hồ xoay** (`schedule-dial.js`).
  - **Giờ bắt đầu:** kim chạy như đồng hồ thật, mỗi vòng 60 phút; quay qua số 12 thì sang giờ kế. Không quay lùi về quá khứ; nút "Về ngay bây giờ".
  - **Khoảng cách:** quay tự do từ 1 phút tới 24 giờ, mỗi vòng 60 phút.
  - Điều khiển bằng kéo quanh mặt đồng hồ, cuộn chuột (giữ Shift = 10 phút), hoặc phím mũi tên / PageUp / PageDown / Home.
  - Bên cạnh hiện trước giờ đăng của các bài sắp xếp, ví dụ "5 bài · Bắt đầu hôm nay 10:45, mỗi bài cách 5 phút → 10:45 · 10:50 · 10:55 · 11:00 …".
- `bot-enqueue` nhận thêm `startAt`. `assignSlots` bắt đầu từ giờ đó.
- Đã bỏ `useThreeMinuteSchedule`, cơ chế của 3.8.6 tự dời mọi bài chờ về cách nhau 3 phút. Lịch người dùng quay trên đồng hồ được giữ nguyên.
- Khoảng cách tối thiểu giữa hai lần bấm Đăng vẫn được giữ đúng giá trị đã chọn: bài mở sớm để chuẩn bị, rồi nút Đăng chờ đúng mốc.

## Chạy thử (không đăng)

- Nút **Chạy thử** trên thẻ bài: bot làm đủ các bước như lượt thật (mở ô soạn, điền nội dung, tải album/video, kiểm tra nút Đăng), rồi dừng **trước** khi bấm Đăng.
- Bot chụp cấu trúc hộp soạn (`desk.ui-snapshot/1`): nút, nhãn, số ảnh/video, kích thước, trạng thái nút Đăng. Caption, tên nick và dãy số dài được thay bằng nhãn ẩn. Bản chụp tải về được bằng nút "Tải cấu trúc giao diện".
- Sau đó bot bấm Đóng → **Bỏ** bản nháp, và bài quay lại "Chờ chuẩn bị". Background chặn mọi lượt chạy thử có dấu vết bấm Đăng.

## Gộp với 3.8.6.3

Nhánh này đã gộp `main` (3.8.6.3 của LePhuongThao038 + log thống kê) mà không bỏ thay đổi nào. Ở phần đếm ảnh, giữ cách đếm theo `src` và kiểm tra "+N" phải đè lên ảnh của 3.8.6.3, cộng thêm nhãn "Ảnh/video, đã thêm N" của 3.8.7. Media Bridge giữ thứ tự ưu tiên hd/sd của 3.8.6.3; thực tế có Reel mà bản hd cũng là AV1, và 3.8.7 tự chuyển sang H.264 nên vẫn an toàn.

## Post Research 0.2.23 (19/11, theo Docs của Nguyễn Tùng Giang)

Docs mẫu bị các lỗi sau: không có thụt lề, chủ trang bị gắn vai "Bạn nam 1", Bài 9 lấy nhầm comment làm caption, phần thông tin nhân vật sai tên ("Hoàng Quốc Việt") và không có avatar hay ảnh bìa.

| Lỗi | Nguyên nhân (kiểm tra trên trang thật) | Sửa |
|---|---|---|
| Không thụt lề, không phân nhánh | Facebook ghi nút "Xem 3 câu trả lời"; bản quét chỉ bấm nút có chữ "phản hồi/replies" nên phản hồi không được mở | Nhận thêm "câu trả lời". Trên trang thật ra đúng cấp 0–3 |
| Chủ trang thành "Bạn nam 1" | Trang ảnh không có hộp thoại "Bài viết của …"; nhãn "Tác giả" là chữ thường, không phải `aria-label` | Nhận vai Tác giả theo nhãn chữ hoặc UID chủ bài |
| Caption là một comment | Phản hồi "X đáp lại phản hồi của Y" không bị nhận là comment | Nhận đúng là comment; Bài 9 ra caption thật |
| Tên nhân vật sai, thiếu avatar và ảnh bìa | Tên lấy từ thẻ h1 đầu tiên, có thể là tên nick đang đăng nhập; avatar chỉ được nhận khi nhãn ảnh trùng tên đó | Tên lấy từ tiêu đề trang; tìm ảnh cả ngoài `[role=main]`. **Chưa kiểm chứng** trên trang cá nhân thật |

## Nguyên tắc an toàn giữ nguyên

- Không bao giờ bấm Đăng lần hai. "Đã đăng" chỉ được ghi sau khi đã bấm Đăng **và** Facebook đóng hộp soạn mà không báo lỗi.
- Facebook báo "Không thể đăng" hoặc hộp soạn không đóng thì bài sang "Cần đối soát" và tab được giữ lại để kiểm tra.
- Khoảng cách tối thiểu giữa hai lần bấm Đăng vẫn là 3 phút (chế độ mặc định).

## Kiểm thử

```
node tests/fixes-387.mjs          # nhịp đăng, caption chữ giao diện, phân nhánh comment
node tests/dial-387.mjs           # đồng hồ xoay (Playwright)
node tests/post-flow-387.mjs      # chờ hộp soạn đóng, báo lỗi sau khi đăng, tìm link có emoji, thụt lề Docs, chạy thử (Playwright)
node tests/post-flow-386.mjs      # 11 kịch bản cũ vẫn đạt
node tests/link-lookup-386.mjs    # 5 kịch bản cũ vẫn đạt
python tests/start-video.py; python tests/video-limit.py; python tests/video-health-origin.py
```

Đã thử thật với Media Bridge trên máy này: 2 Reel trong hàng chờ dựng ra MP4 H.264 trong 10–14 giây, và `/probe` trả đúng caption gốc. **Chưa** chạy lượt đăng thật nào trên Facebook với bản 3.8.7.
