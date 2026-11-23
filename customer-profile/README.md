# Hồ sơ khách hàng (extension riêng, 0.1.0)

Dựng **persona** của một khách **đã liên hệ bạn** từ trang cá nhân **công khai** của họ:

**Persona = Radar Nhân khẩu + Radar Tính cách (extension này) + Radar 8 trục mua hàng (agent khác làm, nạp bằng JSON).**

Chỉ đọc: không bấm thích, theo dõi, kết bạn, nhắn tin hay bình luận. Dữ liệu lưu trong Chrome Profile (`chrome.storage.local`, khóa `customerProfiles`), không gửi đi đâu. Không phụ thuộc FB Desk hay Post Research.

## Mốc chuẩn khái niệm

**[KHAI-NIEM.md](KHAI-NIEM.md)** định nghĩa mọi khái niệm (Sinh viên, Trung niên, Dân VP, VIP, Cá tính mạnh, Ngốc/Ngã cây…): định nghĩa, dấu hiệu nhận biết, ví dụ, không nhầm với, mốc điểm. Người và agent dùng tệp này làm chuẩn khi phân loại. Trên giao diện, nút **?** cạnh mỗi trục/mức hiện đúng định nghĩa đó.

Nguồn duy nhất là `concepts.js`. Sửa định nghĩa ở đó rồi chạy `node customer-profile/build-glossary.mjs` để sinh lại KHAI-NIEM.md (test sẽ báo nếu hai bên lệch).

## Cài và dùng

`chrome://extensions` → Chế độ nhà phát triển → **Tải tiện ích đã giải nén** → chọn thư mục này (ID cố định `agcbcbcjlealoknmffnhedpmlibpbbpa`). Bấm biểu tượng extension, dán link trang cá nhân của khách, bấm **Phân tích**. Extension mở trang trong tab đang hiện, đọc đầu trang, tối đa 25 bài công khai gần nhất và mọi tab của trang Giới thiệu, rồi đóng tab. Kiểm tra, chỉnh tay nếu cần, **Lưu hồ sơ**.

## Radar 1: Nhân khẩu (6 thang đo)

Tuổi, Thu nhập, Đẳng cấp (khớp nhóm của Sheet "Nhân cách"), Học vấn, Đô thị, Giai đoạn gia đình. Mỗi trục là một thang 0–100 chia mức; mức hiện ngay cạnh tên trục. Chỉ từ thông tin công khai; suy luận gián tiếp được đánh dấu ước tính, độ tin cậy thấp.

## Radar 2: Tính cách (8 nét)

Ngây thơ, Hiểu biết, Cá tính mạnh, Ngốc/Ngã cây (4 nét của Sheet), Hướng ngoại, Bộc lộ cảm xúc, Cầu tiến, Chăm lo gia đình. Chấm theo cách viết trên bài công khai, có bằng chứng; không phải chẩn đoán tâm lý.

## Radar 3: 8 trục mua hàng (agent khác)

Extension này **không chấm** các trục mua hàng. Agent phụ trách xuất JSON, người dùng bấm **Nạp 8 trục mua hàng (JSON)**:

```json
{
  "schema": "desk.customer-buying/1",
  "url": "https://www.facebook.com/<trang cá nhân của khách>",
  "source": "tên agent/công cụ",
  "at": "2026-11-23T10:00:00+07:00",
  "axes": [
    {"id": "need_urgency", "label": "Mức cần gấp", "score": 82, "confidence": "trung bình",
     "definition": "định nghĩa trục (hiện ở nút ?)",
     "evidence": [{"text": "mô tả ngắn", "why": "lý do"}]}
  ]
}
```

- 1–12 trục; `id` chữ thường/số/gạch dưới, không trùng nhau và không trùng trục nhân khẩu/tính cách; `score` 0–100 hoặc `null`.
- `url` phải trùng trang của hồ sơ; tối đa 5 bằng chứng/trục; link trong bằng chứng bị thay bằng `[link]` (không giữ danh tính bên thứ ba).

## Persona và xếp nhóm Sheet

Thẻ Persona ghép: nhóm theo Sheet (Tuổi / Thu nhập / Đẳng cấp / Cá tính), các mức nhân khẩu, nét tính cách nổi bật, trục mua hàng cao/thấp; thiếu phần nào thì ghi rõ. Quy tắc xếp nhóm Sheet: xem cuối KHAI-NIEM.md. Xuất JSON kèm persona để agent khác đọc.

## Nguyên tắc

Chỉ thông tin công khai của khách đã liên hệ; mỗi điểm có bằng chứng; thiếu dữ liệu thì "chưa đủ dữ liệu", không gán đại. Bài về sức khỏe, tôn giáo, chính trị, xu hướng tính dục không được dùng làm bằng chứng. So khớp giữ dấu tiếng Việt ("đang" ≠ "đảng").

## Test

`node tests/customer-profile.mjs`. Phần đọc bài viết, số cảm xúc, ngày đăng và trang Giới thiệu đã chạy trên trang công khai thật; **chưa chạy trọn luồng trong extension đã cài**.
