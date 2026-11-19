import {openWorkTab,closeWorkTab} from './work-tabs.js';
import {canonicalPost} from './automation-model.js';
import {fbUrl} from './scenario.js';
import {waitFacebookTab} from './tab-ready.js';

// This function is serialized into a tab. It only expands text and opens a timestamp.
export function inspectPost(request) {
 const clean = value => String(value || '').normalize('NFKC').replace(/[\s\u200b-\u200f\u034f\ufe0e\ufe0f]/gu,'').toLowerCase();
 const person = href => {
  const url = new URL(href,location.href);
  const numeric=url.pathname.match(/^\/(?:people\/[^/]+\/)?(\d+)\/?$/);
  if(numeric)return url.origin+'/id/'+numeric[1];
  return url.origin + (url.pathname === '/profile.php' ? '/id/' + url.searchParams.get('id') : url.pathname.replace(/\/$/,'').toLowerCase());
 };
 const visible = el => el.getClientRects().length > 0;
 const wanted = clean(request.text);
 if (wanted.length<12) return {};
 // Facebook may hide the original card under a dialog after resolving its timestamp.
 const saved=globalThis.__deskCheckedTimestamp;
 const opened=saved?.actor===request.actor.url && saved?.text===wanted && saved?.name===request.actor.name && saved.node;
 if(opened && /\/posts\/|story_fbid=|\/videos\/|\/reel\//.test(opened.href))return {url:opened.href};
 const menus = [...document.querySelectorAll('[aria-label]')].filter(el => visible(el) && /^(actions for this post|hành động.*bài viết|tùy chọn.*bài viết)/i.test(el.getAttribute('aria-label')));
 const hits = [];
 for (const menu of menus) {
  for (let root=menu.parentElement; root && root!==document.body; root=root.parentElement) {
   if (menus.some(other => other!==menu && root.contains(other))) break;
   const headings = [...root.querySelectorAll('h2 a[href],h3 a[href],h4 a[href],[role="heading"] a[href]')];
   const author = headings.find(a => person(a.href)===person(request.actor.url) && clean(a.innerText)===clean(request.actor.name));
   if(wanted.length<8 && ![...root.querySelectorAll('[data-ad-preview="message"],[data-ad-comet-preview="message"],[data-ad-rendering-role="story_message"],p')].some(el=>clean(el.innerText)===wanted))continue;
   if (!author || !clean(root.innerText).includes(wanted.slice(0,Math.min(55,wanted.length)))) continue;
   const more = [...root.querySelectorAll('button,[role="button"]')].find(el => /^(see more|xem thêm)$/i.test(el.innerText.trim()));
   if (more && !more.dataset.deskExpanded && !clean(root.innerText).includes(wanted)){more.dataset.deskExpanded='1';more.click();return {expanding:true};}
   const clone=root.cloneNode(true);
   for(const img of clone.querySelectorAll('img[alt]')) img.replaceWith(document.createTextNode(img.alt));
   if (![root.innerText,clone.textContent].some(value=>clean(value).includes(wanted))) continue;
   const heading=author.closest('h2,h3,h4,[role="heading"]');
   const stamps=[...root.querySelectorAll('a[href]')].filter(a => visible(a) && (heading.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING) && ((a.compareDocumentPosition(menu)&Node.DOCUMENT_POSITION_FOLLOWING)||/ago|vừa xong|phút|giờ|just now/i.test(a.innerText+' '+(a.getAttribute('aria-label')||''))) && !a.closest('p,[data-ad-preview=message]') && (a.hash.startsWith('#?') || /\/posts\/|story_fbid=|\/videos\/|\/reel\//.test(a.href)));
   hits.push({stamp:stamps.length===1?stamps[0]:null,root});
   break;
  }
 }
 if (!hits.length && request.scroll) window.scrollBy(0, Math.max(500,innerHeight*0.85));
 if (hits.length!==1) return {ambiguous:hits.length>1};
 const {stamp,root}=hits[0];
 const direct= /\/posts\/|story_fbid=|\/videos\/|\/reel\//.test(location.href);
 if(direct && (root.closest('[role="dialog"]') || menus.length===1))return {url:location.href};
 if(!stamp)return {};
 if(!stamp.hash.startsWith('#?') && /\/posts\/|story_fbid=|\/videos\/|\/reel\//.test(stamp.href))return {url:stamp.href};
 if(request.open && !stamp.dataset.deskOpened){
  stamp.dataset.deskOpened='1';
  globalThis.__deskCheckedTimestamp={actor:request.actor.url,name:request.actor.name,text:wanted,node:stamp};
  stamp.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
  stamp.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
  stamp.dispatchEvent(new MouseEvent('mousedown',{bubbles:true}));
  if(globalThis.__deskTabGesture)globalThis.__deskTabGesture.actionAt=Date.now();
  stamp.target='_self';
  stamp.click();
  if(/\/posts\/|story_fbid=|\/videos\/|\/reel\//.test(stamp.href))return {url:stamp.href};
 }
 return {};
}

export async function findPublished(job, existingTabId) {
 if(String(job.post.text||'').normalize('NFKC').replace(/[\s\u200b-\u200f\u034f\ufe0e\ufe0f]/gu,'').length<12)throw Error('Chưa nhận được link Xem bài viết. Nội dung ngắn hoặc chỉ có media; không tự đăng lại.');
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const url=fbUrl(job.actor.url);
 const tab=Number.isInteger(existingTabId)
  ? await chrome.tabs.update(existingTabId,{url})
  : await openWorkTab({url,active:false},'lookup:'+job.id,true);
 try {
  await waitFacebookTab(tab.id,id=>chrome.tabs.get(id),pause);
  for(let attempt=0;attempt<Math.min(42,18+4*(job.lookupAttempts||0));attempt++){
   let result;
   try {
    [ {result} ]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:inspectPost,args:[{actor:job.actor,text:job.post.text,open:true,scroll:attempt>=3 && attempt%2===1}]});
   } catch { /* Clicking the timestamp can replace the document. */ }
   if(result?.ambiguous)throw Error('Có nhiều bài trùng nội dung trên trang cá nhân.');
   const url=result?.url && canonicalPost(result.url);
   if(url && !(job.prior||[]).includes(url))return {url,textMatch:true,authorMatch:true};
   await pause(650);
  }
  throw Error('Chưa tìm được link khớp tác giả và nội dung trên trang cá nhân.');
 } finally {if(!Number.isInteger(existingTabId))await closeWorkTab(tab.id);}
}


