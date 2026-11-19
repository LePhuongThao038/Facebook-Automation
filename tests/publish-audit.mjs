import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {facebookBot} from '../facebook-bot.js';
const require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
mkdirSync('work',{recursive:true});
async function fixture(page,options={}){
 await page.goto('https://www.facebook.com/profile.php?id=100001');
 await page.setContent('<main><div aria-label="Post preview"><span>Test Author</span></div></main>');
 await page.evaluate(options=>{
  window.options=options;window.clicks=0;window.nexts=0;window.permits=0;window.aborts=0;
  const original=Date.now.bind(Date);let tick=0;Date.now=()=>original()+(tick+=1000);const timeout=window.setTimeout.bind(window);window.setTimeout=(fn,delay,...rest)=>timeout(fn,Math.min(delay,10),...rest);
  document.documentElement.lang=options.lang||'vi';document.documentElement.dataset.facebookDeskJob='job';document.documentElement.dataset.facebookDeskToken='token';
  const root=document.createElement('div');root.id='compose';root.setAttribute('role','dialog');root.innerHTML='<h2>Tạo bài viết</h2><div contenteditable="true" role="textbox">Caption đầy đủ 😊</div>';document.body.append(root);
  root.style.cssText='max-width:550px;border:1px solid; padding:12px; margin-top:'+(options.offset||0)+'px';document.body.style.zoom=String(options.zoom||1);
  const makeButton=()=>{
   const button=document.createElement(options.tag||'button');button.id='publish';
   if(options.tag==='input'){button.type='submit';button.value=options.label||'Post';}else button.textContent=options.label||'Đăng';
   if(options.aria)button.setAttribute('aria-label',options.aria);
   if(options.labelledby){const text=document.createElement('span');text.id='post-label';text.textContent=options.labelledby;text.hidden=true;root.append(text);button.setAttribute('aria-labelledby',text.id);button.textContent='';}
   button.disabled=!!options.disabled;
   button.onclick=event=>{event.preventDefault();window.clicks++;};return button;
  };
  if(options.next){const next=document.createElement('button');next.textContent=options.lang==='en'?'Next':'Tiếp theo';next.onclick=()=>{window.nexts++;root.remove();const review=document.createElement('div');review.setAttribute('role','dialog');review.innerHTML='<h2>'+(options.lang==='en'?'Post settings':'Cài đặt bài viết')+'</h2><p>Caption đầy đủ 😊</p>';review.append(makeButton());document.body.append(review);};root.append(next);}
  else {root.append(makeButton());if(options.duplicate)root.append(makeButton());}
  if(options.hiddenDuplicate){const b=makeButton();b.id='hidden-publish';b.setAttribute('aria-hidden','true');root.append(b);}
  if(options.nested){const button=document.getElementById('publish');const wrap=document.createElement('div');wrap.setAttribute('role','button');wrap.setAttribute('aria-label',options.label||'Đăng');button.replaceWith(wrap);wrap.append(button);}
  if(options.parentDisabled)document.getElementById('publish').parentElement.setAttribute('aria-disabled','true');
  if(options.pointerDisabled)document.getElementById('publish').style.pointerEvents='none';
  if(options.overlay){const dialog=document.createElement('div');dialog.id='overlay';dialog.setAttribute('role','dialog');dialog.innerHTML='<h2>Chọn đối tượng</h2><button>Xong</button>';document.body.append(dialog);}
  if(options.extraComposer){const clone=root.cloneNode(true);clone.id='other-compose';document.body.append(clone);}
  if(options.enableLater)timeout(()=>{document.getElementById('publish').disabled=false;},40);
  window.chrome={runtime:{async sendMessage(message){
   if(message.type==='bot-permit'){window.permits++;if(options.replaceAtPermit){const old=document.getElementById('publish');old.replaceWith(makeButton());}if(options.replaceRootAtPermit){const old=document.getElementById('compose'),rebuilt=old.cloneNode(true);old.replaceWith(rebuilt);rebuilt.querySelector('#publish').replaceWith(makeButton());}if(options.changeTextAtPermit)document.querySelector('[role="textbox"]').textContent='Changed caption';if(options.removeMetaAtPermit)document.getElementById('selected-meta')?.remove();if(options.stopAtPermit)delete document.documentElement.dataset.facebookDeskJob;return {ok:true,data:true};}
   if(message.type==='bot-abort-before-click'){window.aborts++;return {ok:true};}
   return {ok:true};
  }}};
 },options);
}
async function action(page,name,extra={}){return page.evaluate(({fn,name,extra})=>(0,eval)('('+fn+')')(name,{jobId:'job',token:'token',actor:{url:'https://www.facebook.com/profile.php?id=100001',name:'Test Author'},text:'Caption đầy đủ 😊',expectedMedia:[],applied:[],...extra}),{fn:facebookBot.toString(),name,extra});}
try{
 for(const [width,height,dpr]of [[360,800,2],[1366,768,1],[1920,1080,1.25],[1280,800,1.5]]){
  const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:dpr});const page=await context.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<main></main>'}));
  for(const [label,options]of [['Post',{lang:'en'}],['Đăng',{lang:'vi'}],['Đăng bài viết',{aria:'Đăng bài viết'}],['Post now',{tag:'input'}],['Publish',{}],['ignored',{labelledby:'Đăng ngay'}],['Đăng',{lang:'vi'}],['Đăng\u200b',{hiddenDuplicate:true}],['Post',{nested:true}]]){
   await fixture(page,{label,zoom:width===360?.75:1.25,offset:1500,...options});const checked=await action(page,'check');assert.equal(checked.ok,true,JSON.stringify({label,width,checked}));const commit=await action(page,'commit');assert.equal(commit.ok,true,JSON.stringify(commit));assert.equal(await page.evaluate(()=>window.clicks),1);
   const again=await action(page,'commit');assert.equal(again.ok,false);assert.equal(await page.evaluate(()=>window.clicks),1);
   results.push({case:'locale/geometry',label,width,height,dpr,ok:true});
  }
  await context.close();
 }
 const context=await browser.newContext();const page=await context.newPage();await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<main></main>'}));
 for(const [name,options]of [['disabled',{disabled:true}],['disabled ancestor',{parentDisabled:true}],['pointer-events disabled',{pointerDisabled:true}],['duplicate',{duplicate:true}],['overlay',{overlay:true}],['two composers',{extraComposer:true}],['wrong label',{label:'Cancel'}]]){
  await fixture(page,options);const checked=await action(page,'check');assert.equal(checked.ok,false,JSON.stringify({name,checked}));assert.equal(await page.evaluate(()=>window.clicks),0);assert.ok(checked.uiDiagnostic);results.push({case:name,diagnostic:checked.uiDiagnostic.status,ok:true});
 }
 await fixture(page,{disabled:true,enableLater:true});assert.equal((await action(page,'check')).ok,true);results.push({case:'disabled then enabled',ok:true});
 await fixture(page,{replaceAtPermit:true});assert.equal((await action(page,'commit')).ok,true);assert.equal(await page.evaluate(()=>window.clicks),1);results.push({case:'button rerender during permit',ok:true});
 await fixture(page,{replaceRootAtPermit:true});assert.equal((await action(page,'commit')).ok,true);assert.equal(await page.evaluate(()=>window.clicks),1);results.push({case:'composer rerender with identical caption during permit',ok:true});
 await fixture(page,{changeTextAtPermit:true});assert.equal((await action(page,'commit')).ok,false);assert.equal(await page.evaluate(()=>window.clicks),0);results.push({case:'changed caption after permit blocks click',ok:true});
 await fixture(page,{removeMetaAtPermit:true});await page.evaluate(()=>{const meta=document.createElement('span');meta.id='selected-meta';meta.textContent='Hà Nội';document.getElementById('compose').append(meta);});assert.equal((await action(page,'commit',{applied:[{selected:'Hà Nội'}]})).ok,false);assert.equal(await page.evaluate(()=>window.clicks),0);results.push({case:'lost selected location after permit blocks click',ok:true});
 await fixture(page,{stopAtPermit:true});assert.equal((await action(page,'commit')).ok,false);assert.equal(await page.evaluate(()=>window.clicks),0);assert.equal(await page.evaluate(()=>window.aborts),1);results.push({case:'pause at final permit',ok:true});
 await fixture(page,{next:true});assert.equal((await action(page,'check')).ok,true);assert.equal(await page.evaluate(()=>window.nexts),1);assert.equal(await page.evaluate(()=>window.clicks),0);assert.equal((await action(page,'commit')).ok,true);assert.equal(await page.evaluate(()=>window.clicks),1);results.push({case:'Next then final Post',ok:true});
 await fixture(page,{next:true,lang:'en',label:'Post'});assert.equal((await action(page,'check')).ok,true);assert.equal((await action(page,'commit')).ok,true);assert.equal(await page.evaluate(()=>window.clicks),1);results.push({case:'English Next and Post settings',ok:true});
 // Missing media is never excused because a publish button is available.
 await fixture(page);const missing=await action(page,'commit',{expectedMedia:['image']});assert.equal(missing.ok,false);assert.equal(await page.evaluate(()=>window.permits),0);assert.equal(await page.evaluate(()=>window.clicks),0);results.push({case:'missing attachment blocks publish',ok:true});
 // A six-photo album with small thumbnails at 50% zoom still supplies real inventory.
 await fixture(page,{zoom:.5});await page.evaluate(async()=>{
  const album=document.createElement('div');album.style.display='flex';
  for(let i=0;i<6;i++){const img=new Image(64,64);img.src='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="rgb(${i*30},20,50)"/></svg>`);album.append(img);await img.decode();}
  const remove=document.createElement('button');remove.setAttribute('aria-label','Remove photos');remove.textContent='X';album.append(remove);document.getElementById('compose').append(album);
 });
 const files=Array.from({length:6},(_,i)=>({name:'photo'+i+'.png',type:'image/png'}));const media=await action(page,'upload-check',{files,expectedMedia:files.map(()=>'image')});assert.equal(media.ok,true,JSON.stringify(media));assert.equal(media.count,6);
 await page.evaluate(async()=>{const old=document.getElementById('compose'),rebuilt=old.cloneNode(true);old.replaceWith(rebuilt);rebuilt.querySelector('#publish').onclick=()=>window.clicks++;await Promise.all([...rebuilt.querySelectorAll('img')].map(img=>img.decode()));});
 const posted=await action(page,'commit',{expectedMedia:files.map(()=>'image')});assert.equal(posted.ok,true,JSON.stringify(posted));assert.equal(await page.evaluate(()=>window.clicks),1);results.push({case:'six 64px photo previews at 50% zoom with rebuilt composer',ok:true});
 await fixture(page);await page.evaluate(async()=>{const card=document.createElement('div'),img=new Image(64,64);img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="blue"/></svg>');card.append(img);const remove=document.createElement('button');remove.setAttribute('aria-label','Xóa video');remove.textContent='X';card.append(remove);document.getElementById('compose').append(card);await img.decode();});
 const video=await action(page,'upload-check',{files:[{name:'reel.mp4',type:'video/mp4'}],expectedMedia:['video']});assert.equal(video.ok,true,JSON.stringify(video));assert.equal((await action(page,'commit',{expectedMedia:['video']})).ok,true);assert.equal(await page.evaluate(()=>window.clicks),1);results.push({case:'video poster with explicit Remove video control',ok:true});
 await fixture(page);await page.evaluate(async()=>{const card=document.createElement('div'),img=new Image(64,64);img.src='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="green"/></svg>');card.append(img);const remove=document.createElement('button');remove.setAttribute('aria-label','Xóa ảnh');remove.textContent='X';card.append(remove);document.getElementById('compose').append(card);await img.decode();const original=Date.now;let ticks=0;Date.now=()=>original()+(ticks+=100000);});
 const falseVideo=await action(page,'upload-check',{files:[{name:'reel.mp4',type:'video/mp4'}],expectedMedia:['video']});assert.equal(falseVideo.ok,false);assert.match(falseVideo.error,/0 video/);assert.equal(await page.evaluate(()=>window.clicks),0);results.push({case:'ordinary image cannot masquerade as video',ok:true});
 writeFileSync('work/publish-audit-result.json',JSON.stringify({passed:true,chrome:browser.version(),platform:'Headless Chrome on Windows; fresh isolated profiles; no Facebook requests',cases:results},null,2));
 await context.close();console.log(`PASS publish audit: ${results.length} cases; VI/EN labels, four viewport/DPI pairs, offsets/zoom, accessibility labels, duplicate/disabled/overlay, button rerender, stop guard, Next and six-image inventory; no real Facebook posts`);
}finally{await browser.close();}
