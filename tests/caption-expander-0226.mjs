// Post Research 0.2.26.9: caption có nút "Xem thêm" / "Ẩn bớt" bên trong phải đọc được từ bài gốc.
// Lỗi cũ: khối caption bị loại vì có nút bên trong, nên Post Research dùng bản xem trước bị cắt ở dòng thời gian (kết thúc "…"),
// và mọi bài đó bị FB Desk chặn "caption rút gọn". Chạy THẬT caption.js + scan.js (Chrome + Playwright).
// Chạy: node tests/caption-expander-0226.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
let require=createRequire(import.meta.url);
try{require.resolve('playwright');}catch{require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');}
const {chromium}=require('playwright');
const dir=process.env.RESEARCH_DIR?new URL(process.env.RESEARCH_DIR):new URL('../post-research/',import.meta.url);
const caption=readFileSync(new URL('caption.js',dir),'utf8'),scan=readFileSync(new URL('scan.js',dir),'utf8');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
const FULL='TUYỂN SINH LỚP TOEIC FOUNDATION 23/12 KHAI GIẢNG\n- Sĩ số: 10-12 người\n- Hình thức: onl qua Zoom\nChúc mọi người cuối tuần mưa mát lạnh vui vẻ';
const SHORT='TUYỂN SINH LỚP TOEIC FOUNDATION 23/12 KHAI GIẢNG…';
// Khối caption như Facebook: bản thu gọn + nút "Xem thêm"; bấm thì thành bản đầy đủ + nút "Ẩn bớt".
const captionBlock=`<div dir="auto" id="cap"><span id="capText">${SHORT}</span> <div role="button" tabindex="0" id="more">Xem thêm</div></div>
<script>document.getElementById('more').onclick=function(){document.getElementById('capText').innerText=${JSON.stringify(FULL)};this.innerText='Ẩn bớt';};</script>`;
const comment=`<div role="article" aria-label="Bình luận dưới tên Thư Nguyễn"><a href="https://www.facebook.com/thu">Thư Nguyễn</a><div dir="auto">cô cho em đăng kí ạ</div><div role="button">Thích</div><div role="button">Xem thêm</div></div>`;
async function page(url,html){
 const ctx=await browser.newContext();const p=await ctx.newPage();
 await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body>'+html+'</body></html>'}));
 await p.goto(url);await p.addScriptTag({content:caption});await p.addScriptTag({content:scan});return {p,ctx};
}
// 1) Trang video/Reel (không có khối "message"): đọc caption sau khi mở "Xem thêm".
{
 const {p,ctx}=await page('https://www.facebook.com/yenzo22501/videos/623384932561556/','<div role="main"><h2><a href="https://www.facebook.com/yenzo22501">Nguyễn Yến</a></h2>'+captionBlock+'<div dir="auto"><div role="button">Thích</div><div role="button">Bình luận</div></div>'+comment+'</div>');
 const before=await p.evaluate(()=>researchCaption.read(document.querySelector('[role=main]')));
 assert.equal(before.partial,true);assert.match(before.text,/KHAI GIẢNG…$/);
 await p.click('#more');
 const after=await p.evaluate(()=>researchCaption.read(document.querySelector('[role=main]')));
 assert.equal(after.text,FULL);assert.equal(after.partial,false);assert.ok(!/Ẩn bớt|…/.test(after.text));
 await ctx.close();
 results.push('Trang video/Reel: caption có nút "Xem thêm"/"Ẩn bớt" đọc được đủ, không còn "…", không lẫn chữ nút');
}
// 2) Trang ảnh: researchScan('post') bấm "Xem thêm" trong khung bên phải rồi đọc caption đầy đủ.
{
 const {p,ctx}=await page('https://www.facebook.com/photo/?fbid=3188903534641189','<div role="main"><img src="https://scontent.xx.fbcdn.net/a.jpg" width="600" height="600"></div>'+
  '<div role="complementary"><h2><a href="https://www.facebook.com/yenzo22501">Nguyễn Yến</a></h2><div dir="auto">8 Tháng 11 lúc 02:40, xem bài viết</div>'+captionBlock+comment+'</div>');
 const r=await p.evaluate(()=>globalThis.researchScan('post'));
 assert.equal(r.body,FULL);assert.equal(r.captionPartial,false);assert.equal(r.captionMethod,'photo-panel');
 await ctx.close();
 results.push('Trang ảnh: khung bên phải đọc đủ caption (bài 2 Docs "yến 5": 49 ký tự kèm "…" → đủ)');
}
// 3) Khối chứa nút THẬT (Thích, Bình luận) vẫn bị loại, không bị nhận nhầm là caption.
{
 const {p,ctx}=await page('https://www.facebook.com/yenzo22501/videos/1/','<div role="main"><div dir="auto">Bài không caption <div role="button">Thích</div></div></div>');
 const r=await p.evaluate(()=>researchCaption.read(document.querySelector('[role=main]')));
 assert.equal(r.text,'');
 await ctx.close();
 results.push('Khối có nút thật (Thích/Bình luận) vẫn không được nhận là caption');
}
await browser.close();
console.log('PASS caption-expander-0226');for(const x of results)console.log(' ✓',x);
