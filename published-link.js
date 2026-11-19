import {openWorkTab,closeWorkTab} from './work-tabs.js';
import {canonicalPost} from './automation-model.js';
import {fbUrl} from './scenario.js';
import {waitFacebookTab} from './tab-ready.js';

// This function is serialized into a tab. It only expands text, hovers and opens a timestamp.
// 3.8.6b: Facebook để href="#" trên mốc thời gian cho tới khi rê chuột/focus vào đó, và link tác giả
// có thể là profile.php, /people/... hoặc tên rút gọn. Bản cũ chỉ nhận "#?..." hoặc link bài sẵn có,
// và đòi đúng cả link lẫn tên tác giả, nên bài đã lên vẫn bị ghi "cần đối soát".
export function inspectPost(request) {
 // 3.8.7: bỏ cả emoji khi so khớp. Facebook hiển thị emoji bằng <img alt>, innerText không có emoji,
 // nên caption có emoji (gần như mọi bài) luôn báo "khớp chữ=0" và kẹt ở Cần đối soát.
 const clean = value => String(value || '').normalize('NFKC').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\p{Default_Ignorable_Code_Point}\s]/gu,'').toLowerCase();
 const person = href => {
  try{
   const url = new URL(href,location.href);
   const numeric=url.pathname.match(/^\/(?:people\/[^/]+\/)?(\d+)\/?$/);
   if(numeric)return 'id:'+numeric[1];
   if(url.pathname==='/profile.php')return 'id:'+url.searchParams.get('id');
   return url.pathname.replace(/\/$/,'').toLowerCase();
  }catch{return '';}
 };
 const postLink = href => /\/posts\/|story_fbid=|\/videos\/|\/reel\//.test(href||'');
 const visible = el => el.getClientRects().length > 0;
 const wanted = clean(request.text);
 if (wanted.length<2) return {};
 // Caption ngắn: chỉ nhận khi đoạn chữ của bài trùng KHỚP HOÀN TOÀN, tránh nhận nhầm bài khác.
 const short = wanted.length<12;
 const head = wanted.slice(0,Math.min(55,wanted.length));
 const actorKey=person(request.actor.url), actorName=clean(request.actor.name);
 const saved=globalThis.__deskCheckedTimestamp;
 const opened=saved?.actor===request.actor.url && saved?.text===wanted && saved.node;
 if(opened && postLink(opened.href) && !opened.href.endsWith('#'))return {url:opened.href};
 const menus = [...document.querySelectorAll('[aria-label]')].filter(el => visible(el) && /^(actions for this post|hành động.*bài viết|tùy chọn.*bài viết)/i.test(el.getAttribute('aria-label')));
 const hits = [];const diag={menus:menus.length,textRoots:0,author:0,stamps:0,hrefs:[]};
 for (const menu of menus) {
  for (let root=menu.parentElement; root && root!==document.body; root=root.parentElement) {
   if (menus.some(other => other!==menu && root.contains(other))) break;
   if (!clean(root.innerText).includes(head)) continue;
   diag.textRoots++;
   const message=el=>el.closest('p,[data-ad-preview="message"],[data-ad-comet-preview="message"],[data-ad-rendering-role="story_message"]');
   const links=[...root.querySelectorAll('a[href]')];
   const headingLinks=[...root.querySelectorAll('h2 a[href],h3 a[href],h4 a[href],[role="heading"] a[href],strong a[href]')];
   const author = headingLinks.find(a => person(a.href)===actorKey) || headingLinks.find(a => clean(a.innerText)===actorName) || links.find(a=>clean(a.innerText)===actorName&&!message(a));
   if (!author) break;
   if (short && ![...root.querySelectorAll('[data-ad-preview="message"],[data-ad-comet-preview="message"],[data-ad-rendering-role="story_message"]')].some(el=>clean(el.innerText)===wanted)) break;
   diag.author++;
   const more = [...root.querySelectorAll('button,[role="button"]')].find(el => /^(see more|xem thêm)$/i.test(el.innerText.trim()));
   if (more && !more.dataset.deskExpanded && !clean(root.innerText).includes(wanted)){more.dataset.deskExpanded='1';more.click();return {expanding:true,diag};}
   const clone=root.cloneNode(true);
   for(const img of clone.querySelectorAll('img[alt]')) img.replaceWith(document.createTextNode(img.alt));
   if (![root.innerText,clone.textContent].some(value=>clean(value).includes(wanted.slice(0,Math.min(300,wanted.length))))) break;
   const timeish=a=>/ago|vừa xong|phút|giờ|ngày|just now|tháng|lúc|^\s*\d+\s*(?:m|h|d|w|min|hrs?)\s*$/i.test((a.innerText||'')+' '+(a.getAttribute('aria-label')||''))||Boolean(a.querySelector('time,abbr'));
   const stamps=links.filter(a => a!==author && visible(a) && !message(a) && (author.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING) && ((a.compareDocumentPosition(menu)&Node.DOCUMENT_POSITION_FOLLOWING) || timeish(a)) && (postLink(a.href) || a.getAttribute('href')==='#' || a.hash.startsWith('#?') || timeish(a)) && (/^#/.test(a.getAttribute('href')||'') || person(a.href)!==actorKey));
   diag.stamps=stamps.length;diag.hrefs=stamps.slice(0,3).map(a=>(a.getAttribute('href')||'').slice(0,80));
   const ready=stamps.find(a=>postLink(a.href)&&!a.href.endsWith('#'));
   hits.push({stamp:ready||stamps[0]||null,ready:Boolean(ready),root,stamps});
   break;
  }
 }
 if (!hits.length && request.scroll) window.scrollBy(0, Math.max(500,innerHeight*0.85));
 if (hits.length>1) return {ambiguous:true,diag};
 if (!hits.length) return {diag};
 const {stamp,ready,root,stamps}=hits[0];
 if(postLink(location.href) && (root.closest('[role="dialog"]') || menus.length===1))return {url:location.href,diag};
 if(ready)return {url:stamp.href,diag};
 // Rê chuột/focus để Facebook gắn link thật vào mốc thời gian; lượt đọc sau sẽ lấy được.
 for(const a of stamps){
  for(const type of ['pointerover','pointerenter','mouseover','mouseenter','mousemove'])a.dispatchEvent(new (type.startsWith('pointer')?PointerEvent:MouseEvent)(type,{bubbles:true,pointerType:'mouse'}));
  a.dispatchEvent(new FocusEvent('focusin',{bubbles:true}));try{a.focus({preventScroll:true});}catch{}
 }
 // Rê nhiều lần vẫn chưa có link thì mở mốc thời gian (Facebook chuyển sang trang bài).
 if(request.open && stamp && !stamp.dataset.deskOpened && Number(stamp.dataset.deskHover||0)>=3){
  stamp.dataset.deskOpened='1';
  globalThis.__deskCheckedTimestamp={actor:request.actor.url,name:request.actor.name,text:wanted,node:stamp};
  if(globalThis.__deskTabGesture)globalThis.__deskTabGesture.actionAt=Date.now();
  stamp.target='_self';
  stamp.click();
 }
 if(stamp)stamp.dataset.deskHover=String(Number(stamp.dataset.deskHover||0)+1);
 return {pending:true,diag};
}

export async function findPublished(job, existingTabId) {
 if(String(job.post.text||'').normalize('NFKC').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\p{Default_Ignorable_Code_Point}\s]/gu,'').toLowerCase().length<2)throw Error('Chưa nhận được link Xem bài viết. Bài chỉ có media; không tự đăng lại.');
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const url=fbUrl(job.actor.url);
 const tab=Number.isInteger(existingTabId)
  ? await chrome.tabs.update(existingTabId,{url,active:true})
  : await openWorkTab({url,active:true},'lookup:'+job.id,true);
 let last={};
 try {
  await waitFacebookTab(tab.id,id=>chrome.tabs.get(id),pause);
  for(let attempt=0;attempt<Math.min(50,24+4*(job.lookupAttempts||0));attempt++){
   let result;
   try {
    [ {result} ]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:inspectPost,args:[{actor:job.actor,text:job.post.text,open:true,scroll:attempt>=4 && attempt%3===1}]});
   } catch { /* Clicking the timestamp can replace the document. */ }
   if(result?.diag)last=result.diag;
   if(result?.ambiguous)throw Error('Có nhiều bài trùng nội dung trên trang cá nhân.');
   const url=result?.url && canonicalPost(result.url);
   if(url && !(job.prior||[]).includes(url))return {url,textMatch:true,authorMatch:true};
   await pause(700);
  }
  throw Error('Chưa tìm được link khớp tác giả và nội dung trên trang cá nhân. [menu='+(last.menus??'?')+'; khớp chữ='+(last.textRoots??'?')+'; tác giả='+(last.author??'?')+'; mốc giờ='+(last.stamps??'?')+'; href='+(last.hrefs||[]).join(' , ')+']');
 } finally {if(!Number.isInteger(existingTabId))await closeWorkTab(tab.id);}
}
