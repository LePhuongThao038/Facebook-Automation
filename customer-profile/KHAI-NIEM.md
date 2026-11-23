# Khái niệm và mốc chuẩn phân loại khách hàng

> Tệp này được SINH TỰ ĐỘNG từ `customer-profile/concepts.js` và `customer-profile/customer-model.js` (phiên bản khái niệm 2026-11-23). Muốn sửa định nghĩa thì sửa `concepts.js` rồi chạy `node customer-profile/build-glossary.mjs`. Giao diện (nút "?") và bộ chấm điểm dùng đúng các định nghĩa này.

Người và agent dùng tệp này làm **mốc chuẩn** khi đọc hồ sơ hoặc phân loại tay. Chỉ dùng thông tin **công khai** của khách **đã liên hệ**.

## Khái niệm chung

### Persona

Chân dung một khách hàng, ghép từ 3 phần: Nhân khẩu + Tính cách (extension này) + 8 trục mua hàng (agent khác làm, nạp vào bằng JSON). Thiếu phần nào thì persona ghi rõ còn thiếu.

### Điểm 0–100

Vị trí của khách trên một trục. Với trục nhân khẩu, điểm là một THANG ĐO (vd. tuổi: 0 = 15 tuổi, 100 = 65 tuổi), không phải "tốt hay xấu". Với trục tính cách, điểm là mức nét đó thể hiện rõ đến đâu trong bài viết.

- **Dấu hiệu nhận biết:** Tính cách: 0–20 = gần như không thấy; 21–54 = có thể hiện; 55–100 = nét nổi bật..

### Chưa đủ dữ liệu

Trang không công khai thông tin cần thiết, hoặc chưa đọc đủ bài để kết luận. Không có nghĩa là điểm 0. Không được tự điền số vào trục này khi chưa có bằng chứng.

### Độ tin cậy

Mức chắc chắn của điểm. Cao: thông tin khách tự khai (ngày sinh, học vấn) hoặc từ 4 bằng chứng trở lên. Trung bình: 2–3 bằng chứng hoặc suy từ một thông tin rõ. Thấp: 1 bằng chứng, hoặc suy luận gián tiếp.

### Bằng chứng

Đoạn trích bài viết hoặc mục Giới thiệu đã dẫn tới điểm, kèm lý do (từ khóa khớp, nguồn). Người tư vấn phải đọc được bằng chứng để tự kiểm tra.

### Ước tính

Suy ra gián tiếp, không phải khách tự khai. Ví dụ: tuổi suy từ năm tốt nghiệp THPT (+18 tuổi). Hiển thị viền nét đứt.

### Chỉnh tay

Người tư vấn kéo thanh để sửa điểm khi biết rõ hơn (vd. đã nói chuyện với khách). Điểm tự động vẫn được giữ để đối chiếu; bấm ↺ để quay về.

### Chủ đề nhạy cảm

Sức khỏe, tôn giáo, chính trị, xu hướng tính dục. Bài viết về các chủ đề này KHÔNG được dùng làm bằng chứng cho bất kỳ trục nào, và không được ghi vào hồ sơ.

## Radar 1: Nhân khẩu

Mỗi trục là một **thang đo** 0–100, chia thành các mức. Mức có tên trùng Sheet "Nhân cách" (Tuổi, Thu nhập, Đẳng cấp) dùng để điền Sheet.

### Tuổi (cột Sheet: Tuổi)

Tuổi của khách, chỉ lấy từ thông tin công khai (ngày/năm sinh) hoặc ước tính có căn cứ (năm tốt nghiệp THPT, đang học đại học).

| Mức | Điểm | Mô tả ngắn |
|---|---|---|
| Sinh viên | 0–14 | ≤ 22 tuổi |
| Đi làm | 15–40 | 23–35 tuổi |
| Trung niên | 41–80 | 36–55 tuổi |
| Lớn tuổi | 81–100 | > 55 tuổi |

#### Sinh viên

Khoảng 18–22 tuổi, đang học đại học/cao đẳng hoặc vừa ra trường, chưa đi làm ổn định.

- **Dấu hiệu nhận biết:** Giới thiệu ghi "Đang học tại …"; Bài về thi cử, ký túc xá, đồ án, thực tập; Tốt nghiệp THPT trong 4 năm gần đây.
- **Ví dụ:** Sinh năm 2005, đang học năm 3 Đại học Ngoại thương.
- **Không nhầm với:** Người trẻ đã đi làm (dù 22 tuổi) thuộc "Đi làm". Học viên khóa ngắn hạn khi đã đi làm không phải Sinh viên.

#### Đi làm

Khoảng 23–35 tuổi, đã đi làm, đang xây dựng sự nghiệp.

- **Dấu hiệu nhận biết:** Công việc hiện tại trên Giới thiệu; Bài về công ty, đồng nghiệp, dự án.
- **Ví dụ:** 28 tuổi, nhân viên marketing tại một công ty ở Hà Nội.
- **Không nhầm với:** "Đi làm" là nhóm TUỔI, không phải mức thu nhập (thu nhập xét ở trục Thu nhập).

#### Trung niên

Khoảng 36–55 tuổi; thường đã ổn định nghề nghiệp, gia đình.

- **Dấu hiệu nhận biết:** Sinh năm 1971–1990; Bài về con đi học, công việc lâu năm, vai trò quản lý.
- **Ví dụ:** 45 tuổi, có 2 con, làm trưởng phòng.
- **Không nhầm với:** Không suy từ ảnh đại diện hay giọng văn; cần năm sinh hoặc dấu hiệu rõ (con đã lớn, năm tốt nghiệp).

#### Lớn tuổi

Trên 55 tuổi.

- **Dấu hiệu nhận biết:** Sinh trước 1971; Bài về cháu, nghỉ hưu.
- **Ví dụ:** 62 tuổi, đã nghỉ hưu.
- **Không nhầm với:** Không có trong Sheet; dùng khi khách rõ ràng trên 55.

### Thu nhập (cột Sheet: Thu nhập)

Mức thu nhập ƯỚC TÍNH từ công việc công khai (công cụ không nhìn thấy lương). Mốc tiền chỉ để người phân loại tay tham khảo.

| Mức | Điểm | Mô tả ngắn |
|---|---|---|
| Xin việc | 0–30 | chưa có/đang tìm việc, sinh viên |
| Dân VP | 31–70 | nhân viên, chuyên viên, giáo viên, kỹ sư |
| Thu nhập cao | 71–100 | quản lý, chủ doanh nghiệp, nghề chuyên môn cao |

#### Xin việc

Chưa có thu nhập ổn định: sinh viên, đang tìm việc, thực tập, thất nghiệp. Tham khảo: dưới khoảng 7 triệu/tháng hoặc không đều.

- **Dấu hiệu nhận biết:** Bài "tìm việc", "xin việc", "thất nghiệp" gần đây; Chỉ có trường học, không có công việc.
- **Ví dụ:** Vừa tốt nghiệp, đăng bài xin việc kế toán.
- **Không nhầm với:** Người tự kinh doanh nhỏ vẫn có thu nhập: không phải Xin việc.

#### Dân VP

Lương cố định của nhân viên văn phòng, chuyên viên, giáo viên, kỹ sư. Tham khảo: khoảng 7–30 triệu/tháng.

- **Dấu hiệu nhận biết:** Chức danh nhân viên/chuyên viên/giáo viên/kỹ sư; Nơi làm là công ty, trường học, ngân hàng.
- **Ví dụ:** Giáo viên tiếng Anh tại một trung tâm.
- **Không nhầm với:** Không phải mọi người làm văn phòng đều "Dân VP": trưởng phòng trở lên xét "Thu nhập cao".

#### Thu nhập cao

Quản lý, chủ doanh nghiệp, nghề chuyên môn cao (bác sĩ, luật sư, kiến trúc sư). Tham khảo: trên khoảng 30 triệu/tháng.

- **Dấu hiệu nhận biết:** Chức danh giám đốc/CEO/founder/trưởng phòng/manager; Tự giới thiệu là chủ doanh nghiệp.
- **Ví dụ:** Founder một chuỗi spa, CEO công ty phần mềm.
- **Không nhầm với:** Đồ hiệu, du lịch là LỐI SỐNG (trục Đẳng cấp), không đủ để xếp Thu nhập cao.

### Đẳng cấp (cột Sheet: Đẳng cấp)

Tầng lớp theo LỐI SỐNG thể hiện công khai, không phải theo công việc hay học vấn.

| Mức | Điểm | Mô tả ngắn |
|---|---|---|
| Lao động | 0–35 | công việc tay chân, ca kíp |
| Bình thường | 36–70 | sinh hoạt phổ thông |
| VIP | 71–100 | du lịch nước ngoài, đồ hiệu, nhà/xe cao cấp |

#### Lao động

Lối sống gắn với công việc tay chân, ca kíp, thu nhập theo ngày.

- **Dấu hiệu nhận biết:** Công nhân, thợ, shipper, tài xế, phụ bếp; Bài về tăng ca, ca đêm.
- **Ví dụ:** Tài xế công nghệ, hay đăng bài chạy xe đêm.
- **Không nhầm với:** Không mang nghĩa coi thường; chỉ mô tả lối sống để chọn cách tư vấn phù hợp.

#### Bình thường

Sinh hoạt phổ thông: đi làm, đi chơi, mua sắm bình dân; không có dấu hiệu đặc biệt.

- **Dấu hiệu nhận biết:** Không thấy dấu hiệu lao động tay chân hay xa xỉ.
- **Ví dụ:** Nhân viên văn phòng, cuối tuần cà phê với bạn.
- **Không nhầm với:** "Bình thường" là mức mặc định khi có bài viết mà không thấy dấu hiệu nào khác.

#### VIP

Lối sống cao cấp thể hiện rõ và lặp lại: du lịch nước ngoài, đồ hiệu, xe/nhà cao cấp, golf.

- **Dấu hiệu nhận biết:** Nhiều bài du lịch Nhật/Hàn/Châu Âu, resort; Đồ hiệu (LV, Gucci, Rolex), xe Mercedes/BMW/Lexus.
- **Ví dụ:** Mỗi quý một chuyến nước ngoài, hay check-in resort 5 sao.
- **Không nhầm với:** Một lần du lịch nước ngoài chưa đủ là VIP; cần lặp lại hoặc nhiều dấu hiệu.

### Học vấn

Bậc học cao nhất khách tự ghi trên trang Giới thiệu.

| Mức | Điểm | Mô tả ngắn |
|---|---|---|
| Phổ thông | 0–35 | THCS/THPT |
| Cao đẳng/Trung cấp | 36–55 |  |
| Đại học | 56–80 |  |
| Sau đại học | 81–100 | Thạc sĩ, Tiến sĩ |

#### Phổ thông

Chỉ ghi THCS/THPT.

#### Cao đẳng/Trung cấp

Ghi trường cao đẳng, trung cấp.

#### Đại học

Ghi trường đại học/học viện (đang học hoặc đã học).

#### Sau đại học

Ghi thạc sĩ, tiến sĩ, cao học, MBA.

### Đô thị

Mức đô thị của nơi khách đang sống; nếu không ghi nơi sống thì dùng quê quán (độ tin cậy thấp).

| Mức | Điểm | Mô tả ngắn |
|---|---|---|
| Nông thôn | 0–35 |  |
| Tỉnh/thị xã | 36–60 |  |
| Thành phố lớn | 61–85 | Đà Nẵng, Hải Phòng, Cần Thơ… |
| Hà Nội/TP.HCM/nước ngoài | 86–100 |  |

#### Nông thôn

Xã, thôn, huyện.

#### Tỉnh/thị xã

Tỉnh/thành phố trực thuộc tỉnh khác ngoài các thành phố lớn.

#### Thành phố lớn

Đà Nẵng, Hải Phòng, Cần Thơ, Nha Trang, Huế, Vũng Tàu, Biên Hòa, Thủ Đức.

#### Hà Nội/TP.HCM/nước ngoài

Hà Nội, TP.HCM, hoặc đang sống ở nước ngoài.

### Giai đoạn gia đình

Giai đoạn gia đình theo tình trạng quan hệ khách công khai và bài viết về con cái.

| Mức | Điểm | Mô tả ngắn |
|---|---|---|
| Độc thân | 0–25 |  |
| Hẹn hò/Đính hôn | 26–55 |  |
| Đã kết hôn | 56–80 |  |
| Có con | 81–100 |  |

#### Độc thân

Ghi "Độc thân".

#### Hẹn hò/Đính hôn

Ghi "Hẹn hò", "Đã đính hôn".

#### Đã kết hôn

Ghi "Đã kết hôn".

#### Có con

Có bài viết về con của mình (đón con, sinh nhật con, "bé nhà mình").

- **Không nhầm với:** Bài về con của người khác, cháu, học sinh không tính.

## Radar 2: Tính cách

Chấm theo **cách viết trên bài công khai**, không phải chẩn đoán tâm lý. Mốc chung: **0–20** gần như không thấy · **21–54** có thể hiện · **55–100** nét nổi bật. Bốn nét đầu là nhóm "Cá tính" của Sheet.

### Ngây thơ (nhóm Cá tính trong Sheet)

Hồn nhiên, dễ tin, hay hỏi đơn giản, giọng dễ thương.

- **Dấu hiệu nhận biết:** "hihi", "huhu", "ạ", "nè", emoji 🥺🥰; Câu hỏi đơn giản, tin ngay thông tin.
- **Ví dụ:** "Ủa có ai biết cái này dùng sao không ạ, em mới mua hihi 🥺"
- **Không nhầm với:** Không phải "thiếu hiểu biết" hay ngốc; là giọng điệu hồn nhiên. Người lịch sự hay dùng "ạ" không vì thế mà Ngây thơ.

- **Điểm thấp:** Viết chín chắn, ít hỏi.
- **Điểm cao:** Nhiều "hihi/huhu/ạ", hỏi ngây ngô, emoji dễ thương.

### Hiểu biết (nhóm Cá tính trong Sheet)

Hay chia sẻ kiến thức, phân tích, kinh nghiệm; viết có lập luận.

- **Dấu hiệu nhận biết:** Bài dài, có liệt kê, số liệu; "kinh nghiệm", "lưu ý", "phân tích", "theo mình".
- **Ví dụ:** "3 lưu ý khi chọn khóa IELTS: thứ nhất… tóm lại…"
- **Không nhầm với:** Bằng cấp cao không đồng nghĩa với Hiểu biết; chỉ chấm theo cách viết.

- **Điểm thấp:** Ít nội dung kiến thức.
- **Điểm cao:** Bài dài, có phân tích, số liệu, mẹo, kinh nghiệm.

### Cá tính mạnh (nhóm Cá tính trong Sheet)

Quan điểm rõ ràng, dám nói thẳng, phản biện.

- **Dấu hiệu nhận biết:** "nói thật", "không đồng ý", "vô lý", "tuyệt đối"; Nhiều "!!", khẳng định mạnh.
- **Ví dụ:** "Nói thật là dịch vụ kiểu này vô lý!! Mình không đồng ý."
- **Không nhầm với:** Không phải "khó tính" hay "hay cãi" theo nghĩa xấu; là người có chính kiến, cần tư vấn thẳng thắn, rõ ràng.

- **Điểm thấp:** Tránh tranh luận, ít nêu quan điểm.
- **Điểm cao:** Hay khẳng định, phản bác, nói thẳng, nhiều "!!".

### Ngốc/Ngã cây (nhóm Cá tính trong Sheet)

Kiểu hài hước TỰ TRÀO: hay kể chuyện vụng về của chính mình, đùa, "tấu hề" (trong Sheet gọi là "Ngốc/Ngã cây").

- **Dấu hiệu nhận biết:** "haha", "kkk", "=))", "toang", "ngáo", "tấu hề"; Emoji 😂🤣😅, kể chuyện "ngã cây".
- **Ví dụ:** "Hôm nay đi học quên mang sách, quê xỉu =)) toang thật sự 😂"
- **Không nhầm với:** KHÔNG có nghĩa là đần độn hay kém thông minh. Không dùng từ này để gọi hay mô tả khách trước mặt họ.

- **Điểm thấp:** Nghiêm túc.
- **Điểm cao:** Nhiều "haha/kkk/=))", kể chuyện vụng về, đùa chính mình.

### Hướng ngoại

Thích gặp gỡ, đi chơi, hoạt động nhóm.

- **Dấu hiệu nhận biết:** "đi chơi", "tụ tập", "cả hội", "party", check-in "đang ở".
- **Ví dụ:** "Cuối tuần cả hội đi Ba Vì, vui quên lối về!"
- **Không nhầm với:** Nhiều bạn bè/người theo dõi chưa chắc Hướng ngoại; chấm theo nội dung bài.

- **Điểm thấp:** Bài chủ yếu một mình, ít sự kiện.
- **Điểm cao:** Đi chơi, tụ tập, gắn thẻ bạn bè, check-in thường xuyên.

### Bộc lộ cảm xúc

Thể hiện tâm trạng, cảm xúc cá nhân trên mạng.

- **Dấu hiệu nhận biết:** "buồn", "mệt", "nhớ", "hạnh phúc", "tâm trạng"; Nhiều emoji, "!!".
- **Ví dụ:** "Hôm nay mệt quá, chỉ muốn về nhà ôm mèo 😭"
- **Không nhầm với:** Không phải dấu hiệu bất ổn tâm lý; công cụ không chẩn đoán sức khỏe tinh thần.

- **Điểm thấp:** Ít cảm xúc, chủ yếu thông tin.
- **Điểm cao:** Nhiều tâm trạng, emoji, dấu cảm thán.

### Cầu tiến

Quan tâm học tập, sự nghiệp, mục tiêu và tự phát triển.

- **Dấu hiệu nhận biết:** "chứng chỉ", "band", "dự án", "mục tiêu", "khởi nghiệp", "tự học".
- **Ví dụ:** "Mục tiêu năm nay: IELTS 7.0 và lên trưởng nhóm."
- **Không nhầm với:** Học sinh/sinh viên nhắc "học, thi" một lần chưa đủ; cần lặp lại hoặc có mục tiêu rõ.

- **Điểm thấp:** Ít nói về học tập, công việc.
- **Điểm cao:** Học, thi chứng chỉ, dự án, mục tiêu, khởi nghiệp.

### Chăm lo gia đình

Mức nhắc tới và chăm lo cho gia đình trong bài viết.

- **Dấu hiệu nhận biết:** "bố mẹ", "gia đình", "vợ/chồng", "cả nhà", "về quê".
- **Ví dụ:** "Cuối tuần đưa bố mẹ đi khám xong cả nhà ăn lẩu."
- **Không nhầm với:** Khác trục "Giai đoạn gia đình" (nhân khẩu): trục này đo mức quan tâm thể hiện, không phải tình trạng hôn nhân.

- **Điểm thấp:** Hiếm khi nhắc gia đình.
- **Điểm cao:** Thường xuyên nói về bố mẹ, vợ/chồng, con cái.

## Radar 3: 8 trục mua hàng (agent khác)

Không chấm trong extension này. Agent phụ trách gửi kết quả theo định dạng `desk.customer-buying/1` (xem README); định nghĩa từng trục lấy từ trường `definition` trong kết quả đó và hiện ở nút "?" của trục.

## Quy tắc điền Sheet "Nhân cách"

- Tuổi / Thu nhập / Đẳng cấp: lấy mức (band) chứa điểm của trục tương ứng.
- Cá tính (4 nét của Sheet: Ngây thơ, Hiểu biết, Cá tính mạnh, Ngốc/Ngã cây): chọn nét có điểm cao nhất nếu ≥ 40 và hơn nét thứ hai từ 5 điểm trở lên; nếu hai nét gần bằng nhau thì để người tư vấn chọn.
- Trục "chưa đủ dữ liệu" thì ô Sheet để trống, không đoán.
