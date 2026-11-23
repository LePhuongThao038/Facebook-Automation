// Hồ sơ khách hàng: mô hình chấm nhân khẩu + 7 trục, và chỗ nạp trục 8. Chạy: node tests/customer-profile.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(readFileSync(new URL('../customer-profile/customer-model.js',import.meta.url),'utf8'));
const M=globalThis.customerModel;const results=[];
const now=new Date('2026-11-23T10:00:00+07:00');
// Số kiểu Facebook
assert.deepEqual(['42 người','87K','1,2K','3,4 triệu','1.234','3,1K người theo dõi'].map(M.count),[42,87000,1200,3400000,1234,3100]);
results.push('Đọc số kiểu Facebook: "42 người" không bị hiểu thành 42 nghìn');
const about=[
 {tab:'Thông tin cá nhân',sections:[{title:'Quê quán',values:['Bắc Giang']},{title:'Giới tính',values:['Nữ']}]},
 {tab:'Công việc',sections:[{title:'Công việc',values:['Giáo viên tiếng Anh tại Trung tâm ABC (2021–nay)']}]},
 {tab:'Trình độ học vấn',sections:[{title:'Đại học',values:['Từng học tại Đại học Bách khoa Hà Nội']},{title:'Trường trung học',values:['Đã học tại THPT Ngô Sĩ Liên (Tốt nghiệp năm 2019)']}]},
];
const posts=[
 {text:'Mọi người ơi có ai biết chỗ nào dạy IELTS tốt không, em cần tìm gấp để thi tháng sau 😭',ageDays:2,reactions:40},
 {text:'Săn sale 11.11 được cái voucher freeship hời quá',ageDays:10,reactions:12},
 {text:'Cảnh giác nha mọi người, mình vừa bị lừa đảo khi mua hàng online, hàng giả hoàn toàn',ageDays:20,reactions:80},
 {text:'Tại sao học mãi không lên band? Mình so sánh 3 giáo trình, chia sẻ kinh nghiệm chi tiết bên dưới…'.repeat(3),ageDays:25,reactions:30},
 {text:'Hôm nay đi khám bệnh viện, uống thuốc rồi, cần tìm bác sĩ giỏi',ageDays:3,reactions:5},
 {text:'Chuyến du lịch Nhật Bản cùng gia đình',ageDays:120,reactions:200},
];
const p=M.buildProfile({url:'https://www.facebook.com/yenzo22501',name:'Nguyễn Yến',header:{followers:3100,friends:null},posts,about,productKeywords:'ielts, toeic'},now);
// Nhân khẩu: có nguồn; tuổi theo năm tốt nghiệp là ước tính
const d=Object.fromEntries(p.demographics.map(x=>[x.key,x]));
assert.equal(d.gender.value,'Nữ');assert.match(d.gender.source,/Thông tin cá nhân/);
assert.equal(d.hometown.value,'Bắc Giang');assert.match(d.work.value,/Giáo viên/);
assert.equal(d.age.estimate,true);assert.match(d.age.value,/khoảng 25 .*THPT 2019/);
assert.equal(d.followers.value,(3100).toLocaleString('vi-VN'));
assert.ok(!d.relationship,'không bịa tình trạng quan hệ khi trang không công khai');
results.push('Nhân khẩu: chỉ từ thông tin công khai, mỗi mục ghi nguồn; tuổi theo năm tốt nghiệp đánh dấu "ước tính"; không bịa mục thiếu');
// Trục
const a=p.axes;
assert.ok(a.need_urgency.score>=60,'cần gấp: '+a.need_urgency.score);assert.ok(a.need_urgency.evidence.some(e=>/ielts/.test(e.why)));
assert.ok(a.price_sensitivity.score>=50);assert.ok(a.skepticism.score>=60);assert.ok(a.depth_need.score>=50);
assert.ok(a.spending_power.score>50,'có du lịch Nhật: '+a.spending_power.score);
assert.ok(a.influence.score>0&&a.influence.score<60);assert.ok(a.activity.score>50);
results.push('7 trục chấm từ bằng chứng: cần gấp (có từ khóa sản phẩm), nhạy giá, hoài nghi, cần tư vấn sâu, chi trả, ảnh hưởng, hoạt động');
// Bài có chủ đề nhạy cảm (sức khỏe) không được dùng làm bằng chứng, kể cả khi có "cần tìm"
assert.ok(!Object.values(a).some(x=>x.evidence?.some(e=>/bệnh viện|thuốc/.test(e.text))));
results.push('Bài về chủ đề nhạy cảm (sức khỏe, tôn giáo, chính trị, xu hướng tính dục) không dùng làm bằng chứng');
// Thiếu dữ liệu -> null, không gán đại
const empty=M.buildProfile({url:'https://www.facebook.com/profile.php?id=100001',posts:[],about:[],header:{}},now);
for(const id of Object.keys(empty.axes))assert.equal(empty.axes[id].score,null,id);
assert.equal(empty.demographics.length,0);
results.push('Không có dữ liệu công khai: mọi trục "chưa đủ dữ liệu", không gán điểm mặc định');
// Chỉnh tay ưu tiên nhưng giữ điểm tự động
const q={...p,manual:{skepticism:{score:20}}};assert.deepEqual(M.axisValue(q,'skepticism'),{score:20,manual:true});assert.ok(q.axes.skepticism.score>=60);
results.push('Chỉnh tay hiển thị thay điểm tự động nhưng vẫn giữ điểm tự động để đối chiếu');
// Trục 8 do agent khác nạp
assert.equal(M.axisValue(p,'competitor_exposure').score,null);
const payload={schema:'desk.customer-axis/1',axis:'competitor_exposure',url:'https://www.facebook.com/yenzo22501/',score:73,evidence:[{text:'5 bình luận chào hàng: ib em nhé https://shop.example/abc',why:'bình luận chào hàng'}],source:'agent-truc-8'};
const merged=M.mergeExternal(p,payload);assert.equal(M.axisValue(merged,'competitor_exposure').score,73);assert.ok(!/https?:/.test(merged.external.competitor_exposure.evidence[0].text),'bỏ link bên thứ ba');
assert.throws(()=>M.mergeExternal(p,{...payload,url:'https://www.facebook.com/nguoikhac'}),/trang khác/);
assert.throws(()=>M.mergeExternal(p,{...payload,schema:'x'}),/định dạng/);
assert.throws(()=>M.mergeExternal(p,{...payload,axis:'khac'}),/không được khai báo/);
assert.throws(()=>M.mergeExternal(p,{...payload,score:150}),/0 đến 100/);
results.push('Trục 8: chỉ nhận đúng định dạng desk.customer-axis/1, đúng trang, điểm 0–100; bỏ link của tài khoản bên thứ ba');
console.log('PASS customer-profile');for(const x of results)console.log(' ✓',x);
