// Runs in one owned Facebook tab. All selection is semantic; no pixel click.
export async function facebookAudience(action,p){
 const norm=s=>String(s||'').normalize('NFKC').replace(/[\u200b-\u200f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
 const label=e=>String(e?.getAttribute('aria-label')||e?.getAttribute('title')||e?.innerText||e?.value||'').trim();
 const visible=e=>!!(e?.isConnected&&e.getClientRects().length&&!e.closest('[hidden],[aria-hidden="true"],[inert]')&&getComputedStyle(e).visibility!=='hidden');
 const all=(q,r=document)=>[...r.querySelectorAll(q)].filter(visible);
 const uid=url=>{try{const u=new URL(url,location.href);return u.searchParams.get('id')||u.pathname.match(/^\/people\/[^/]+\/(\d+)/)?.[1]||u.pathname.match(/^\/(\d+)\/?$/)?.[1]||'';}catch{return '';}};
 const canonical=url=>{try{const u=new URL(url,location.href);if(u.protocol!=='https:'||u.hostname!=='www.facebook.com')return '';if(u.searchParams.has('comment_id')||u.searchParams.has('reply_comment_id'))return '';if(u.searchParams.get('story_fbid')&&u.searchParams.get('id'))return u.origin+'/permalink.php?story_fbid='+u.searchParams.get('story_fbid')+'&id='+u.searchParams.get('id');if(/\/(?:posts|videos|reel)\/[\w.-]+/.test(u.pathname))return u.origin+u.pathname.replace(/\/$/,'');if(/^\/(?:photo.php|photo\/?)$/.test(u.pathname)&&u.searchParams.get('fbid'))return u.origin+'/photo.php?fbid='+u.searchParams.get('fbid');return '';}catch{return '';}};
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const cancel=()=>{if(document.documentElement.dataset.facebookDeskAudienceToken!==p.token)throw Error('Đã dừng đổi đối tượng.');const restricted=globalThis.deskRestriction?.();if(restricted)throw Error(restricted);};
 const wait=async(fn)=>{const start=Date.now();while(Date.now()-start<12000){cancel();const value=fn();if(value)return value;await sleep(300);}throw Error('Facebook chưa xác nhận giao diện đối tượng.');};
 const names=e=>[label(e),e.getAttribute('title')||''].map(norm);
 const publicName=value=>/^(?:public|công khai)(?:\s|$)|^(?:shared with|đã chia sẻ với)\s*(?:public|công khai)$/i.test(value);
 const audienceControl=e=>names(e).some(value=>!/tag|gắn thẻ|comment|bình luận/i.test(value)&&(/^(?:public|friends|only me|specific friends|custom|công khai|bạn bè|chỉ mình tôi|bạn bè cụ thể|tùy chỉnh)$/i.test(value)||/^(?:shared with|đã chia sẻ với|edit audience|post audience|audience|chỉnh sửa đối tượng|đối tượng|chỉnh sửa quyền riêng tư)/i.test(value)));
 const ownRoots=()=>all('[role="article"],article').filter(root=>all('h2 a[href],h3 a[href],h4 a[href],[role="heading"] a[href]',root).some(a=>a.closest('[role="article"],article')===root&&uid(a.href)===p.actorUid));
 const root=()=>{
  const wanted=canonical(p.url),found=ownRoots().filter(r=>all('a[href]',r).some(a=>a.closest('[role="article"],article')===r&&!a.closest('[data-ad-preview="message"],[data-ad-comet-preview="message"],[data-ad-rendering-role="story_message"]')&&canonical(a.href)===wanted));const unique=found.filter(r=>!found.some(other=>other!==r&&r.contains(other)));if(unique.length!==1)throw Error('Không xác định duy nhất bài của đúng UID; không đổi đối tượng.');return unique[0];
 };
 const headerControls=r=>{
  const controls=all('button,[role="button"],a[aria-label],a[title]',r).filter(audienceControl).filter(e=>e.closest('[role="article"],article')===r&&!e.closest('[data-ad-preview="message"],[data-ad-comet-preview="message"],[data-ad-rendering-role="story_message"],[contenteditable="true"]'));
  return controls.filter(e=>!controls.some(other=>other!==e&&e.contains(other)));
 };
 const isPublic=r=>{const controls=headerControls(r);if(controls.length===1&&names(controls[0]).some(publicName))return true;
  // Facebook also renders a non-interactive SVG title in the post header.
  return all('svg[title],svg title,img[alt]',r).some(e=>e.closest('[role="article"],article')===r&&!e.closest('[data-ad-preview="message"],[data-ad-comet-preview="message"],[data-ad-rendering-role="story_message"],[contenteditable="true"]')&&publicName(norm(e.getAttribute('title')||e.getAttribute('alt')||e.textContent)));
 };
 try{
  if(!/^\d{5,25}$/.test(p.actorUid)||!p.token)throw Error('Thiếu UID/lượt đổi đối tượng.');
  if(/login|checkpoint/.test(location.pathname)||document.querySelector('input[name="pass"]'))throw Error('Facebook yêu cầu kiểm tra tài khoản.');
  document.documentElement.dataset.facebookDeskAudienceToken=p.token;cancel();
  if(action==='discover'){
   if(uid(location.href)!==p.actorUid)throw Error('Không đứng trên đúng profile cần quét.');
   if(!all('button,[role="button"],a').some(e=>/^(?:edit profile|chỉnh sửa trang cá nhân)$/i.test(label(e))))throw Error('Không xác nhận được quyền chủ profile.');
   const urls=[];for(const r of ownRoots())for(const a of all('a[href]',r)){if(a.closest('[role="article"],article')!==r||a.closest('[data-ad-preview="message"],[data-ad-comet-preview="message"],[data-ad-rendering-role="story_message"]'))continue;const url=canonical(a.href);if(url&&!urls.includes(url))urls.push(url);}
   if(p.scroll)window.scrollBy({top:Math.max(innerHeight*.85,400),behavior:'instant'});
   const atBottom=innerHeight+scrollY>=document.documentElement.scrollHeight-80;
   const terminal=atBottom&&all('[role="status"],[role="heading"],h2,h3,p,span').some(e=>/^(?:no more posts|no posts yet|you.re all caught up|không còn bài viết nào|chưa có bài viết nào)$/i.test((e.innerText||'').trim())&&!e.closest('[role="article"],article'));
   return {ok:true,urls,loadedOnly:true,terminal:!!terminal};
  }
  if(action!=='public'||canonical(location.href)!==canonical(p.url))throw Error('Không đúng link bài cần đổi Công khai.');
  let article=root();if(isPublic(article))return {ok:true,state:'already_public'};
  const controls=headerControls(article);
  if(controls.length===1){controls[0].click();}
  else {
   const menus=all('button,[role="button"]',article).filter(e=>/actions for this post|hành động.*bài viết|tùy chọn.*bài viết/i.test(label(e)));if(menus.length!==1)throw Error('Không xác định nút quyền riêng tư hoặc menu của đúng bài.');menus[0].click();
   const edit=await wait(()=>{const items=all('[role="menuitem"]').filter(e=>/^(?:edit audience|edit privacy|chỉnh sửa đối tượng|chỉnh sửa quyền riêng tư|thay đổi đối tượng)$/i.test(label(e)));return items.length===1&&items[0];});edit.click();
  }
  const dialog=await wait(()=>{const found=all('[role="dialog"],dialog').filter(e=>/post audience|who can see|who should see|đối tượng|ai có thể xem|chọn người xem/i.test(label(e)+' '+e.innerText));const unique=found.filter(e=>!found.some(other=>other!==e&&e.contains(other)));return unique.length===1&&unique[0];});
 const publicOption=e=>{const linked=e.id?document.querySelector('label[for="'+CSS.escape(e.id)+'"]'):null;const name=e.tagName==='INPUT'?(e.getAttribute('aria-label')||linked?.innerText||e.closest('label')?.innerText||e.value):label(e)||linked?.innerText||e.closest('label')?.innerText;return publicName(norm(name));};
  let options=all('[role="radio"],[role="menuitemradio"],[role="option"],input[type="radio"]',dialog).filter(publicOption);if(!options.length)options=all('button,[role="button"]',dialog).filter(publicOption);options=options.filter(e=>!options.some(other=>other!==e&&e.contains(other)));
  if(options.length!==1||options[0].disabled||options[0].getAttribute('aria-disabled')==='true')throw Error('Bài này chưa cho chọn Công khai.');
  const selectPermit=await chrome.runtime.sendMessage({type:'audience-final-permit',jobId:p.jobId,token:p.token});if(!selectPermit?.ok)throw Error(selectPermit?.error||'Đã dừng trước khi đổi đối tượng.');cancel();options[0].click();await sleep(250);cancel();
  if(visible(dialog)){
   const save=all('button,[role="button"]',dialog).filter(e=>/^(?:save|done|confirm|lưu|xong|xác nhận)$/i.test(label(e))&&!e.disabled&&e.getAttribute('aria-disabled')!=='true');if(save.length!==1)throw Error('Không xác định duy nhất nút lưu đối tượng.');
   const permit=await chrome.runtime.sendMessage({type:'audience-final-permit',jobId:p.jobId,token:p.token});if(!permit?.ok)throw Error(permit?.error||'Đã dừng trước khi lưu đối tượng.');cancel();if(!save[0].isConnected)throw Error('Nút lưu vừa thay đổi.');save[0].click();await wait(()=>!visible(dialog));
  }
  await wait(()=>{article=root();return isPublic(article);});return {ok:true,state:'public'};
 }catch(error){return {ok:false,error:error.message};}
}
