// 3.8.6: mô phỏng hộp soạn Facebook cho luồng đăng mới. Không kết nối Facebook thật.
// Chạy: node tests/post-flow-386.mjs (cần Chrome và Playwright của runtime Codex).
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {facebookBot} from '../facebook-bot.js';
const require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
const UID='100001';
async function page(options={}){
 const context=await browser.newContext({viewport:{width:options.width||1366,height:options.height||651}});
 await context.addCookies([{name:'c_user',value:options.cookieUid??UID,domain:'.facebook.com',path:'/',secure:true}]);
 const p=await context.newPage();
 await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"><body><main></main></body></html>'}));
 await p.goto('https://www.facebook.com/profile.php?id='+UID);
 await p.evaluate(options=>{
  window.clicks=0;window.permits=0;
  const pic=(color)=>{const c=document.createElement('canvas');c.width=c.height=120;const g=c.getContext('2d');g.fillStyle=color;g.fillRect(0,0,120,120);return c.toDataURL();};
  window.pic=pic;
  // Trang nền: nút mở ô soạn, chat Messenger (role=dialog) góc phải dưới.
  const opener=document.createElement('div');opener.setAttribute('role','button');opener.textContent='Bạn đang nghĩ gì?';document.querySelector('main').append(opener);
  if(options.chat){const chat=document.createElement('div');chat.setAttribute('role','dialog');chat.setAttribute('aria-label','Chat với Bạn A');chat.style.cssText='position:fixed;right:10px;bottom:0;width:330px;height:420px;background:#eee;z-index:1';chat.innerHTML='<p>Tin nhắn</p><div role="button">Gửi</div>';document.body.append(chat);}
  opener.onclick=()=>{
   if(options.backdrop){const back=document.createElement('div');back.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:5';document.body.append(back);}
   const root=document.createElement('div');root.id='compose';root.setAttribute('role','dialog');root.setAttribute('aria-label','Tạo bài viết');
   root.style.cssText='position:fixed;left:50%;top:40px;transform:translateX(-50%);width:500px;max-height:560px;overflow:auto;background:#fff;z-index:10;opacity:'+(options.stuckOpacity?'0':'1');
   root.innerHTML='<h2>Tạo bài viết</h2><div contenteditable="true" role="textbox" data-lexical-editor="true" style="min-height:80px"></div><div id="media" style="display:flex;flex-wrap:wrap"></div><div role="button" aria-label="Ảnh/video">Ảnh/video</div><div id="footer" style="height:'+(options.tallGap||0)+'px"></div>';
   const post=document.createElement('div');post.setAttribute('role','button');post.setAttribute('aria-label','Đăng');post.innerHTML='<span>Đăng</span>';post.onclick=()=>window.clicks++;root.append(post);
   const input=document.createElement('input');input.type='file';input.multiple=true;input.accept='image/*,image/heif,video/*';input.style.display='none';root.append(input);
   const addPreviews=files=>{
    const media=root.querySelector('#media');const shown=options.albumShown||files.length;
    files.slice(0,shown).forEach((f,i)=>{const card=document.createElement('div');card.style.cssText='width:110px;height:110px;position:relative';const img=document.createElement('img');img.src=pic('#'+(3+i)+'8'+(6+i));img.style.cssText='width:110px;height:110px';card.append(img);media.append(card);
     if(options.cdnSwap)setTimeout(()=>{img.src=pic('#9'+i+'3');},700);});
    if(files.length>shown){const more=document.createElement('span');more.textContent='+'+(files.length-shown+1);media.lastChild.append(more);}
    const remove=document.createElement('div');remove.setAttribute('role','button');remove.setAttribute('aria-label','Xóa ảnh');media.append(remove);
   };
   if(!options.ignoreChange)input.addEventListener('change',()=>addPreviews([...input.files]));
   root.addEventListener('drop',e=>{e.preventDefault();addPreviews([...e.dataTransfer.files]);});
   document.body.append(root);
   if(options.coverButton){setTimeout(()=>{const cover=document.createElement('div');cover.setAttribute('role','dialog');cover.setAttribute('aria-label','Bỏ bài viết?');const r=post.getBoundingClientRect();cover.style.cssText=`position:fixed;left:${r.left-20}px;top:${r.top-20}px;width:${r.width+40}px;height:${r.height+40}px;background:#fff;z-index:20`;document.body.append(cover);},0);}
  };
  window.chrome={runtime:{async sendMessage(m){if(m.type==='bot-permit'){window.permits++;return {ok:true,data:true};}return {ok:true};}}};
 },options);
 return {p,context};
}
const base={jobId:'job',token:'token',actor:{url:'https://www.facebook.com/profile.php?id='+UID,name:'Test Author'},text:'Caption thử nghiệm đủ dài 😊',audience:'default',applied:[]};
const run=(p,name,extra={})=>p.evaluate(({fn,name,payload})=>{
 if(payload.files)payload.files=payload.files.map((f,i)=>{const c=document.createElement('canvas');c.width=c.height=64;const b64=c.toDataURL('image/png').split(',')[1];return {name:'media-'+(i+1)+'.png',type:'image/png',base64:b64};});
 return (0,eval)('('+fn+')')(name,payload);
},{fn:facebookBot.toString(),name,payload:{...base,...extra}});
async function flow(options,n){
 const {p,context}=await page(options);
 const expectedMedia=Array(n).fill('image');
 const opened=await run(p,'open',{expectedMedia});assert.equal(opened.ok,true,'open '+JSON.stringify(opened));
 const text=await run(p,'text',{expectedMedia});assert.equal(text.ok,true,'text '+JSON.stringify(text));
 let up={ok:true};if(n)up=await run(p,'upload',{expectedMedia,files:Array(n).fill(0)});
 const check=up.ok?await run(p,'check',{expectedMedia}):null;
 const commit=check?.ok?await run(p,'commit',{expectedMedia}):null;
 const out={opened,up,check,commit,clicks:await p.evaluate(()=>window.clicks)};await context.close();return out;
}
try{
 let r=await flow({chat:true,backdrop:true},0);assert.equal(r.check.ok,true,JSON.stringify(r.check));assert.equal(r.clicks,1);results.push('caption + chat Messenger dưới lớp phủ: không báo nhầm hộp thoại che');
 r=await flow({chat:true,backdrop:true,cdnSwap:true},1);assert.equal(r.up.ok,true,JSON.stringify(r.up));assert.equal(r.check.ok,true,JSON.stringify(r.check));assert.equal(r.clicks,1);results.push('1 ảnh, Facebook đổi URL ảnh xem trước sau khi tải: vẫn đăng');
 r=await flow({cdnSwap:true},4);assert.equal(r.check.ok,true,JSON.stringify(r));assert.equal(r.clicks,1);results.push('4 ảnh: đăng');
 r=await flow({albumShown:4},6);assert.equal(r.up.ok,true,JSON.stringify(r.up));assert.equal(r.clicks,1);results.push('album 6 ảnh hiện 4 ô, ô cuối "+3": đăng');
 r=await flow({albumShown:5},10);assert.equal(r.up.ok,true,JSON.stringify(r.up));assert.equal(r.clicks,1);results.push('album 10 ảnh hiện 5 ô, ô cuối "+6" (đúng log thật): đăng');
 r=await flow({ignoreChange:true},2);assert.equal(r.up.ok,true,JSON.stringify(r.up));assert.equal(r.clicks,1);results.push('ô tải không nhận change: tự chuyển sang kéo-thả, đăng');
 r=await flow({tallGap:900,height:623,width:1034},1);assert.equal(r.check.ok,true,JSON.stringify(r.check));assert.equal(r.clicks,1);results.push('màn hình 1034×623, nút Đăng nằm dưới khung nhìn: tự cuộn, đăng');
 r=await flow({stuckOpacity:true},0);assert.equal(r.opened.ok,true);assert.equal(r.clicks,1);results.push('hộp soạn kẹt opacity 0 (tab nền): vẫn nhận diện');
 r=await flow({coverButton:true},0);assert.equal(r.check.ok,false);assert.equal(r.clicks,0);assert.match(r.check.error,/che/);results.push('hộp thoại thật che nút Đăng: dừng, không bấm ('+r.check.uiDiagnostic.cover+')');
 {const {p,context}=await page({cookieUid:'999'});const o=await run(p,'open',{expectedMedia:[]});assert.equal(o.ok,false);assert.match(o.error,/Sai tài khoản/);await context.close();results.push('đăng nhập nick khác (c_user khác UID): dừng ngay ở bước mở');}
 {const {p,context}=await page({});await run(p,'open',{expectedMedia:['image']});await run(p,'text',{expectedMedia:['image']});const c=await run(p,'commit',{expectedMedia:['image']});assert.equal(c.ok,false);assert.equal(await p.evaluate(()=>window.clicks),0);await context.close();results.push('thiếu bằng chứng media: không đăng riêng caption');}
 console.log('PASS post-flow-386');for(const x of results)console.log(' ✓',x);
}finally{await browser.close();}
