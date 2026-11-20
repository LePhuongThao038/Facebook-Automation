# Đề xuất sửa sáu lỗi vận hành FB Desk 3.8.7

Bản chờ duyệt ngày 20/11/2026. Đích dự kiến là `release/3.8.7`. Đối chiếu báo cáo vận hành và mã nguồn tại tham chiếu cục bộ `origin/release/3.8.7`, commit `3d2eaeb`. Checkout hiện tại là `main`. Báo cáo khảo sát 24 bài của một nick trên 3.8.7, gồm 23 nháp và 1 lỗi. Log nhiều nick trên main thuộc đợt trước.

### 1. Bài 6 có bốn ảnh và một video nhưng Bridge nhận URL của cả bài

**Đề xuất.** Post Research lưu hai trường riêng: permalink bài gốc và URL của từng video. Chỉ lấy URL video từ đúng mục đính kèm. Với hai video, mỗi mục phải có bằng chứng liên kết với một video riêng. FB Desk kiểm tra từ lúc nhập và kiểm tra lại khi xếp một bài cũ. Cho phép nguồn cũ nếu xác định được duy nhất video của mục đó. Nếu mơ hồ, báo số bài, vị trí tệp và cho cập nhật riêng mục video. Giữ nguyên bốn ảnh và lịch sử.

**Nghiệm thu.** Dùng bài 6, một bài có hai video và một Reel chuẩn. Mỗi video phải dựng đúng tệp. URL chưa phân giải phải dừng trước khi gọi Bridge. Chạy lại ca Reel H.264 mà báo cáo đã xác nhận thành công.

### 2. Bài 5 và 7 dùng lời trả lời bình luận làm caption

**Đề xuất.** Post Research chỉ đọc vùng nội dung chính gắn với bài gốc, loại cây bình luận và trả lời ngay cả khi người viết là chủ bài. Ghi phiên bản bộ quét và căn cứ lấy caption vào dữ liệu xuất. Chưa rõ phiên bản đã tạo hai bài cũ, nên sửa bộ quét phải đi kèm chức năng đọc lại caption theo permalink và chỉ cập nhật bài chưa gửi. Tên người bình luận đứng đầu câu là dấu hiệu để kiểm tra lại, chưa đủ để kết luận sai. Nếu xác minh được bài thật sự chỉ có media, áp dụng luồng đăng không caption hiện có.

**Nghiệm thu.** Hai reply mẫu không xuất hiện trong caption sau khi đọc lại. Một caption thật mở đầu bằng tên người vẫn được giữ. Số bình luận, media và tiến độ đã đăng khớp trước và sau sửa.

### 3. Cài từ thư mục mới làm đổi ID và mất kết nối native

**Đề xuất.** Đặt hướng dẫn cập nhật tại chỗ ở đầu README và AGENTS. Thêm script có chế độ xem trước, xác minh thư mục Chrome đang nạp và đích junction, sao lưu các tệp sắp sửa, chỉ cập nhật danh sách tệp phát hành và phục hồi nếu lỗi giữa chừng. Giữ cấu hình máy, không gỡ bản cũ. Bước ghép native host và Bridge nhận ID đầy đủ từ dashboard, bổ sung đúng ID vào danh sách hiện có, kiểm tra bằng một lần ghi/đọc CSV thử và yêu cầu health từ origin thực. Với profile đã đổi ID, chọn quay lại bản cài cũ còn dữ liệu hoặc nhập CSV đã đối chiếu. Không tự hợp nhất hai hàng chờ.

**Nghiệm thu.** Trên profile thử, đối chiếu ID, số bài, trạng thái đã gửi/cần đối soát và cấu hình trước/sau. Chạy cập nhật hai lần và giả lập lỗi sao chép giữa chừng. Không chạy cập nhật trong lúc có tác vụ đăng.

### 4. Bài 2, 4, 10, 13 có caption rút gọn

**Đề xuất.** Trong đúng vùng caption, bấm “Xem thêm” hoặc “See more”, chờ nội dung thực sự thay đổi rồi đọc lại với giới hạn thời gian. Nếu vẫn thiếu, mở permalink đúng bài và kiểm tra lại vùng caption. Chỉ lấy mô tả metadata khi khớp bài và có bằng chứng là nội dung đầy đủ. Dấu ba chấm có thể do tác giả viết. Dựa thêm vào nút mở rộng, trạng thái hiển thị và văn bản trước/sau. Đọc lại riêng bốn caption cũ, giữ nguyên tiến độ.

**Nghiệm thu.** Đối chiếu nguyên văn từng bài với nội dung đã mở rộng. Thử thêm caption kết thúc bằng dấu ba chấm thật và bài không mở rộng được. Trường hợp cuối phải giữ cờ rút gọn và lý do cụ thể.

### 5. Dashboard 3.8.7 hiển thị RC11

**Đề xuất.** Lấy phiên bản thực từ manifest cho tiêu đề, thông tin build và CSV chẩn đoán. Giữ họ tên nick đứng đầu tiêu đề khi đã nhận diện. Nếu cần cảnh báo giao diện cũ sau cập nhật, đối chiếu mã build của giao diện với mã build service worker được sinh lúc đóng gói. Chỉ đọc cùng một manifest hai lần không phát hiện được tab cũ.

**Nghiệm thu.** Mở mới, tải lại và giữ một dashboard cũ qua lần cập nhật. Tab mới và gói ZIP hiển thị đúng phiên bản, tab cũ được yêu cầu mở lại khi có bằng chứng lệch build.

### 6. CSV của Trần Thu An mang tên “Chưa xác định tên”

**Đề xuất.** Với UID 61593376541721, đối chiếu danh bạ của máy vận hành đã ghi tên Trần Thu An. Kiểm tra tài nguyên danh bạ thực sự có trong ZIP và đọc được. Khi tên tài khoản chỉ là “UID …”, tra theo UID trong danh bạ profile, rồi tới danh bạ đi kèm. Nếu chưa có kết quả, cho lưu tên hiển thị cục bộ gắn với UID. Dùng cùng hàm đặt tên cho tab, CSV tự lưu và tải tay. Khi đổi tên CSV cũ, kiểm tra va chạm, giữ bản dự phòng và so mã băm nội dung. Giữ danh bạ vận hành riêng của máy nếu kho mã nguồn không phân phối dữ liệu cá nhân.

**Nghiệm thu.** CSV bắt đầu bằng “Trần Thu An”, có UID ở sau. Thử tên trùng giữa hai UID, danh bạ thiếu, tải lại extension và đổi tên bản cũ. Việc chọn tài khoản đăng vẫn dựa trên UID.

### Thứ tự và điều kiện phát hành

Ưu tiên mục 3 và 5 để biết đang thử đúng ID và đúng build. Tiếp theo xử lý 1, 2, 4 tại nguồn và với dữ liệu cũ. Mục 6 có thể làm độc lập. Phần sửa Post Research cần triển khai trong mã của bộ quét; chỉ sửa FB Desk sẽ không sửa được Docs đã xuất.

Trước phát hành, chạy thử trên một profile: nhập lại đúng các bài mẫu, so caption/media, rồi thử một bài được người vận hành chọn. Chỉ nghiệm thu đăng thật khi có permalink mở được, đúng tác giả và đủ nội dung sau khi tải lại. Trường hợp Facebook chỉ đóng ô soạn mà chưa có bằng chứng đăng phải giữ trạng thái cần đối soát. Báo cáo hiện chưa xác nhận bước này hoặc chức năng “Chạy thử”.
