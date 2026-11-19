# FB Desk 3.8.6: cơ chế post mới

Ngày 19/11/2026 · manifest 3.8.6.0 · cập nhật tại chỗ, không cần gỡ cài đặt.

## Cách cập nhật (mỗi Chrome profile)

1. Các profile nạp extension trực tiếp từ `Facebook-Desk-K-Global-3_8_5` (ID `kfljghhb…`). 8 tệp đã sửa đã được chép đè vào chính thư mục này, bản cũ sao lưu ở `Backup-3_8_5-RC11-truoc-3_8_6`. Đường dẫn giữ nguyên nên ID extension, hàng chờ, tiến độ và cài đặt được giữ lại. Không nạp thư mục `Da-giai-nen` làm extension mới: làm vậy sẽ tạo ra ID khác với dữ liệu trống.
2. Ở mỗi profile, mở `chrome://extensions` và bấm **Tải lại** (biểu tượng ↻) trên thẻ Facebook Desk K-Global. Phiên bản hiển thị phải là **3.8.6 · Tự đăng (cơ chế post mới)**.
3. Đóng tab "Bot đang chạy" cũ nếu còn. Bot tự mở tab mới khi đến lượt.
4. Video: bấm **Start Video** lại một lần để Media Bridge chạy mã mới. Nên cập nhật yt-dlp: `python -m pip install -U yt-dlp`.
5. Không thu nhỏ (minimize) cửa sổ Chrome đang chạy bot. Bot cần tab Facebook đang hiển thị trong cửa sổ đó.

Quay lại bản cũ nếu cần: chép 8 tệp trong `Backup-3_8_5-RC11-truoc-3_8_6` trở lại `Facebook-Desk-K-Global-3_8_5`, rồi bấm Tải lại.

## Nguyên nhân lỗi (đọc từ CSV tự lưu của 10 profile) và cách sửa

| Lỗi trong log | Nguyên nhân | 3.8.6 |
|---|---|---|
| "Chưa nhận diện được nick… không thấy nút sửa trang" | Nhận diện nick dựa vào nút "Chỉnh sửa trang cá nhân". Khi hộp soạn mở, Facebook ẩn trang nền khỏi cây trợ năng. Tab chạy nền cũng không vẽ giao diện. | Lấy UID phiên đăng nhập (`c_user`, chỉ đọc tại chỗ) so với UID đã liên kết. Nick dạng tên rút gọn dùng kết quả chuyển hướng `/me/`. Đã xác minh thì lưu trong tab. |
| "Có hộp thoại khác đang che bước đăng" (UI: blocking-dialog) | Mọi `role=dialog` khác giao với vùng soạn (chat, popover dưới lớp phủ) đều bị coi là đang che. | Chỉ kiểm tra phần tử nằm ngay tại tâm nút Đăng (hit-test), tự cuộn khi nút ra ngoài màn hình. Lỗi ghi tên lớp đang che. |
| "Chưa xác minh đủ media tải xong" dù đếm đủ ảnh | Bắt buộc mỗi ảnh có nút xóa riêng và URL ảnh xem trước không đổi. Facebook đổi URL sau khi tải và gom nút xóa cho album. | Đếm ảnh/video xem trước mới xuất hiện, tính cả ô "+N" của album. Thiếu media thì vẫn chặn đăng. |
| Không có ảnh xem trước nào sau khi gửi tệp | Facebook không nhận sự kiện `change` của ô tải. | Phát cả `input` và `change`. Nếu sau 12–25 giây không nhận, tự thả tệp (drop) vào hộp soạn. |
| "Đã bấm mở bài nhưng chưa nhận diện được ô nhập" | Hộp soạn kẹt `opacity:0` vì tab nền. | Mở tab Facebook ở dạng active, bỏ điều kiện opacity, chờ lâu hơn. |
| "message channel closed…" | Service worker khởi động lại giữa lượt. | Runner tự thử lại các lệnh an toàn. |
| Dựng MP4: "Không tìm được định dạng phù hợp" | Bộ lọc định dạng của yt-dlp quá hẹp so với video Facebook. | Thêm 3 định dạng dự phòng, vẫn giới hạn 200 MB. |

**Tự thử lại:** lỗi xảy ra trước khi bấm Đăng được thử lại 1 lần sau 90 giây trong tab mới. Không thử lại lỗi nguồn/MP4/caption/sai nick/đăng nhập. Sau khi đã bấm Đăng thì không bao giờ tự đăng lại.

**Lag:** runner hỏi việc mỗi 2 giây (trước là 250 ms) qua một bản tóm tắt nhỏ, không đọc lại toàn bộ dữ liệu. Nhịp heartbeat 20 giây. Tự lưu CSV không còn so toàn bộ ảnh base64 sau mỗi lần ghi. Dashboard không tải lại khi tab bị ẩn.

## Kiểm thử

`tests/post-flow-386.mjs` dùng Chrome thật trên hộp soạn mô phỏng và qua **10/10** kịch bản: caption, 1 ảnh có đổi URL, 4 ảnh, album 6 ảnh "+2", ô tải không nhận change, màn hình 1034×623, hộp soạn opacity 0, bị che thật (dừng, không bấm), sai nick (dừng), thiếu media (không đăng riêng caption).

Cùng bộ kịch bản đó, RC11 hỏng ở bước nhận diện nick với đúng thông báo trong log thật, và hỏng ở album, ô tải không nhận change và hộp soạn opacity 0. Kịch bản "hộp thoại che" trong mô phỏng chưa tái hiện được lỗi của RC11. Cách sửa phần này dựa trên chẩn đoán từ log.

**Chưa nghiệm thu trên Facebook thật.** Tiêu chí: 1 bài caption, 1 bài 1 ảnh, 1 album, 1 MP4 trên đúng nick, permalink mở được, tải lại dashboard vẫn thấy "Đã đăng", không có bài trùng.

