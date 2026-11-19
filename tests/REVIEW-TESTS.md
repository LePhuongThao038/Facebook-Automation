# Kiểm thử hàng chờ duyệt 3.8.4

Chạy từ thư mục extension với Node 20 trở lên:

```
node --test tests/comment-review.mjs
node tests/cross-comments.mjs
```

Lệnh đầu kiểm tra dữ liệu hàng chờ, chống trùng, phụ thuộc reply, xác nhận thủ công, sao lưu và chuyển kết quả giữa hai kho, khóa phiên bản ghi đồng thời, quyền trang điều khiển và khóa worker cũ. Lệnh sau là hồi quy bộ đọc nguồn/phân vai cũ bằng dữ liệu lưu sẵn, không gửi Facebook.

Các test cho coordinator tự gửi cũ đã được đưa ra ngoài gói 3.8.4. Không coi các tài liệu test của 3.7.x/3.8.0–3.8.3 là nghiệm thu cho bản này.

Giao diện đã được thử qua trình duyệt trên trang localhost chỉ có dữ liệu mẫu, gồm duyệt đủ bốn xác nhận, sao chép, ghi nhận comment cha, từ chối reply sai cha, ghi reply hợp lệ, lọc và phục hồi sau reload. Chưa có lượt nghiệm thu bản extension mới bên trong Chrome Profile hoặc Facebook thật.
