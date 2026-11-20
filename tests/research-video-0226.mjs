// Post Research 0.2.26.7: chạy THẬT caption.js + scan.js trên trang giả lập (Chrome + Playwright).
// Tái hiện Docs "yến 5": bài ảnh /posts/ (bài 13, 18) bị xuất 7 dòng Media JSON lạ, mỗi Reel thừa một mã lạ.
// Chạy: node tests/research-video-0226.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
let require=createRequire(import.meta.url);
try{require.resolve('playwright');}catch{require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');}
const {chromium}=require('playwright');
const caption=readFileSync(new URL('../post-research/caption.js',import.meta.url),'utf8');
const scan=readFileSync(new URL('../post-research/scan.js',import.meta.url),'utf8');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
// Mã video "lạ" của cả trang (video gợi ý, cột bên), như trong Docs: trùng nhau giữa các bài khác nhau.
const junk=['28542968285397561','4526514884296157','1576712110878005'];
const payload=ids=>'<script type="application/json">'+JSON.stringify({require:[ids.map(id=>({video_id:id,url:'https:\/\/www.facebook.com\/reel\/'+id}))]})+'</script>';
async function scanPage(url,html){
 const ctx=await browser.newContext();const p=await ctx.newPage();
 await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="vi"><head><meta charset="utf-8"></head><body>'+html+'</body></html>'}));
 await p.goto(url);
 await p.addScriptTag({content:caption});await p.addScriptTag({content:scan});
 const out=await p.evaluate(()=>globalThis.researchScan('post'));
 await ctx.close();return out;
}
const photoPost=(extra='')=>'<div role="main"><div role="article" aria-label="Bài viết của Nguyễn Yến"><h2><a href="https://www.facebook.com/yenzo22501">Nguyễn Yến</a></h2>'+
 '<div data-ad-preview="message">Chúc mừng năm mới cả nhà</div>'+
 '<a href="https://www.facebook.com/photo/?fbid=1&set=pcb.9"><img src="https://scontent.xx.fbcdn.net/a.jpg" width="300" height="300"></a>'+
 '<a href="https://www.facebook.com/photo/?fbid=2&set=pcb.9"><img src="https://scontent.xx.fbcdn.net/b.jpg" width="300" height="300"></a>'+extra+
 '<div role="article" aria-label="Bình luận dưới tên Thư Nguyễn"><a href="https://www.facebook.com/thu">Thư Nguyễn</a><div dir="auto">chúc mừng năm mới</div><video src="https://video.xx.fbcdn.net/gif.mp4" width="200" height="120"></video></div>'+
 '</div></div>';

// 1) Bài 13/18: bài ảnh, có GIF/video trong bình luận, trang chứa mã video của cả trang -> không phải video, không link.
{
 const r=await scanPage('https://www.facebook.com/yenzo22501/posts/pfbid0vzGk',photoPost()+payload(junk));
 assert.equal(r.video,false,'bài ảnh bị coi là video');
 assert.deepEqual(r.videoLinks,[]);
 assert.equal(r.images.length,2);
 results.push('Bài ảnh /posts/ có video trong bình luận + mã video của cả trang: không là video, không Media JSON (bài 13, 18)');
}
// 2) Reel: chỉ đúng mã của Reel đang mở, không thêm Reel gợi ý (DOM hay JSON).
{
 const html='<div role="main"><div role="article" aria-label="Reel của Nguyễn Yến"><h2><a href="https://www.facebook.com/yenzo22501">Nguyễn Yến</a></h2><div data-ad-preview="message">Hai liền chị gửi cả nhà</div><video src="blob:x" width="300" height="500"></video>'+
  '<a href="https://www.facebook.com/reel/2224052371794951/">Reel tiếp theo</a></div></div>'+payload(junk);
 const r=await scanPage('https://www.facebook.com/reel/1533727751019808/',html);
 assert.equal(r.video,true);
 assert.deepEqual(r.videoLinks.map(h=>h.match(/\d{6,}/)[0]),['1533727751019808']);
 const r2=await scanPage('https://www.facebook.com/yenzo22501/videos/2660582440940562/',html.replace('Reel của','Video của'));
 assert.deepEqual(r2.videoLinks.map(h=>h.match(/\d{6,}/)[0]),['2660582440940562']);
 results.push('Reel / trang video: chỉ một link đúng mã trên địa chỉ trang, không thêm mã gợi ý (bài 7, 8, 9, 15, 20, 22)');
}
// 3) Bài /posts/ có video thật, DOM không có link: JSON có đúng 1 mã -> giữ (tính năng 0.2.26.2); nhiều mã hơn số video -> không đoán.
{
 const vid='<video src="blob:x" width="300" height="300"></video>';
 const one=await scanPage('https://www.facebook.com/yenzo22501/posts/pfbidVID',photoPost(vid)+payload(['1460978292102730']));
 assert.equal(one.video,true);
 assert.deepEqual(one.videoLinks.map(h=>h.match(/\d{6,}/)[0]),['1460978292102730']);
 const many=await scanPage('https://www.facebook.com/yenzo22501/posts/pfbidVID2',photoPost(vid)+payload(['1460978292102730',...junk]));
 assert.equal(many.video,true);
 assert.deepEqual(many.videoLinks,[]);
 results.push('Bài có video thật mà DOM không có link: 1 mã trong JSON thì nhận; mã nhiều hơn số video thì để trống, không đoán');
}
// 4) Album có ô video với link riêng trong DOM: vẫn lấy đúng link đó (không đổi hành vi cũ).
{
 const vid='<a href="https://www.facebook.com/yenzo22501/videos/pcb.9/1116551721354669/"><video src="blob:x" width="300" height="300"></video></a>';
 const r=await scanPage('https://www.facebook.com/yenzo22501/posts/pfbidALB',photoPost(vid)+payload(junk));
 assert.deepEqual(r.videoLinks.map(h=>h.match(/(\d{6,})\/?$/)[1]),['1116551721354669']);
 results.push('Album có ô video kèm link riêng: giữ đúng link đó, bỏ mã lạ của trang');
}
await browser.close();
console.log('PASS research-video-0226');for(const x of results)console.log(' ✓',x);
