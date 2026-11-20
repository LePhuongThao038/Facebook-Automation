// Post Research 0.2.26.8: chạy THẬT các hàm mới (Chrome + Playwright) trên trang giả lập dựng theo cấu trúc
// Facebook đã soi ngày 20/11 (Page 23 Dota TV, trang cá nhân Nguyễn Yến).
// Chạy: node tests/research-profile-0226.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
let require=createRequire(import.meta.url);
try{require.resolve('playwright');}catch{require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');}
const {chromium}=require('playwright');
const src=f=>readFileSync(new URL('../post-research/'+f,import.meta.url),'utf8');
const fn=(file,name)=>{const s=src(file);const a=s.indexOf('function '+name+'(');assert.ok(a>=0,name);let i=s.indexOf('{',a),d=0;for(;i<s.length;i++){if(s[i]==='{')d++;else if(s[i]==='}'&&--d===0)break}return s.slice(a,i+1)};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
async function page(url,html){
 const ctx=await browser.newContext();const p=await ctx.newPage();
 await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>.h,.s,.v{display:block}.h{font-size:17px;font-weight:600}.s{font-size:13px}.v{font-size:15px}</style></head><body>'+html+'</body></html>'}));
 await p.goto(url);return {p,ctx};
}
// Khung Giới thiệu kiểu mới: thanh tab con directory_* + khung nội dung, bên dưới là Reels (không được lấy).
const about=(owner,active,panel)=>'<div role="main"><div><div><div role="tablist">'+
 [['Giới thiệu','directory_intro'],['Hạng mục','directory_category'],['Chi tiết','directory_basic_info'],['Liên kết','directory_links'],['Công việc','directory_work'],['Tên','directory_names']]
  .map(([t,p])=>'<a role="tab" aria-selected="'+(p===active)+'" href="https://www.facebook.com/'+owner+'/'+p+'">'+t+'</a>').join('')+
 '</div><h2>Giới thiệu</h2></div><div>'+panel+'</div></div><div><h2>Reels</h2><a href="https://www.facebook.com/reel/1178824691494388/">3,2K</a></div></div>';

// 1) Trang Giới thiệu: tiêu đề mục, giá trị, nhãn phụ ghép vào giá trị, chống trùng, link thật qua l.php, bỏ Reels.
{
 const {p,ctx}=await page('https://www.facebook.com/23dotatv/directory_basic_info',about('23dotatv','directory_basic_info',
  '<div><span class="h">Địa chỉ</span><div><span class="v">Hanoi, Vietnam, 100000</span><span class="s">Địa chỉ</span></div></div>'+
  '<div><span class="h">Giờ hoạt động</span><ul><li><span class="v">Luôn mở cửa</span></li></ul><span class="s">Giờ hoạt động</span></div>'+
  '<div><span class="h">Liên kết</span><ul><li><a href="https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.youtube.com%2F%4023dotatv%3Ffbclid%3Dx&h=AT"><span class="v">youtube.com/@23dotatv</span><span class="s">youtube.com/@23dotatv</span></a></li></ul></div>'+
  '<div><span class="h">Công việc</span><div><span class="v">Từng làm Trưởng ban Truyền thông tại CLB Guitar</span><span class="s">31 tháng 12, 2019–30 tháng 1, 2021</span></div></div>'+
  '<div><span class="h">Các tên khác</span><div><span class="v">Tén</span><span class="s">Tên khác</span></div><div><span class="v">lindsey</span><span class="s">Cách viết khác</span></div></div>'));
 const r=await p.evaluate(code=>(0,eval)('('+code+')')(),fn('character.js','readAboutPanel'));
 const m=Object.fromEntries(r.sections.map(s=>[s.title,s.values]));
 assert.deepEqual(m['Địa chỉ'],['Hanoi, Vietnam, 100000']);
 assert.deepEqual(m['Giờ hoạt động'],['Luôn mở cửa']);
 assert.deepEqual(m['Liên kết'],['youtube.com/@23dotatv']);
 assert.deepEqual(m['Công việc'],['Từng làm Trưởng ban Truyền thông tại CLB Guitar (31 tháng 12, 2019–30 tháng 1, 2021)']);
 assert.deepEqual(m['Các tên khác'],['Tén (Tên khác)','lindsey (Cách viết khác)']);
 assert.ok(!JSON.stringify(r).includes('3,2K'),'lẫn phần Reels');
 assert.deepEqual(r.links,['https://www.youtube.com/@23dotatv']);
 assert.equal(r.tabs.length,6);assert.equal(r.tab,'Chi tiết');
 // Điền trường cố định + dòng Docs
 const c=await p.evaluate(([a,b,about])=>{const fill=(0,eval)('('+a+')'),rows=(0,eval)('('+b+')');const c={out:{},about:[{tab:'Chi tiết',...about}]};fill(c);return {out:c.out,rows:rows(c).map(x=>x.t)}},[fn('character.js','fillFromAbout'),fn('character.js','aboutRows'),{sections:r.sections,links:r.links}]);
 assert.equal(c.out['Nickname'],'Tén · lindsey');
 assert.equal(c.out['Sống tại'],'Hanoi, Vietnam, 100000');
 assert.match(c.out['Thông tin liên hệ'],/^Liên kết: youtube\.com\/@23dotatv$/);
 assert.ok(c.rows.includes('Chi tiết › Giờ hoạt động: Luôn mở cửa'));
 assert.ok(c.rows.includes('Liên kết: https://www.youtube.com/@23dotatv'));
 await ctx.close();
 results.push('Giới thiệu kiểu directory_*: đủ mục, nhãn phụ (năm làm việc, loại tên) ghép đúng, không trùng, link thật, không lẫn Reels; điền Nickname/Sống tại/Liên hệ');
}
// 2) Trang không có tab con directory_*: trả null (không bịa dữ liệu).
{
 const {p,ctx}=await page('https://www.facebook.com/someone','<div role="main"><h2>Bài viết</h2><span class="h">Địa chỉ</span></div>');
 assert.equal(await p.evaluate(code=>(0,eval)('('+code+')')(),fn('character.js','readAboutPanel')),null);
 await ctx.close();
 results.push('Không có trang Giới thiệu kiểu mới: không trả dữ liệu');
}
// 3) Trang ảnh thuộc một bài viết: tìm link "Xem bài viết" (bài 10 của Docs 23 Dota TV).
{
 const {p,ctx}=await page('https://www.facebook.com/photo/?fbid=1802436918548574','<div role="main"><img src="x.jpg"></div><div role="complementary"><span>Ảnh này nằm trong một bài viết.</span><a href="https://www.facebook.com/23dotatv/posts/pfbid02impr?__cft__[0]=x&__tn__=R">Xem bài viết</a></div>');
 assert.equal(await p.evaluate(code=>(0,eval)('('+code+')')(),fn('recovery.js','photoParentPost')),'https://www.facebook.com/23dotatv/posts/pfbid02impr');
 await ctx.close();
 const {p:p2,ctx:c2}=await page('https://www.facebook.com/photo/?fbid=2','<div role="main"><img src="x.jpg"></div><div role="complementary"><span>Nhớ thời sinh viên</span><a href="https://www.facebook.com/yenzo22501">Nguyễn Yến</a></div>');
 assert.equal(await p2.evaluate(code=>(0,eval)('('+code+')')(),fn('recovery.js','photoParentPost')),'');
 await c2.close();
 results.push('Trang ảnh "Ảnh này nằm trong một bài viết": lấy link bài gốc (bỏ tham số theo dõi); ảnh đứng riêng thì giữ nguyên');
}
await browser.close();
console.log('PASS research-profile-0226');for(const x of results)console.log(' ✓',x);
