// 3.8.6b: tìm permalink trên timeline mô phỏng. Không kết nối Facebook thật.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {inspectPost} from '../published-link.js';
const require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');
const {chromium}=require('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const UID='100001',NAME='Test Author',TEXT='Có người tột đỉnh vinh hoa, có người chỉ cần bình yên 😊';
const actor={url:'https://www.facebook.com/profile.php?id='+UID,name:NAME};
const results=[];
async function timeline(o={}){
 const ctx=await browser.newContext();const p=await ctx.newPage();
 await p.route('**/*',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div role="main"></div></body></html>'}));
 await p.goto('https://www.facebook.com/profile.php?id='+UID);
 await p.evaluate(({o,UID,NAME,TEXT})=>{
  const feed=document.querySelector('[role=main]');
  const post=(text,id,authorHref)=>{
   const card=document.createElement('div');
   card.innerHTML=`<div><h2><strong><a href="${authorHref}">${NAME}</a></strong></h2>
    <span><a class="ts" href="#" aria-label="5 phút">5 phút</a></span>
    <div aria-label="Hành động với bài viết này" role="button">…</div></div>
    <div data-ad-rendering-role="story_message"><div dir="auto">${text}</div></div>
    <a href="https://www.facebook.com/photo/?fbid=999"><img alt="ảnh" src="data:,"></a>`;
   const ts=card.querySelector('.ts');
   const materialize=()=>{ts.href=`https://www.facebook.com/permalink.php?story_fbid=pfbid0${id}&id=${UID}&__cft__[0]=x`;};
   if(o.hover!==false)ts.addEventListener('mouseover',materialize);
   if(o.ready)materialize();
   feed.append(card);
  };
  const authorHref=o.vanity?'https://www.facebook.com/test.author?__cft__[0]=a':`https://www.facebook.com/profile.php?id=${UID}&__cft__[0]=abc&__tn__=-UC%2CP-R`;
  post('Bài cũ hôm qua không liên quan gì cả','old',authorHref);
  post(TEXT,'new',authorHref);
 },{o,UID,NAME,TEXT});
 return {p,ctx};
}
const look=async(p,extra={})=>{let r;for(let i=0;i<8;i++){r=await p.evaluate(({fn,req})=>(0,eval)('('+fn+')')(req),{fn:inspectPost.toString(),req:{actor,text:TEXT,open:false,...extra}});if(r.url)return r;}return r;};
try{
 let {p,ctx}=await timeline({});let r=await look(p);assert.match(r.url||'',/story_fbid=pfbid0new/,JSON.stringify(r));await ctx.close();results.push('mốc giờ href="#" chỉ có link khi rê chuột: tìm được link');
 ({p,ctx}=await timeline({ready:true}));r=await look(p);assert.match(r.url,/pfbid0new/);await ctx.close();results.push('mốc giờ có sẵn link: tìm được');
 ({p,ctx}=await timeline({vanity:true}));r=await look(p);assert.match(r.url||'',/pfbid0new/,JSON.stringify(r));await ctx.close();results.push('link tác giả dạng tên rút gọn, khớp theo tên: tìm được');
 ({p,ctx}=await timeline({hover:false}));r=await look(p);assert.equal(r.url,undefined);assert.equal(r.diag.stamps,1);await ctx.close();results.push('không bao giờ có link: không đoán bừa, có chẩn đoán');
 ({p,ctx}=await timeline({}));r=await p.evaluate(({fn,req})=>(0,eval)('('+fn+')')(req),{fn:inspectPost.toString(),req:{actor:{...actor,url:'https://www.facebook.com/profile.php?id=555',name:'Người Khác'},text:TEXT,open:false}});assert.equal(r.url,undefined);await ctx.close();results.push('bài của nick khác: không nhận');
 console.log('PASS link-lookup-386');for(const x of results)console.log(' ✓',x);
}finally{await browser.close();}
