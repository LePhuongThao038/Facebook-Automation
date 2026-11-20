// 3.8.7: sau khi bấm Đăng phải chờ Facebook đóng hộp soạn (album/video còn đang gửi), và tìm link bài
// có emoji (Facebook vẽ emoji bằng <img alt>). Mô phỏng, không kết nối Facebook thật.
// Chạy: node tests/post-flow-387.mjs (cần Chrome và Playwright: npm install --no-save playwright).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {facebookBot} from '../facebook-bot.js';
import {inspectPost} from '../published-link.js';
let require=createRequire(import.meta.url);
try{require.resolve('playwright');}catch{require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');}
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const UID='100001',actor={url:'https://www.facebook.com/profile.php?id='+UID,name:'UID '+UID};
const results=[];

// Hộp soạn tối giản: bấm Đăng -> hiện "Đang đăng..." rồi (tùy chọn) đóng hộp soạn hoặc báo lỗi.
async function composer(o={}){
 const ctx=await browser.newContext();await ctx.addCookies([{name:'c_user',value:UID,domain:'.facebook.com',path:'/',secure:true}]);
 const p=await ctx.newPage();
 await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"><body><main></main></body></html>'}));
 await p.goto('https://www.facebook.com/profile.php?id='+UID);
 await p.evaluate(o=>{
  document.documentElement.dataset.facebookDeskJob='job';document.documentElement.dataset.facebookDeskToken='token';
  const root=document.createElement('div');root.setAttribute('role','dialog');root.setAttribute('aria-label','Tạo bài viết');
  root.innerHTML='<h2>Tạo bài viết</h2><div contenteditable="true" role="textbox" data-lexical-editor="true">x</div><div role="button" aria-label="Đăng">Đăng</div>';
  document.body.append(root);
  root.querySelector('[aria-label="Đăng"]').onclick=()=>{
   root.querySelector('h2').textContent='Tạo bài viết · Đang đăng...';
   if(o.error)setTimeout(()=>{const a=document.createElement('div');a.setAttribute('role','alert');a.textContent='Không thể đăng bài viết. Vui lòng thử lại.';document.body.append(a);},o.error);
   if(o.closeAfter)setTimeout(()=>root.remove(),o.closeAfter);
   if(o.toastUntil){const t=document.createElement('div');t.setAttribute('role','status');t.textContent='Đang tải lên bài viết của bạn…';document.body.append(t);setTimeout(()=>t.remove(),o.toastUntil);}
  };
  root.querySelector('[aria-label="Đăng"]').click();
 },o);
 return {p,ctx};
}
const run=(p,name,extra={})=>p.evaluate(({fn,name,payload})=>(0,eval)('('+fn+')')(name,payload),{fn:facebookBot.toString(),name,payload:{jobId:'job',token:'token',actor,text:'x',expectedMedia:[],...extra}});

// Timeline có caption chứa emoji dạng <img alt>, như Facebook thật.
async function timeline(posts){
 const ctx=await browser.newContext();const p=await ctx.newPage();
 await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div role="main"></div></body></html>'}));
 await p.goto('https://www.facebook.com/profile.php?id='+UID);
 await p.evaluate(({posts,UID})=>{
  for(const [html,id] of posts){
   const card=document.createElement('div');
   card.innerHTML=`<div><h2><strong><a href="https://www.facebook.com/profile.php?id=${UID}&__cft__[0]=a">Hiền Clone</a></strong></h2>
    <span><a class="ts" href="https://www.facebook.com/permalink.php?story_fbid=pfbid0${id}&id=${UID}" aria-label="1 phút">1 phút</a></span>
    <div aria-label="Hành động với bài viết này" role="button">…</div></div>
    <div data-ad-rendering-role="story_message"><div dir="auto">${html}</div></div>`;
   document.querySelector('[role=main]').append(card);
  }
 },{posts,UID});
 return {p,ctx};
}
const emoji=(alt)=>`<img alt="${alt}" src="data:," width="16" height="16">`;
const look=(p,text)=>p.evaluate(({fn,req})=>(0,eval)('('+fn+')')(req),{fn:inspectPost.toString(),req:{actor,text,open:false}});

try{
 {const {p,ctx}=await composer({closeAfter:2500});const r=await run(p,'published',{timeoutMs:20000});assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.published,true);assert.ok(r.waitedMs>=2500,'phải chờ hộp soạn đóng: '+r.waitedMs);await ctx.close();results.push('album/video: chờ "Đang đăng..." xong, hộp soạn đóng mới coi là đã đăng ('+r.waitedMs+' ms)');}
 {const {p,ctx}=await composer({closeAfter:300,toastUntil:3500});const r=await run(p,'published',{timeoutMs:20000});assert.equal(r.published,true);assert.ok(r.waitedMs>=3500,'phải chờ thông báo Đang tải lên: '+r.waitedMs);await ctx.close();results.push('video: hộp soạn đóng nhưng còn "Đang tải lên…": chờ tới khi xong');}
 {const {p,ctx}=await composer({error:800});const r=await run(p,'published',{timeoutMs:20000});assert.equal(r.ok,false);assert.match(r.error,/báo lỗi sau khi bấm Đăng/);await ctx.close();results.push('Facebook báo "Không thể đăng": không ghi nhận đã đăng');}
 {const {p,ctx}=await composer({});const r=await run(p,'published',{timeoutMs:15000});assert.equal(r.ok,true);assert.equal(r.published,false);await ctx.close();results.push('hộp soạn không đóng: không ghi đã đăng, giữ tab');}
 {const {p,ctx}=await timeline([['Bài cũ không liên quan','old'],['Em ơi đừng sợ mất vì vạn vật của đất trời'+emoji('✨'),'new']]);const r=await look(p,'Em ơi đừng sợ mất vì vạn vật của đất trời✨');assert.match(r.url||'',/pfbid0new/,JSON.stringify(r));await ctx.close();results.push('caption có emoji (img alt): tìm được link');}
 {const {p,ctx}=await timeline([['Tháng 4 của em'+emoji('❤'),'new']]);const r=await look(p,'Tháng 4 của em❤️');assert.match(r.url||'',/pfbid0new/,JSON.stringify(r));await ctx.close();results.push('caption ngắn + emoji khác biến thể (❤ / ❤️): tìm được link');}
 {const {p,ctx}=await timeline([['Hi mọi người nhé','other']]);const r=await look(p,'Hi');assert.equal(r.url,undefined,JSON.stringify(r));await ctx.close();results.push('caption ngắn chỉ khớp một phần: không nhận nhầm');}
 {// Đọc HTML xuất từ Google Docs: thụt lề 18pt/36pt (class hoặc style) -> depth 1/2.
  const ctx=await browser.newContext();const p=await ctx.newPage();
  const {readFileSync}=await import('node:fs');const root=new URL('../',import.meta.url);
  await p.route('https://desk.test/**',r=>{const path=new URL(r.request().url()).pathname.slice(1)||'index.html';if(path==='index.html')return r.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});try{return r.fulfill({contentType:'text/javascript',body:readFileSync(new URL(path,root))});}catch{return r.fulfill({status:404,body:''});}});
  await p.goto('https://desk.test/index.html');
  const depths=await p.evaluate(async()=>{const {htmlBlocks}=await import('/scenario.js');
   const html='<html><head><style>.c1{margin-left:18pt;padding-top:0pt}.c2{margin-left:36pt}.c0{margin-left:0pt}</style></head><body><p class="c0"><span>Bạn nữ (A): x</span></p><p class="c1"><span>Tác giả: y</span></p><p class="c2"><span>Bạn nữ (A): z</span></p><p style="padding-left:18pt"><span>Bạn nam (B): w</span></p><p><span>Bạn nam (C): v</span></p></body></html>';
   return htmlBlocks(html).map(b=>b.depth||0);});
  assert.deepEqual(depths,[0,1,2,1,0]);await ctx.close();results.push('HTML Docs: margin-left/padding-left 18pt mỗi cấp -> depth 1, 2');
 }
 {// Chạy thử: chụp cấu trúc (ẩn caption/tên nick) rồi bỏ bản nháp, không bấm Đăng.
  const ctx=await browser.newContext();await ctx.addCookies([{name:'c_user',value:UID,domain:'.facebook.com',path:'/',secure:true}]);
  const p=await ctx.newPage();
  await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"><body><main></main></body></html>'}));
  await p.goto('https://www.facebook.com/profile.php?id='+UID);
  await p.evaluate(()=>{
   window.clicks=0;document.documentElement.dataset.facebookDeskJob='job';document.documentElement.dataset.facebookDeskToken='token';
   const root=document.createElement('div');root.setAttribute('role','dialog');root.setAttribute('aria-label','Tạo bài viết');
   root.innerHTML='<h2>Tạo bài viết</h2><div role="button" aria-label="Đóng">×</div><a aria-label="Trang cá nhân của Thu Trà Clone">Thu Trà Clone</a><div contenteditable="true" role="textbox" data-lexical-editor="true">Caption bí mật của bài 123456789</div><div role="button" aria-label="Ảnh/video, đã thêm 2">Ảnh/video</div><div role="button" aria-label="Đăng">Đăng</div>';
   for(let i=0;i<2;i++){const c=document.createElement('canvas');c.width=c.height=120;const img=document.createElement('img');img.src=c.toDataURL();img.style.cssText='width:110px;height:110px';root.append(img);}
   root.querySelector('[aria-label="Đăng"]').onclick=()=>window.clicks++;
   root.querySelector('[aria-label="Đóng"]').onclick=()=>{const ask=document.createElement('div');ask.setAttribute('role','dialog');ask.setAttribute('aria-label','Bỏ bài viết?');ask.innerHTML='<div role="button">Tiếp tục chỉnh sửa</div><div role="button">Bỏ</div>';ask.lastChild.onclick=()=>{ask.remove();root.remove();};document.body.append(ask);};
   document.body.append(root);
  });
  const payload={jobId:'job',token:'token',actor:{url:'https://www.facebook.com/profile.php?id='+UID,name:'Thu Trà Clone'},text:'Caption bí mật của bài 123456789',expectedMedia:['image','image']};
  const shot=await p.evaluate(({fn,payload})=>(0,eval)('('+fn+')')('snapshot',payload),{fn:facebookBot.toString(),payload});
  assert.equal(shot.ok,true,JSON.stringify(shot));
  const json=JSON.stringify(shot.snapshot);
  assert.ok(!/bí mật|Thu Trà|123456789/.test(json),'lộ dữ liệu: '+json.slice(0,400));
  assert.ok(shot.snapshot.buttons.some(b=>/đã thêm 2/.test(b)));assert.equal(shot.snapshot.media.total,2);
  const out=await p.evaluate(({fn,payload})=>(0,eval)('('+fn+')')('discard',payload),{fn:facebookBot.toString(),payload});
  assert.equal(out.ok,true,JSON.stringify(out));assert.equal(await p.evaluate(()=>document.querySelectorAll('[role=dialog]').length),0);
  assert.equal(await p.evaluate(()=>window.clicks),0);
  await ctx.close();results.push('chạy thử: chụp cấu trúc không lộ caption/tên/số, bỏ bản nháp qua hộp "Bỏ", không bấm Đăng');
 }
 {// Liên kết tự động: trang dùng tên rút gọn, không có h1, tiêu đề tab "Facebook" -> lấy UID từ phiên, tên từ ảnh đại diện.
  const ctx=await browser.newContext();await ctx.addCookies([{name:'c_user',value:'100099887766',domain:'.facebook.com',path:'/',secure:true}]);
  const p=await ctx.newPage();
  await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><html lang="vi"><head><title>Facebook</title></head><body><div role="main"><a href="/photo/?fbid=1"><svg aria-label="Hoàng Quang Anh" width="168" height="168"><image href="https://scontent.xx.fbcdn.net/a.jpg" width="168" height="168"/></svg></a><div role="button"><span style="font-size:32px">Hoàng Quang Anh</span></div></div></body></html>'}));
  await p.goto('https://www.facebook.com/hoang.quang.anh.591271');
  const r=await p.evaluate(({fn})=>(0,eval)('('+fn+')')('self-uid',{}),{fn:facebookBot.toString()});
  assert.equal(r.ok,true,JSON.stringify(r));assert.equal(r.uid,'100099887766');assert.equal(r.name,'Hoàng Quang Anh');assert.equal(r.handle,'hoang.quang.anh.591271');
  await p.goto('https://www.facebook.com/profile.php?id=555');
  const wrong=await p.evaluate(({fn})=>(0,eval)('('+fn+')')('self-uid',{}),{fn:facebookBot.toString()});
  assert.equal(wrong.ok,false);assert.match(wrong.error,/không phải nick đang đăng nhập/);
  await ctx.close();results.push('liên kết tự động: trang tên rút gọn -> UID từ phiên đăng nhập, tên từ ảnh đại diện; trang UID khác -> từ chối');
 }
 console.log('PASS post-flow-387');for(const x of results)console.log(' ✓',x);
}finally{await browser.close();}
