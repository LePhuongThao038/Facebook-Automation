# Hồ sơ khách hàng (extension riêng, 0.1.0)

Dựng **hồ sơ nhân khẩu + bản đồ tính cách/mua hàng** của một khách **đã liên hệ bạn**, từ trang cá nhân **công khai** của họ. Chỉ đọc: không bấm thích, theo dõi, kết bạn, nhắn tin hay bình luận. Dữ liệu lưu trong Chrome Profile (`chrome.storage.local`, khóa `customerProfiles`), không gửi đi đâu.

Tách riêng khỏi Post Research và FB Desk (không dùng chung mã chạy); hàm đọc trang Giới thiệu được chép từ Post Research.

## Cài

`chrome://extensions` → bật Chế độ nhà phát triển → **Tải tiện ích đã giải nén** → chọn thư mục `customer-profile`. Manifest có `key` nên ID cố định ở mọi thư mục/máy. Bấm biểu tượng extension để mở trang.

## Dùng

1. Dán link trang cá nhân của khách (`facebook.com/ten` hoặc `profile.php?id=…`), thêm từ khóa sản phẩm/dịch vụ của bạn (giúp chấm "Mức cần gấp"), bấm **Phân tích**. Extension mở trang trong một tab đang hiện (dòng thời gian chỉ tải khi tab hiện), đọc đầu trang, tối đa 25 bài công khai gần nhất và mọi tab con của trang Giới thiệu, rồi đóng tab.
2. Kiểm tra, chỉnh tay nếu cần (kéo thanh; ↺ về điểm tự động), ghi chú, **Lưu hồ sơ**.

## Nhân khẩu

Chỉ lấy từ trang Giới thiệu và đầu trang; mỗi mục ghi nguồn. Không có thì không hiện (không đoán). Tuổi chỉ khi công khai ngày/năm sinh; nếu chỉ có năm tốt nghiệp THPT thì hiện "khoảng N (ước tính …)" và đánh dấu **ước tính**.

## 7 trục (0–100)

| Trục | Định nghĩa | Nguồn điểm |
|---|---|---|
| Mức cần gấp | Đang chủ động tìm/hỏi/so sánh sản phẩm, dịch vụ gần đây | từ khóa tìm mua + từ khóa sản phẩm của bạn, ưu tiên bài mới |
| Khả năng chi trả | Dấu hiệu chi tiêu công khai: công việc, du lịch, đồ dùng | từ khóa (có cả chiều ngược: tìm việc, hết tiền) + Giới thiệu |
| Nhạy cảm giá | Quan tâm giá, khuyến mãi, so giá | từ khóa |
| Mức hoài nghi | Cần bằng chứng/review, cảnh giác, từng bị lừa | từ khóa |
| Cần tư vấn sâu | Muốn hiểu kỹ, hỏi chi tiết, viết dài | từ khóa + độ dài bài + câu hỏi + học vấn |
| Mức ảnh hưởng | Người theo dõi và tương tác trên bài | số liệu |
| Độ hoạt động | Đăng gần đây và đều đặn đến đâu | ngày đăng |

Mỗi trục có **độ tin cậy** và **bằng chứng** (trích bài và từ khóa khớp). Không có bằng chứng: "chưa đủ dữ liệu" (đọc ≥ 10 bài mà không thấy dấu hiệu thì cho 10, tin cậy thấp). Bài về chủ đề nhạy cảm (sức khỏe, tôn giáo, chính trị, xu hướng tính dục) **không được dùng làm bằng chứng**. So khớp giữ dấu tiếng Việt (bỏ dấu làm "đang" trùng "đảng", "lừa đảo" chứa "đạo"); chỉ so bản bỏ dấu khi người viết gõ không dấu.

## Trục 8 "Đã bị đối thủ tiếp cận": do agent khác làm

Đã khai báo sẵn (`EXTERNAL_AXES`, id `competitor_exposure`), hiện "chưa có" trên biểu đồ tới khi nạp. Nạp bằng nút **Nạp trục 8 (JSON)** hoặc gọi `customerModel.mergeExternal(profile, payload)`:

```json
{
  "schema": "desk.customer-axis/1",
  "axis": "competitor_exposure",
  "url": "https://www.facebook.com/<trang cá nhân của khách>",
  "score": 0,
  "evidence": [{"text": "mô tả ngắn, vd. 5/20 bài có bình luận chào hàng", "why": "lý do"}],
  "source": "tên agent/công cụ",
  "at": "2026-11-23T10:00:00+07:00"
}
```

- `url` phải trùng trang của hồ sơ; `score` 0–100 hoặc `null`; tối đa 10 bằng chứng.
- **Không gửi danh tính bên thứ ba** (tên, link tài khoản bán hàng khác): link trong `text` bị thay bằng `[link]`.

## Test

`node tests/customer-profile.mjs`. Phần đọc bài viết, số cảm xúc, ngày đăng và trang Giới thiệu đã chạy trên trang công khai thật (Nguyễn Yến, 23 Dota TV); **chưa chạy trọn luồng trong extension đã cài**.
