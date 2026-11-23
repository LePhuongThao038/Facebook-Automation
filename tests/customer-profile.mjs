// Hồ sơ khách hàng: radar Nhân khẩu + radar Tính cách, nạp 8 trục mua hàng (agent khác), ghép persona, mốc chuẩn khái niệm.
// Chạy: node tests/customer-profile.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadSources,buildGlossary} from '../customer-profile/build-glossary.mjs';
const {M,C}=loadSources();const results=[];
const now=new Date('2026-11-23T10:00:00+07:00');
assert.deepEqual(['42 người','87K','1,2K','3,4 triệu','1.234'].map(M.count),[42,87000,1200,3400000,1234]);
// ---- Mốc chuẩn khái niệm: mọi trục, mọi mức đều có định nghĩa; KHAI-NIEM.md khớp nguồn ----
for(const a of [...M.DEMO_AXES,...M.TRAIT_AXES])assert.ok(C.axes[a.id]?.definition,'thiếu định nghĩa trục '+a.id);
for(const a of M.DEMO_AXES)for(const [,,name] of a.bands)assert.ok(C.axes[a.id].levels?.[name]?.definition,'thiếu định nghĩa mức '+a.label+' › '+name);
for(const g of ['Sinh viên','Đi làm','Trung niên','Xin việc','Dân VP','Thu nhập cao','Lao động','Bình thường','VIP'])assert.ok(M.DEMO_AXES.some(a=>a.bands.some(b=>b[2]===g)),'thiếu nhóm Sheet '+g);
for(const g of ['Ngây thơ','Hiểu biết','Cá tính mạnh','Ngốc/Ngã cây'])assert.ok(M.TRAIT_AXES.some(a=>a.sheet===g),'thiếu nét Sheet '+g);
assert.match(C.axes.goofy.notConfused,/KHÔNG có nghĩa là đần độn/);
const md=readFileSync(new URL('../customer-profile/KHAI-NIEM.md',import.meta.url),'utf8').replace(/\r\n/g,'\n');
assert.equal(md,buildGlossary({M,C}),'KHAI-NIEM.md lệch nguồn: chạy node customer-profile/build-glossary.mjs');
results.push('Mốc chuẩn: mọi trục và mọi mức (gồm đủ nhóm của Sheet) có định nghĩa; KHAI-NIEM.md khớp nguồn');
// ---- Radar nhân khẩu ----
const about=[
 {tab:'Thông tin cá nhân',sections:[{title:'Quê quán',values:['Bắc Giang']},{title:'Giới tính',values:['Nữ']}]},
 {tab:'Công việc',sections:[{title:'Công việc',values:['Giáo viên tiếng Anh tại Trung tâm ABC']}]},
 {tab:'Trình độ học vấn',sections:[{title:'Đại học',values:['Từng học tại Đại học Bách khoa Hà Nội']},{title:'Trường trung học',values:['Đã học tại THPT Ngô Sĩ Liên (Tốt nghiệp năm 2019)']}]},
];
const posts=[
 {text:'Hôm nay đi học quên mang sách, quê xỉu =)) toang thật sự 😂 haha',ageDays:2},
 {text:'Cuối tuần cả hội đi chơi Ba Vì, tụ tập vui quên lối về!',ageDays:10},
 {text:'3 lưu ý khi tự học IELTS: thứ nhất chọn giáo trình, thứ hai luyện đề, tóm lại phải kiên trì. Kinh nghiệm của mình…'.repeat(3),ageDays:20},
 {text:'Mục tiêu năm nay: chứng chỉ IELTS 7.0, cố gắng tự học mỗi ngày',ageDays:25},
 {text:'Hôm nay đi khám bệnh viện, uống thuốc rồi, mệt quá huhu',ageDays:3},
 {text:'Chuyến du lịch Nhật Bản cùng gia đình, bố mẹ vui lắm',ageDays:120},
];
const p=M.buildProfile({url:'https://www.facebook.com/yenzo22501',name:'Nguyễn Yến',header:{followers:3100},posts,about},now);
const d=p.demographic;
assert.equal(M.bandOf(M.DEMO_AXES[0],d.age.score)[2],'Đi làm');assert.match(d.age.evidence[0].text,/khoảng 25 .*THPT 2019/);
assert.equal(M.bandOf(M.DEMO_AXES.find(a=>a.id==='income'),d.income.score)[2],'Dân VP');
assert.equal(M.bandOf(M.DEMO_AXES.find(a=>a.id==='education'),d.education.score)[2],'Đại học');
assert.equal(d.urban.confidence,'thấp');assert.match(d.urban.evidence[0].why,/quê quán/);
assert.equal(d.family.score,null);
results.push('Nhân khẩu: tuổi → "Đi làm" (ước tính từ năm tốt nghiệp), thu nhập → "Dân VP", học vấn → "Đại học"; đô thị theo quê quán đánh dấu tin cậy thấp; không công khai thì để trống');
// ---- Radar tính cách ----
const t=p.personality;
assert.ok(t.goofy.score>=40,'goofy '+t.goofy.score);assert.ok(t.knowledgeable.score>=40);assert.ok(t.extravert.score>=30);assert.ok(t.driven.score>=40);
assert.ok(!Object.values(t).some(x=>x.evidence.some(e=>/bệnh viện|thuốc/.test(e.text))),'bài sức khỏe không được làm bằng chứng');
results.push('Tính cách: chấm theo cách viết, có bằng chứng; bài về chủ đề nhạy cảm không dùng làm bằng chứng');
// ---- Xếp nhóm theo Sheet + persona ----
const groups=Object.fromEntries(M.sheetGroups(p).map(g=>[g.group,g.value]));
assert.equal(groups['Tuổi'],'Đi làm');assert.equal(groups['Thu nhập'],'Dân VP');assert.ok(['Hiểu biết','Ngốc/Ngã cây',null].includes(groups['Cá tính']));
let per=M.persona(p);assert.equal(per.complete,false);assert.deepEqual([...per.missing],['8 trục mua hàng (agent khác)']);
results.push('Xếp nhóm Sheet (Tuổi/Thu nhập/Đẳng cấp/Cá tính) từ radar; persona báo rõ còn thiếu 8 trục mua hàng');
// ---- Nạp 8 trục mua hàng của agent khác ----
const buying={schema:'desk.customer-buying/1',url:'https://www.facebook.com/yenzo22501/',source:'agent-mua-hang',axes:[
 {id:'need_urgency',label:'Mức cần gấp',score:82,definition:'Đang chủ động tìm mua.',evidence:[{text:'Hỏi chỗ học IELTS https://x.example/a',why:'bài 2 ngày trước'}]},
 {id:'price_sensitivity',label:'Nhạy cảm giá',score:20},{id:'competitor_exposure',label:'Đã bị đối thủ tiếp cận',score:null}]};
const q=M.mergeBuying(p,buying);assert.equal(q.buying.axes.length,3);assert.ok(!/https?:/.test(q.buying.axes[0].evidence[0].text),'bỏ link bên thứ ba');
assert.equal(M.axisValue(q,'need_urgency').score,82);
per=M.persona(q);assert.equal(per.complete,true);assert.deepEqual([...per.buyingHigh],['Mức cần gấp (82)']);assert.deepEqual([...per.buyingLow],['Nhạy cảm giá (20)']);
assert.throws(()=>M.mergeBuying(p,{...buying,url:'https://www.facebook.com/khac'}),/trang khác/);
assert.throws(()=>M.mergeBuying(p,{...buying,schema:'x'}),/định dạng/);
assert.throws(()=>M.mergeBuying(p,{...buying,axes:[{id:'age',score:1}]}),/trùng với trục nhân khẩu/);
assert.throws(()=>M.mergeBuying(p,{...buying,axes:[{id:'a1',score:150}]}),/0 đến 100/);
results.push('Nạp 8 trục mua hàng: đúng định dạng, đúng trang, không trùng trục, điểm 0–100, bỏ link bên thứ ba; đủ 3 phần thì persona hoàn chỉnh');
// ---- Thiếu dữ liệu & chỉnh tay ----
const empty=M.buildProfile({url:'https://www.facebook.com/profile.php?id=100001',posts:[],about:[],header:{}},now);
for(const x of [...Object.values(empty.demographic),...Object.values(empty.personality)])assert.equal(x.score,null);
const m={...p,manual:{goofy:{score:5}}};assert.deepEqual(JSON.parse(JSON.stringify(M.axisValue(m,'goofy'))),{score:5,manual:true});assert.ok(m.personality.goofy.score>=40);
results.push('Không có dữ liệu công khai: mọi trục "chưa đủ dữ liệu"; chỉnh tay hiển thị nhưng giữ điểm tự động');
console.log('PASS customer-profile');for(const x of results)console.log(' ✓',x);
