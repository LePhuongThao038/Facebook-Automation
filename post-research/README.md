# Sổ nghiên cứu Facebook · bản thử
## Cài vào Chrome
1. Giải nén ZIP vào một thư mục cố định (hoặc dùng ngay thư mục Post-Research có sẵn).
2. Mở chrome://extensions trong profile Chrome đã đăng nhập Facebook. Bật Developer mode / Chế độ dành cho nhà phát triển. Chọn Load unpacked / Tải tiện ích đã giải nén và chọn thư mục chứa manifest.json.
3. Bấm biểu tượng **Sổ nghiên cứu Facebook**. Giữ tab công cụ và tab Facebook do nó mở trong lúc quét.

## Thử một bài hoặc cả profile
- Chọn số **bình luận / bài**: 20, 30 (mặc định), 50, tất cả hoặc một số nguyên từ 0 trở lên. Phản hồi cũng tính là một bình luận. Số 0 bỏ qua bình luận. “Tất cả” là tất cả bình luận Facebook tải được cho tài khoản đang xem; có thể lâu với bài lớn.
- Dán link bài, ảnh hoặc Reel rồi bấm **Quét link**. Với link profile, công cụ liệt kê theo từng lượt cuộn: tiêu đề, tối đa bốn câu đầu đang hiển thị và **Xem thêm trên Facebook**. Bấm **Quét thêm** để tìm tiếp, tick các bài rồi bấm **Bắt đầu**. Không mở từng bài, tải album, đọc bình luận hoặc gửi toàn bài cho AI ở bước chọn.
- Sau khi quét, tải **Word (.docx)** ngay. Có thể tải file lên Drive rồi mở bằng Google Docs; để tạo tài liệu Google gốc tự động, cấu hình bên dưới.
- Heading 1 cho từng Bài n; tiêu đề tối đa 14 từ, địa điểm nếu nhận diện được, nội dung, ảnh, video, comment có thụt cấp. Người viết bài trả lời dùng nhãn “Tác giả” khi nhận diện được. Cuối tài liệu có mục lục link Facebook. Chế độ tự động tạo file mới; chế độ thủ công ghi tiếp vào tài liệu đã chọn.
- Nội dung chỉ nằm trong tab công cụ cho đến khi bạn tải hoặc xuất. Tải lại hoặc đóng tab sẽ mất kết quả chưa lưu.

## AI đặt tiêu đề
**Gemini Nano trên Chrome**: chạy tại máy nếu Chrome đã có mô hình hỗ trợ ngôn ngữ yêu cầu. Đăng nhập Gemini không bật mô hình này. Khi không có AI phù hợp, công cụ báo rõ và dùng dòng mở đầu dưới 15 từ.
**Gemini API**: nhập key Google AI Studio và tên model mà key được phép dùng; key chỉ giữ trong tab. Công cụ gửi tối đa bốn câu mở đầu (tối đa 780 ký tự) mỗi bài, theo nhóm tối đa 15 bài; không gửi tên người bình luận, nội dung hội thoại hay ảnh. Có thể phát sinh phí theo tài khoản API.
**Meta AI qua tab chat**: chọn trước khi quét. Bấm “Chép yêu cầu và mở Meta AI”, dán và gửi trong tab Meta AI, chép câu trả lời JSON về rồi bấm “Áp dụng tiêu đề”. Tối đa 25 bài mỗi lượt; lặp lại cho lượt sau nếu cần. Đây là chế độ có người thao tác, không phải API. Extension không đọc cookie đăng nhập hoặc lịch sử trò chuyện. Nếu Meta yêu cầu đăng nhập tại meta.ai, làm theo giao diện của Meta. Có thể bỏ qua bước này và xuất với tiêu đề từ dòng đầu.
**Không dùng AI**: tiêu đề từ phần mở đầu. Nội dung gốc và bình luận luôn lấy trực tiếp từ trang.

## Tạo Google Docs và lưu video tự động (cấu hình một lần)
1. Trong [Google Cloud Console](https://console.cloud.google.com/), tạo/chọn một project, bật **Google Drive API** và **Google Docs API**. Trong Google Auth Platform, thiết lập Branding/Audience; nếu ở chế độ Testing, thêm email của bạn vào Test users.
2. Trong Clients, tạo **OAuth client ID → Chrome Extension**, nhập ID cố định của extension: **eohaljnaeegaegeplcanfklhaoafhhcm**. Không tạo Web Client; không cần client secret.
3. Trong Data Access thêm scope theo nhu cầu. Chỉ tạo Docs: `https://www.googleapis.com/auth/drive.file`. Nếu muốn lưu video vào **thư mục Alex Hoàng đã tồn tại**, dùng `https://www.googleapis.com/auth/drive` (quyền toàn Drive; chỉ bật nếu bạn chấp nhận). Quyền hẹp có thể không thấy thư mục đã tồn tại.
4. Mở PowerShell ngay trong thư mục extension và chạy:
   `powershell -NoProfile -ExecutionPolicy Bypass -File .\configure-drive.ps1 -ClientId "CLIENT_ID_CUA_BAN"`
   Nếu dùng thư mục video có sẵn, thêm `-ExistingVideoFolder` vào cuối lệnh. Lệnh chỉ cập nhật manifest của extension.
5. Trong chrome://extensions bấm **Reload**, đóng và mở lại tab extension. Chọn **Kết nối Google Drive**. Bản chưa cấu hình OAuth vẫn quét và tải Word được.
6. **Tự động**: chọn thư mục có quyền ghi (hoặc “Drive của tôi”). Nút tải danh sách duyệt các thư mục mà ứng dụng nhìn thấy. Video và tài liệu mới cùng lưu ở đích này; chỉ video được bật chia sẻ qua liên kết. Muốn thấy các thư mục có sẵn trong Drive, dùng cấu hình `-ExistingVideoFolder` ở bước 4.
7. **Thủ công**: dùng cùng cấu hình `-ExistingVideoFolder` cho thư mục và Docs có sẵn. Dán link thư mục video và link Docs; có thể dùng link trỏ đến một tab cụ thể. Cấp quyền thêm tệp cho tài khoản kết nối ở thư mục, và quyền sửa ở tài liệu (quyền sửa qua link hoặc chia sẻ trực tiếp). Dán link không thay thế bước đăng nhập Google. Công cụ kiểm tra cả hai đích trước khi xuất. Khi Docs đã có mục lục nguồn dạng Heading 1 như file xuất trước, các bài mới được chèn trước mục lục và các nguồn mới được thêm ở cuối. Nếu Docs đang được người khác sửa đồng thời, yêu cầu ghi sẽ dừng để tránh làm sai vị trí. Ảnh nhúng được chuyển qua một tài liệu tạm riêng tư và tài liệu tạm được đưa vào thùng rác sau khi xử lý.

## Chọn bài trên profile
Lưới 3 cột trên máy tính, 2 hoặc 1 cột trên cửa sổ hẹp. Click vào ô hoặc checkbox để chọn; link xem bài hoạt động riêng. **Chọn tất cả** chọn các bài đang hiển thị. **Quét thêm 30 bài** giữ nguyên lựa chọn cũ. Nếu Facebook chưa công bố tổng số bài, bộ đếm ghi `30/?`; khi xác nhận hết danh sách, bộ đếm ghi tổng thực tế như `20/20`. Nếu bảng tin bị chậm hoặc dừng tải, có thể bấm quét thêm để thử tiếp.

## Giới hạn bản thử
Facebook thay đổi giao diện theo tài khoản, ngôn ngữ và loại bài. Bộ đọc ưu tiên Facebook desktop tiếng Việt/Anh. Bài bị ẩn, album lớn, phản hồi bị lọc, bài không có đoạn chữ công khai trên profile hoặc Reel thiếu URL video có thể không thu đủ. Tài khoản phải có quyền xem; công cụ không mở khoá dữ liệu bị hạn chế. Extension mở và cuộn tab để đọc, không đăng bài, bình luận hoặc nhắn tin Facebook.


### Khôi phục bằng GPT-6 Astra (Windows)

Cần Node.js 20 trở lên và khóa OpenAI API của dự án có quyền gọi gpt-6-astra. Trong thư mục extension, chạy `powershell -NoProfile -File .\Start-Astra.ps1`, nhập khóa ở lời nhắc ẩn rồi giữ cửa sổ mở trong lúc quét. Nếu đã đặt OPENAI_API_KEY, trình kết nối dùng biến môi trường này. Tải lại extension trong chrome://extensions sau khi cập nhật và mở lại giao diện quét.

Sau ba lần khôi phục liên tiếp vẫn chưa có liên kết mới, extension gửi số bài, số lần thử, trạng thái phản hồi của tab và việc có mốc ngày hay không tới trình kết nối trên máy. Một lần kẹt chỉ gọi Astra một lần. Khi tìm thấy liên kết mới, bộ đếm bắt đầu lại. Nếu Astra không khả dụng, danh sách và ô đã chọn vẫn dùng được trong tab hiện tại.

### Video Facebook

Trong Windows, chạy Start-Video.cmd rồi giữ cửa sổ mở. Lần đầu cần Python 3.10+ và Internet để cài yt-dlp cùng FFmpeg vào thư mục riêng. Sau khi đọc bài, chọn “Tải video” bên dưới kết quả để lưu về máy. Khi đã kết nối Drive, quá trình xuất Docs tự thử tải video, đưa vào thư mục đã chọn và chèn liên kết vào tài liệu. Bài yêu cầu đăng nhập có thể chỉ còn link xem nếu Chrome không cung cấp tệp trực tiếp. Trình hỗ trợ chỉ đọc link Facebook công khai, không dùng cookie tài khoản.


## Khớp định dạng với Facebook Desk (v0.2.18)
Tài liệu xuất ra được Facebook Desk đọc lại làm nguồn đăng bài, nên cấu trúc mỗi bài phải khớp bộ đọc của Desk:
- Heading 1 đúng dạng `Bài n` (không thêm chữ phía sau), kế tiếp là `Tiêu đề:`, `Địa điểm:`, `Nội dung bài:`, ảnh, video, rồi `Comment:`.
- **Video**: nếu đã có bản trên Drive, dòng video là `Video: Google Drive` kèm hyperlink tới file Drive, và Desk nhận đúng là video của bài. Nếu chưa có bản Drive, dòng được ghi là `Ghi chú AI: Video chưa có bản Drive, xem tại <link Facebook>`; Desk đưa dòng này vào ghi chú của bài, không chèn vào nội dung đăng và không coi là video. Trước v0.2.18 dòng video là “Video trên Google Drive / Video trên Facebook”, Desk không nhận ra nên link nằm lẫn trong nội dung bài.
- **Số bài không trùng (v0.2.19)**: khi chọn comment “cả hai”, Phần 2 đánh số nối tiếp (Bài 31, 32, …) thay vì lặp lại Bài 1, 2, …. Trước đó Desk báo “Có nhiều mục Bài 1 trùng nhau” và không đọc được tài liệu. Mục lục cuối file vẫn chỉ liệt kê các bài gốc.
- Áp dụng đồng bộ cho cả ba đường xuất: Word (doc.js), dán vào Docs (destination.js, bản HTML) và ghi Docs qua API (destination.js).

Lưu ý còn lại khi dùng chung với Desk (chưa đổi, vì liên quan cách Desk đọc):
- Mục “Mục lục bài gốc” ở cuối file bị Desk đọc thành vài dòng comment của bài cuối. Chỉ ảnh hưởng hiển thị trong Desk.
- Mục “Thông tin nhân vật” đứng trước Bài 1 được Desk coi là ngữ cảnh lịch chung.
- Chế độ comment “cả hai” cho ra gấp đôi số bài (Phần 2 là bản trùng nội dung, khác kiểu comment), nên Desk hiện đủ cả hai bộ. Dùng với Desk thì nên chọn một kiểu comment.
