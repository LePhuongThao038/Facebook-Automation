// 3.8.7-story: vùng ĐĂNG STORY. Chạy THẬT facebookBot (mã extension) trên trang giả lập facebook.com/stories/create,
// cùng mô hình dữ liệu Story. Trang giả lập dựng theo mô tả giao diện tạo tin của Facebook web; CHƯA soi trang thật:
// dùng "Chạy thử" trên nick thật để lấy cấu trúc giao diện và chỉnh lại trang giả lập này nếu khác.
// Chạy: node tests/story-387.mjs
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {facebookBot} from '../facebook-bot.js';
import {storyFromLink,validStory,createStoryJob,storyMediaType,STORY_CREATE_URL} from '../story-model.js';
let require=createRequire(import.meta.url);
try{require.resolve('playwright');}catch{require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');}
const {chromium}=require('playwright');
const results=[];
const UID='100001',actor={url:'https://www.facebook.com/profile.php?id='+UID,name:'Thu Trà',uid:UID};

// ---------- Mô hình dữ liệu ----------
{
 assert.equal(storyMediaType('image/jpeg'),'image');assert.equal(storyMediaType('video/mp4'),'video');assert.equal(storyMediaType('application/pdf'),'');
 const reel=storyFromLink('https://www.facebook.com/reel/1533727751019808/');
 assert.deepEqual(reel.media[0],{type:'video',manifest:{schema:'desk.media/1',kind:'reel',sourceUrl:'https://www.facebook.com/reel/1533727751019808/'}});
 assert.throws(()=>storyFromLink('https://www.facebook.com/23dotatv/posts/pfbid02impr'),/link riêng của video hoặc Reel/);
 assert.equal(storyFromLink('https://cdn.example.com/a.jpg').media[0].type,'image');
 assert.throws(()=>storyFromLink('http://x.com/a.jpg'),/https/);
 assert.throws(()=>validStory({kind:'image',media:[{type:'image',url:'a'},{type:'image',url:'b'}]}),/đúng 1/);
 assert.throws(()=>validStory({kind:'text',text:'  '}),/nội dung/);
 const s={id:'s1',kind:'image',name:'a.jpg',media:[{type:'image',storyFileId:'f1'}]};
 const j=createStoryJob(s,actor,[],{dueAt:Date.parse('2026-11-21T10:00:00Z'),scheduleMode:'manual'});
 assert.equal(j.kind,'story');assert.equal(j.target,STORY_CREATE_URL);assert.equal(j.postId,'s1');assert.deepEqual(j.expectedMedia,['image']);assert.equal(j.post.storyKind,'image');assert.match(j.post.title,/^Story · /);
 assert.throws(()=>createStoryJob(s,{url:'https://www.facebook.com/hoang.quang.anh.591271',name:'A'},[],{}),/chưa có UID/);
 assert.throws(()=>createStoryJob(s,actor,[j],{}),/đang có lượt chạy/);
 assert.doesNotThrow(()=>createStoryJob(s,actor,[{...j,state:'failed'}],{}));
 assert.throws(()=>createStoryJob(s,actor,[{...j,state:'success'}],{}),/đã đăng/);
 results.push('Mô hình: 1 tin = 1 ảnh/video hoặc chữ; link bài viết bị từ chối; cần UID; không tạo lượt trùng hoặc đăng lại tin đã đăng');
}

// ---------- Trang tạo tin giả lập ----------
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const pageHtml=({accept='image/*,video/*',draft=false,failShare=false}={})=>`<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
 [role=button]{display:inline-block;padding:8px 12px;margin:4px;border:1px solid #999;cursor:pointer}.card{width:220px;height:300px}
 textarea{width:300px;height:120px}.preview img{width:300px;height:500px;display:block}</style></head><body>
<div role="banner">Facebook</div><div role="main" id="main"></div><div id="layer"></div>
<script>
const main=document.getElementById('main'),layer=document.getElementById('layer');window.__shared=0;
function chooser(){main.innerHTML='<h1>Tạo tin</h1><div role="button" tabindex="0" class="card" id="photo"><span>Tạo tin dạng ảnh</span><input type="file" accept="${accept}" style="display:none"></div><div role="button" tabindex="0" class="card" id="text"><span>Tạo tin dạng văn bản</span></div>';
 const input=main.querySelector('input');input.onchange=()=>{const f=input.files[0];window.__file={name:f.name,type:f.type,size:f.size};setTimeout(()=>editor('image',URL.createObjectURL(f)),300);};
 document.getElementById('photo').onclick=()=>{window.__photoCardClicked=true;};
 document.getElementById('text').onclick=()=>setTimeout(()=>editor('text'),200);}
function editor(kind,src){main.innerHTML='<div class="left"><h2>Tin của bạn</h2>'+(kind==='text'?'<textarea placeholder="Bắt đầu nhập"></textarea>':'<div role="button" tabindex="0">Thêm văn bản</div>')+'<div><div role="button" tabindex="0" id="discard">Bỏ</div><div role="button" tabindex="0" id="share">Chia sẻ lên tin</div></div></div><div class="preview">'+(src?'<img src="'+src+'">':'<div>Xem trước</div>')+'</div>';
 document.getElementById('discard').onclick=()=>{layer.innerHTML='<div role="dialog"><span>Bỏ tin?</span><div role="button" tabindex="0" id="keep">Tiếp tục chỉnh sửa</div><div role="button" tabindex="0" id="confirm">Bỏ</div></div>';document.getElementById('confirm').onclick=()=>{layer.innerHTML='';chooser();};};
 document.getElementById('share').onclick=()=>{window.__shared++;layer.innerHTML='<div role="status">Đang chia sẻ…</div>';setTimeout(()=>{if(${failShare}){layer.innerHTML='<div role="alertdialog">Không thể chia sẻ tin. Đã xảy ra lỗi.</div>';return;}layer.innerHTML='';history.pushState({},'','/');main.innerHTML='<div>Bảng feed</div>';},900);};}
${draft?"editor('image','data:,x');":'chooser();'}
</script></body></html>`;
async function storyPage(opts={},uid=UID){
 const ctx=await browser.newContext({viewport:{width:1280,height:900}});
 await ctx.addCookies([{name:'c_user',value:uid,domain:'.facebook.com',path:'/',secure:true}]);
 const p=await ctx.newPage();
 await p.addInitScript(()=>{window.__sent=[];window.chrome=window.chrome||{};window.chrome.runtime={sendMessage:async m=>{window.__sent.push(m);return m.type==='bot-permit'?{ok:true,data:true}:{ok:true};}};});
 await p.route('**/*',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:pageHtml(opts)}));
 await p.goto(STORY_CREATE_URL);p.__uid=uid;return {p,ctx};
}
const base={jobId:'job-s',token:'tok-s',actor};
// Môi trường test (Chrome + route giả lập) làm rơi cookie sau ~2 giây: đặt lại c_user trước mỗi bước, như phiên đăng nhập thật.
const run=async(p,name,extra={})=>{await p.context().addCookies([{name:'c_user',value:p.__uid,domain:'.facebook.com',path:'/',secure:true}]);return p.evaluate(({fn,name,payload})=>(0,eval)('('+fn+')')(name,payload),{fn:facebookBot.toString(),name,payload:{...base,...extra}});};
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==','base64').toString('base64');
const imageFile={name:'story-1.png',type:'image/png',base64:png,size:Buffer.from(png,'base64').length};
const sent=p=>p.evaluate(()=>window.__sent.map(m=>m.type));

// 1) Tin ảnh: đủ các bước, bấm Chia sẻ đúng 1 lần sau khi có quyền, không bấm thẻ "Tạo tin dạng ảnh".
{
 const {p,ctx}=await storyPage();const ex={storyKind:'image',expectedMedia:['image'],text:''};
 assert.equal((await run(p,'story-open',ex)).ok,true);
 const up=await run(p,'story-upload',{...ex,files:[imageFile]});assert.equal(up.ok,true,up.error);assert.equal(up.count,1);
 assert.deepEqual(await p.evaluate(()=>window.__file),{name:'story-1.png',type:'image/png',size:imageFile.size});
 {const ck=await run(p,'story-check',ex);assert.equal(ck.ok,true,ck.error+' '+JSON.stringify(ck.uiDiagnostic));}
 const c=await run(p,'story-commit',ex);assert.equal(c.ok,true,c.error);assert.equal(c.clicked,true);
 const permit=(await p.evaluate(()=>window.__sent)).find(m=>m.type==='bot-permit');
 assert.deepEqual({count:permit.mediaProof.count,images:permit.mediaProof.images,videos:permit.mediaProof.videos,hasProof:!!permit.mediaProof.proofId,mode:permit.audienceProof.mode},{count:1,images:1,videos:0,hasProof:true,mode:'default'});
 const done=await run(p,'story-published',{...ex,timeoutMs:15000});assert.equal(done.ok,true);assert.equal(done.published,true);
 assert.equal(await p.evaluate(()=>window.__shared),1);assert.equal(await p.evaluate(()=>window.__photoCardClicked||false),false);
 assert.deepEqual(await sent(p),['bot-permit','bot-clicked']);
 const again=await run(p,'story-commit',ex);assert.equal(again.ok,false);
 await ctx.close();results.push('Tin ảnh: mở trang tạo tin → đặt tệp vào ô chọn tệp (không bấm thẻ ảnh) → chờ nút Chia sẻ → xin quyền → bấm 1 lần → Facebook rời trang = đã đăng; không bấm lần hai');
}
// 2) Tin chữ.
{
 const {p,ctx}=await storyPage();const ex={storyKind:'text',expectedMedia:[],text:'Chúc cả nhà cuối tuần vui vẻ 🌸'};
 assert.equal((await run(p,'story-open',ex)).ok,true);
 const t=await run(p,'story-text',ex);assert.equal(t.ok,true,t.error);
 assert.equal(await p.evaluate(()=>document.querySelector('textarea').value),'Chúc cả nhà cuối tuần vui vẻ 🌸');
 assert.equal((await run(p,'story-check',ex)).ok,true);
 assert.equal((await run(p,'story-check',{...ex,text:'Nội dung khác'})).ok,false);
 assert.equal((await run(p,'story-commit',ex)).ok,true);
 assert.equal((await run(p,'story-published',{...ex,timeoutMs:15000})).published,true);
 await ctx.close();results.push('Tin chữ: mở "Tạo tin dạng văn bản", điền đúng chữ (kể cả emoji), chữ bị đổi thì không cho đăng');
}
// 3) Sai nick: dừng trước mọi thao tác.
{
 const {p,ctx}=await storyPage({},'999');
 const r=await run(p,'story-open',{storyKind:'image',expectedMedia:['image']});assert.equal(r.ok,false);assert.match(r.error,/Sai tài khoản đăng/);
 await ctx.close();results.push('Sai nick (UID phiên đăng nhập khác UID đã liên kết): dừng ngay khi mở trang tạo tin');
}
// 4) Trang chỉ nhận ảnh: tin video dừng với lý do rõ, không bấm gì.
{
 const {p,ctx}=await storyPage({accept:'image/*'});const ex={storyKind:'video',expectedMedia:['video']};
 assert.equal((await run(p,'story-open',ex)).ok,true);
 const r=await run(p,'story-upload',{...ex,files:[{name:'story-1.mp4',type:'video/mp4',base64:png,size:68}]});
 assert.equal(r.ok,false);assert.match(r.error,/không nhận video/);assert.equal(await p.evaluate(()=>window.__shared),0);
 await ctx.close();results.push('Facebook không cho tải video lên tin trên máy này: báo rõ, chưa đăng');
}
// 5) Chạy thử: chụp cấu trúc, bỏ bản nháp qua hộp xác nhận, KHÔNG bấm Chia sẻ.
{
 const {p,ctx}=await storyPage();const ex={storyKind:'image',expectedMedia:['image']};
 await run(p,'story-open',ex);await run(p,'story-upload',{...ex,files:[imageFile]});
 const shot=await run(p,'story-snapshot',ex);assert.equal(shot.ok,true);assert.equal(shot.snapshot.kind,'story');assert.ok(shot.snapshot.outline.some(n=>n.label==='Chia sẻ lên tin'));
 const d=await run(p,'story-discard',ex);assert.equal(d.ok,true,d.error);
 assert.equal(await p.evaluate(()=>window.__shared),0);assert.ok(await p.evaluate(()=>!!document.querySelector('input[type=file]')));
 assert.deepEqual(await sent(p),[]);
 await ctx.close();results.push('Chạy thử: lưu cấu trúc trang tạo tin, bỏ bản nháp (xác nhận "Bỏ"), không xin quyền, không bấm Chia sẻ');
}
// 6) Facebook báo lỗi sau khi bấm: không coi là đã đăng.
{
 const {p,ctx}=await storyPage({failShare:true});const ex={storyKind:'image',expectedMedia:['image']};
 await run(p,'story-open',ex);await run(p,'story-upload',{...ex,files:[imageFile]});await run(p,'story-commit',ex);
 const r=await run(p,'story-published',{...ex,timeoutMs:15000});assert.equal(r.ok,false);assert.match(r.error,/Facebook báo lỗi sau khi bấm Chia sẻ/);
 await ctx.close();results.push('Facebook báo lỗi sau khi bấm Chia sẻ: báo lỗi, không ghi "Đã đăng", không bấm lại');
}
// 7) Trang đang có bản nháp tin khác: không ghi đè.
{
 const {p,ctx}=await storyPage({draft:true});
 const r=await run(p,'story-open',{storyKind:'image',expectedMedia:['image']});assert.equal(r.ok,false);assert.match(r.error,/bản nháp khác/);
 await ctx.close();results.push('Trang tạo tin đang có bản nháp khác: dừng, không ghi đè');
}
// 8) Thiếu bằng chứng tải tệp của đúng lượt: không xin quyền bấm.
{
 const {p,ctx}=await storyPage();const ex={storyKind:'image',expectedMedia:['image']};
 await run(p,'story-open',ex);await run(p,'story-upload',{...ex,files:[imageFile]});
 for(const other of [{token:'tok-other'},{jobId:'job-other'}]){const r=await run(p,'story-commit',{...ex,...other});assert.equal(r.ok,false);assert.match(r.error,/Phiên bot không khớp/);}
 assert.equal(await p.evaluate(()=>window.__shared),0);assert.deepEqual(await sent(p),[]);
 await ctx.close();results.push('Lượt khác/phiên khác không dùng được trang tạo tin của lượt này');
}
await browser.close();
console.log('PASS story-387');for(const x of results)console.log(' ✓',x);
