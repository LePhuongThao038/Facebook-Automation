// MỐC CHUẨN KHÁI NIỆM (một nguồn duy nhất). Dùng cho: nút "?" trên giao diện, tệp KHAI-NIEM.md (sinh tự động bằng
// `node customer-profile/build-glossary.mjs`), và làm chuẩn khi người hoặc agent phân loại tay.
// Mỗi mục: định nghĩa, dấu hiệu nhận biết, ví dụ, không nhầm với, ghi chú. Sửa ở ĐÂY rồi sinh lại KHAI-NIEM.md.
globalThis.customerConcepts={
 version:'2026-11-23',
 general:[
  {term:'Persona',definition:'Chân dung một khách hàng, ghép từ 3 phần: Nhân khẩu + Tính cách (extension này) + 8 trục mua hàng (agent khác làm, nạp vào bằng JSON). Thiếu phần nào thì persona ghi rõ còn thiếu.'},
  {term:'Điểm 0–100',definition:'Vị trí của khách trên một trục. Với trục nhân khẩu, điểm là một THANG ĐO (vd. tuổi: 0 = 15 tuổi, 100 = 65 tuổi), không phải "tốt hay xấu". Với trục tính cách, điểm là mức nét đó thể hiện rõ đến đâu trong bài viết.',
   signs:['Tính cách: 0–20 = gần như không thấy; 21–54 = có thể hiện; 55–100 = nét nổi bật.']},
  {term:'Chưa đủ dữ liệu',definition:'Trang không công khai thông tin cần thiết, hoặc chưa đọc đủ bài để kết luận. Không có nghĩa là điểm 0. Không được tự điền số vào trục này khi chưa có bằng chứng.'},
  {term:'Độ tin cậy',definition:'Mức chắc chắn của điểm. Cao: thông tin khách tự khai (ngày sinh, học vấn) hoặc từ 4 bằng chứng trở lên. Trung bình: 2–3 bằng chứng hoặc suy từ một thông tin rõ. Thấp: 1 bằng chứng, hoặc suy luận gián tiếp.'},
  {term:'Bằng chứng',definition:'Đoạn trích bài viết hoặc mục Giới thiệu đã dẫn tới điểm, kèm lý do (từ khóa khớp, nguồn). Người tư vấn phải đọc được bằng chứng để tự kiểm tra.'},
  {term:'Ước tính',definition:'Suy ra gián tiếp, không phải khách tự khai. Ví dụ: tuổi suy từ năm tốt nghiệp THPT (+18 tuổi). Hiển thị viền nét đứt.'},
  {term:'Chỉnh tay',definition:'Người tư vấn kéo thanh để sửa điểm khi biết rõ hơn (vd. đã nói chuyện với khách). Điểm tự động vẫn được giữ để đối chiếu; bấm ↺ để quay về.'},
  {term:'Chủ đề nhạy cảm',definition:'Sức khỏe, tôn giáo, chính trị, xu hướng tính dục. Bài viết về các chủ đề này KHÔNG được dùng làm bằng chứng cho bất kỳ trục nào, và không được ghi vào hồ sơ.'}
 ],
 // Trục và các mức. Khóa = id trục (trùng customerModel). Mức = nhãn trong bands (trùng nhãn Sheet "Nhân cách" khi có).
 axes:{
  age:{definition:'Tuổi của khách, chỉ lấy từ thông tin công khai (ngày/năm sinh) hoặc ước tính có căn cứ (năm tốt nghiệp THPT, đang học đại học).',
   levels:{
    'Sinh viên':{definition:'Khoảng 18–22 tuổi, đang học đại học/cao đẳng hoặc vừa ra trường, chưa đi làm ổn định.',signs:['Giới thiệu ghi "Đang học tại …"','Bài về thi cử, ký túc xá, đồ án, thực tập','Tốt nghiệp THPT trong 4 năm gần đây'],example:'Sinh năm 2005, đang học năm 3 Đại học Ngoại thương.',notConfused:'Người trẻ đã đi làm (dù 22 tuổi) thuộc "Đi làm". Học viên khóa ngắn hạn khi đã đi làm không phải Sinh viên.'},
    'Đi làm':{definition:'Khoảng 23–35 tuổi, đã đi làm, đang xây dựng sự nghiệp.',signs:['Công việc hiện tại trên Giới thiệu','Bài về công ty, đồng nghiệp, dự án'],example:'28 tuổi, nhân viên marketing tại một công ty ở Hà Nội.',notConfused:'"Đi làm" là nhóm TUỔI, không phải mức thu nhập (thu nhập xét ở trục Thu nhập).'},
    'Trung niên':{definition:'Khoảng 36–55 tuổi; thường đã ổn định nghề nghiệp, gia đình.',signs:['Sinh năm 1971–1990','Bài về con đi học, công việc lâu năm, vai trò quản lý'],example:'45 tuổi, có 2 con, làm trưởng phòng.',notConfused:'Không suy từ ảnh đại diện hay giọng văn; cần năm sinh hoặc dấu hiệu rõ (con đã lớn, năm tốt nghiệp).'},
    'Lớn tuổi':{definition:'Trên 55 tuổi.',signs:['Sinh trước 1971','Bài về cháu, nghỉ hưu'],example:'62 tuổi, đã nghỉ hưu.',notConfused:'Không có trong Sheet; dùng khi khách rõ ràng trên 55.'}}},
  income:{definition:'Mức thu nhập ƯỚC TÍNH từ công việc công khai (công cụ không nhìn thấy lương). Mốc tiền chỉ để người phân loại tay tham khảo.',
   levels:{
    'Xin việc':{definition:'Chưa có thu nhập ổn định: sinh viên, đang tìm việc, thực tập, thất nghiệp. Tham khảo: dưới khoảng 7 triệu/tháng hoặc không đều.',signs:['Bài "tìm việc", "xin việc", "thất nghiệp" gần đây','Chỉ có trường học, không có công việc'],example:'Vừa tốt nghiệp, đăng bài xin việc kế toán.',notConfused:'Người tự kinh doanh nhỏ vẫn có thu nhập: không phải Xin việc.'},
    'Dân VP':{definition:'Lương cố định của nhân viên văn phòng, chuyên viên, giáo viên, kỹ sư. Tham khảo: khoảng 7–30 triệu/tháng.',signs:['Chức danh nhân viên/chuyên viên/giáo viên/kỹ sư','Nơi làm là công ty, trường học, ngân hàng'],example:'Giáo viên tiếng Anh tại một trung tâm.',notConfused:'Không phải mọi người làm văn phòng đều "Dân VP": trưởng phòng trở lên xét "Thu nhập cao".'},
    'Thu nhập cao':{definition:'Quản lý, chủ doanh nghiệp, nghề chuyên môn cao (bác sĩ, luật sư, kiến trúc sư). Tham khảo: trên khoảng 30 triệu/tháng.',signs:['Chức danh giám đốc/CEO/founder/trưởng phòng/manager','Tự giới thiệu là chủ doanh nghiệp'],example:'Founder một chuỗi spa, CEO công ty phần mềm.',notConfused:'Đồ hiệu, du lịch là LỐI SỐNG (trục Đẳng cấp), không đủ để xếp Thu nhập cao.'}}},
  class:{definition:'Tầng lớp theo LỐI SỐNG thể hiện công khai, không phải theo công việc hay học vấn.',
   levels:{
    'Lao động':{definition:'Lối sống gắn với công việc tay chân, ca kíp, thu nhập theo ngày.',signs:['Công nhân, thợ, shipper, tài xế, phụ bếp','Bài về tăng ca, ca đêm'],example:'Tài xế công nghệ, hay đăng bài chạy xe đêm.',notConfused:'Không mang nghĩa coi thường; chỉ mô tả lối sống để chọn cách tư vấn phù hợp.'},
    'Bình thường':{definition:'Sinh hoạt phổ thông: đi làm, đi chơi, mua sắm bình dân; không có dấu hiệu đặc biệt.',signs:['Không thấy dấu hiệu lao động tay chân hay xa xỉ'],example:'Nhân viên văn phòng, cuối tuần cà phê với bạn.',notConfused:'"Bình thường" là mức mặc định khi có bài viết mà không thấy dấu hiệu nào khác.'},
    'VIP':{definition:'Lối sống cao cấp thể hiện rõ và lặp lại: du lịch nước ngoài, đồ hiệu, xe/nhà cao cấp, golf.',signs:['Nhiều bài du lịch Nhật/Hàn/Châu Âu, resort','Đồ hiệu (LV, Gucci, Rolex), xe Mercedes/BMW/Lexus'],example:'Mỗi quý một chuyến nước ngoài, hay check-in resort 5 sao.',notConfused:'Một lần du lịch nước ngoài chưa đủ là VIP; cần lặp lại hoặc nhiều dấu hiệu.'}}},
  education:{definition:'Bậc học cao nhất khách tự ghi trên trang Giới thiệu.',
   levels:{'Phổ thông':{definition:'Chỉ ghi THCS/THPT.'},'Cao đẳng/Trung cấp':{definition:'Ghi trường cao đẳng, trung cấp.'},'Đại học':{definition:'Ghi trường đại học/học viện (đang học hoặc đã học).'},'Sau đại học':{definition:'Ghi thạc sĩ, tiến sĩ, cao học, MBA.'}}},
  urban:{definition:'Mức đô thị của nơi khách đang sống; nếu không ghi nơi sống thì dùng quê quán (độ tin cậy thấp).',
   levels:{'Nông thôn':{definition:'Xã, thôn, huyện.'},'Tỉnh/thị xã':{definition:'Tỉnh/thành phố trực thuộc tỉnh khác ngoài các thành phố lớn.'},'Thành phố lớn':{definition:'Đà Nẵng, Hải Phòng, Cần Thơ, Nha Trang, Huế, Vũng Tàu, Biên Hòa, Thủ Đức.'},'Hà Nội/TP.HCM/nước ngoài':{definition:'Hà Nội, TP.HCM, hoặc đang sống ở nước ngoài.'}}},
  family:{definition:'Giai đoạn gia đình theo tình trạng quan hệ khách công khai và bài viết về con cái.',
   levels:{'Độc thân':{definition:'Ghi "Độc thân".'},'Hẹn hò/Đính hôn':{definition:'Ghi "Hẹn hò", "Đã đính hôn".'},'Đã kết hôn':{definition:'Ghi "Đã kết hôn".'},'Có con':{definition:'Có bài viết về con của mình (đón con, sinh nhật con, "bé nhà mình").',notConfused:'Bài về con của người khác, cháu, học sinh không tính.'}}},
  naive:{definition:'Hồn nhiên, dễ tin, hay hỏi đơn giản, giọng dễ thương.',signs:['"hihi", "huhu", "ạ", "nè", emoji 🥺🥰','Câu hỏi đơn giản, tin ngay thông tin'],example:'"Ủa có ai biết cái này dùng sao không ạ, em mới mua hihi 🥺"',notConfused:'Không phải "thiếu hiểu biết" hay ngốc; là giọng điệu hồn nhiên. Người lịch sự hay dùng "ạ" không vì thế mà Ngây thơ.'},
  knowledgeable:{definition:'Hay chia sẻ kiến thức, phân tích, kinh nghiệm; viết có lập luận.',signs:['Bài dài, có liệt kê, số liệu','"kinh nghiệm", "lưu ý", "phân tích", "theo mình"'],example:'"3 lưu ý khi chọn khóa IELTS: thứ nhất… tóm lại…"',notConfused:'Bằng cấp cao không đồng nghĩa với Hiểu biết; chỉ chấm theo cách viết.'},
  assertive:{definition:'Quan điểm rõ ràng, dám nói thẳng, phản biện.',signs:['"nói thật", "không đồng ý", "vô lý", "tuyệt đối"','Nhiều "!!", khẳng định mạnh'],example:'"Nói thật là dịch vụ kiểu này vô lý!! Mình không đồng ý."',notConfused:'Không phải "khó tính" hay "hay cãi" theo nghĩa xấu; là người có chính kiến, cần tư vấn thẳng thắn, rõ ràng.'},
  goofy:{definition:'Kiểu hài hước TỰ TRÀO: hay kể chuyện vụng về của chính mình, đùa, "tấu hề" (trong Sheet gọi là "Ngốc/Ngã cây").',signs:['"haha", "kkk", "=))", "toang", "ngáo", "tấu hề"','Emoji 😂🤣😅, kể chuyện "ngã cây"'],example:'"Hôm nay đi học quên mang sách, quê xỉu =)) toang thật sự 😂"',notConfused:'KHÔNG có nghĩa là đần độn hay kém thông minh. Không dùng từ này để gọi hay mô tả khách trước mặt họ.'},
  extravert:{definition:'Thích gặp gỡ, đi chơi, hoạt động nhóm.',signs:['"đi chơi", "tụ tập", "cả hội", "party", check-in "đang ở"'],example:'"Cuối tuần cả hội đi Ba Vì, vui quên lối về!"',notConfused:'Nhiều bạn bè/người theo dõi chưa chắc Hướng ngoại; chấm theo nội dung bài.'},
  expressive:{definition:'Thể hiện tâm trạng, cảm xúc cá nhân trên mạng.',signs:['"buồn", "mệt", "nhớ", "hạnh phúc", "tâm trạng"','Nhiều emoji, "!!"'],example:'"Hôm nay mệt quá, chỉ muốn về nhà ôm mèo 😭"',notConfused:'Không phải dấu hiệu bất ổn tâm lý; công cụ không chẩn đoán sức khỏe tinh thần.'},
  driven:{definition:'Quan tâm học tập, sự nghiệp, mục tiêu và tự phát triển.',signs:['"chứng chỉ", "band", "dự án", "mục tiêu", "khởi nghiệp", "tự học"'],example:'"Mục tiêu năm nay: IELTS 7.0 và lên trưởng nhóm."',notConfused:'Học sinh/sinh viên nhắc "học, thi" một lần chưa đủ; cần lặp lại hoặc có mục tiêu rõ.'},
  family_care:{definition:'Mức nhắc tới và chăm lo cho gia đình trong bài viết.',signs:['"bố mẹ", "gia đình", "vợ/chồng", "cả nhà", "về quê"'],example:'"Cuối tuần đưa bố mẹ đi khám xong cả nhà ăn lẩu."',notConfused:'Khác trục "Giai đoạn gia đình" (nhân khẩu): trục này đo mức quan tâm thể hiện, không phải tình trạng hôn nhân.'}
 },
 sheetRules:[
  'Tuổi / Thu nhập / Đẳng cấp: lấy mức (band) chứa điểm của trục tương ứng.',
  'Cá tính (4 nét của Sheet: Ngây thơ, Hiểu biết, Cá tính mạnh, Ngốc/Ngã cây): chọn nét có điểm cao nhất nếu ≥ 40 và hơn nét thứ hai từ 5 điểm trở lên; nếu hai nét gần bằng nhau thì để người tư vấn chọn.',
  'Trục "chưa đủ dữ liệu" thì ô Sheet để trống, không đoán.'
 ]
};
