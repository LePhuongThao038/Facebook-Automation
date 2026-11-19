Kiểm tra bản 3.8.5 RC1 từ thư mục extension, Node.js >=20:
node --test tests/ai-provider.mjs tests/comment-review.mjs tests/autosave.mjs
node tests/cross-comments.mjs

API giả lập: không dùng key thật, không tính phí. Comment/reply vẫn duyệt thủ công. Bộ kiểm tra mô hình nguồn không gửi tương tác.
Các hướng dẫn kiểm tra cũ không còn phù hợp luồng tự động đã bị tắt; xem HUONG-DAN-3.8.5-RC.md và TEST-REPORT-3.8.5-RC.json.
