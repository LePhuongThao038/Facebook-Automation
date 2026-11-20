// Injected into the Facebook tab. No writes to Facebook.
globalThis.researchScan=async function(mode,limit=30,known=[],scanId=null){
const pause=ms=>new Promise(r=>setTimeout(r,ms)), all=(s,r=document)=>[...r.querySelectorAll(s)],vis=e=>!!e?.getClientRects().length, txt=e=>e?.innerText?.trim()||'',msg='[data-ad-preview="message"],[data-ad-comet-preview="message"]', article='[role=article][aria-label]',buttons='[role=button],button';
const url=h=>{try{let u=new URL(h,location.href);if(!/(^|\.)facebook\.com$/.test(u.hostname))return '';u.hostname='www.facebook.com';for(const k of [...u.searchParams.keys()])if(!['fbid','story_fbid','id','v'].includes(k))u.searchParams.delete(k);u.hash='';return u.href}catch{return ''}};
const isPost=h=>/\/(?:posts|reels?|videos|share\/[rv])\/[^/?]+|\/watch\/?\?[^#]*\bv=|\/(?:photo(?:\.php|\/)?\?fbid|permalink\.php\?)/.test(h);
const roots=()=>all('[role=dialog]').filter(vis).reverse(),root=()=>roots().find(e=>e.querySelector(msg)||/bài viết|post by|của |reel/i.test(e.ariaLabel||''))||document.querySelector('[role=main]')||document.body;
const step=mode==='profileStep';
if(!globalThis.__researchCaptionSnapshots)globalThis.__researchCaptionSnapshots=new Map();
const previewRows=entries=>entries.map(([url,title])=>({url,title,body:globalThis.__researchCaptionSnapshots.get(url)?.text||'',captionPartial:globalThis.__researchCaptionSnapshots.get(url)?.partial||false}));
let lastStoryDate='';
if(step||mode==='profile'){const quota=step?limit:30;let sent=0;if(!known.length||!globalThis.__researchAliases)globalThis.__researchAliases=new Map();let map=new Map((known.length?globalThis.__researchCarry:[])||[]),skip=new Set(known),idle=0,prev='',ended=false,total=null;for(let i=0;i<(step?1:150);i++){// Facebook hydrates some timestamps on hover. The visible comment date also
// carries the parent post URL. Resolve one permalink per story, never per photo.
const stories = new Set();
for(const card of all('article,[role=article]',root())){
  if(/^(?:bình luận|phản hồi|đáp lại|comment|reply)|\s(?:đáp lại phản hồi của|replied to)\s/i.test(card.getAttribute('aria-label')||''))continue;
  if(card.querySelector('h2 a,h3 a,h4 a,[role=heading] a')&&all('a[href]',card).some(a=>isPost(a.href)))stories.add(card);
}
for (const marker of all(msg+', [aria-label*="Hành động đối với bài viết"], [aria-label*="Actions for this post"]', root())) {
  let card = marker;
  while (card && !card.matches('[role=feed],[role=main],body')) {
    const hasBody = card.querySelector(msg) || card.querySelector('[aria-label*="Bình luận về bài viết"],[aria-label*="Comment on"]');
    if (card.matches('[role=article]') || (hasBody && card.querySelector('h2 a,h3 a,h4 a,[role=heading] a'))) {
      if (card.querySelectorAll(msg).length <= 1) stories.add(card);
      break;
    }
    card = card.parentElement;
  }
}
for (const card of stories) {
  const heading=card.querySelector('h2,h3,h4,[role=heading]');
  const links=all('a[href]',card);
  const stamp=links.find(a=>a.hasAttribute('aria-describedby') && !a.closest('[role=article][aria-label*="luận"]') && (a.hash.startsWith('#?')||isPost(a.href)));
  const description=stamp && document.getElementById(stamp.getAttribute('aria-describedby'))?.textContent;
  const date=description?.match(/(\d{1,2})\s+Tháng\s+(\d{1,2}),?\s+(\d{4})/i);
  if(date)lastStoryDate=[date[3],date[2].padStart(2,'0'),date[1].padStart(2,'0')].join('-');
  const time=links.find(a=>a.hash.startsWith('#?') && (!heading || heading.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING));
  if (time) {
    time.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
    time.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
    time.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));
  }
  const linksNow=links.map(a=>url(a.href));
  const matchesPost=h=>/\/posts\/|permalink\.php\?/.test(h);
  const direct=linksNow.find(matchesPost);
  const h=direct||linksNow.find(isPost);
  if (!h || skip.has(h)) continue;
  const captured=globalThis.researchCaption.read(card);
  if(captured.text)globalThis.__researchCaptionSnapshots.set(h,globalThis.researchCaption.choose(captured,globalThis.__researchCaptionSnapshots.get(h)));
  const preview=captured.text||txt(heading).slice(0,130)||h.split('/').pop();
  // A fallback media URL may later acquire its real timestamp URL.
  const media=linksNow.find(x=>isPost(x)&&!matchesPost(x));
  const alias=media && globalThis.__researchAliases.get(media);
  if(alias && alias!==h && (map.has(alias)||skip.has(alias))) continue;
  if(media) globalThis.__researchAliases.set(media,h);
  map.set(h,preview);
}
let feed=root().querySelector('[role=feed]')||root();let end=all('[role=status],p,span',feed).some(e=>vis(e)&&!e.closest('[role=article]')&&!e.children.length&&/^(?:no more posts(?: to show)?|you.ve reached the end|không còn bài viết(?: nào)?|đã hiển thị hết bài viết)[.!]?$/i.test(txt(e)));let meta=all('h1,h2,h3,[role=heading],span',root()).find(e=>!e.children.length&&!e.closest('[role=article],[role=feed]')&&/^\d+(?:[., ]\d{3})* (?:bài viết|posts)$/i.test(txt(e)));if(meta)total=Number(txt(meta).replace(/\D/g,''));const count=Math.min(30,map.size);
if(scanId && count>sent && globalThis.chrome?.runtime?.sendMessage){
  const rows=previewRows([...map].slice(sent,count));
  sent=count;
  chrome.runtime.sendMessage({type:'profileProgress',scanId,rows,count,total}).catch(()=>{});
}
if(map.size>=quota||end||(total!==null&&map.size+skip.size>=total)){ended=end||total===map.size+skip.size;break}let sc=feed;
while(sc!==document.body && sc.parentElement && !(sc.scrollHeight>sc.clientHeight+10 && /auto|scroll|overlay/.test(getComputedStyle(sc).overflowY))) sc=sc.parentElement;
if(sc===document.body || !sc.parentElement) sc=document.scrollingElement||document.documentElement;

let sig=[map.size,sc.scrollTop,sc.scrollHeight].join(':');idle=sig===prev?idle+1:0;prev=sig;if(idle>=16)break;
if(step){
  const atEnd=sc.scrollTop+sc.clientHeight>=sc.scrollHeight-4;
  const now=Date.now();
  if(atEnd && now-(globalThis.__researchNudge||0)>3500){
    globalThis.__researchNudge=now;
    sc.scrollBy(0,-Math.max(520,sc.clientHeight));
  }else sc.scrollBy(0,Math.max(500,sc.clientHeight*.9));
}
else if(idle===6||idle===12) sc.scrollBy(0,-180);
else sc.scrollBy(0,Math.max(500,Math.round(sc.clientHeight*.85)));
if(!step)await pause(700)}let rows=previewRows([...map].slice(0,quota));globalThis.__researchCarry=[...map].slice(quota);return {rows,lastStoryDate,total:total>=skip.size+rows.length&&total!==null?total:null,ended:ended&&map.size===rows.length}}
if(mode==='gallery'){let seen=new Set,images=[],album=new URL(location.href).searchParams.get('set');if(!album?.startsWith('pcb.'))return [];for(let i=0;i<50;i++){let im=all('img[data-visualcompletion="media-vc-image"],[role=main] img').filter(e=>vis(e)&&e.naturalWidth>200).sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0];if(!im||seen.has(im.src)||new URL(location.href).searchParams.get("set")!==album)break;seen.add(im.src);images.push(im.src);let next=all(buttons+',a[aria-label]').find(x=>vis(x)&&/^(ảnh tiếp theo|next photo)$/i.test(x.ariaLabel||''));if(!next)break;next.click();for(let j=0;j<15&&im.isConnected&&seen.has(im.src);j++)await pause(150);await pause(320)}return images}
let r=root();let reel=/\/(?:reels?|share\/r)\//.test(location.pathname),photo=/^\/photo/.test(location.pathname);const videoPage=reel||/\/(?:videos|share\/v)\//.test(location.pathname)||(/^\/watch\/?$/.test(location.pathname)&&new URL(location.href).searchParams.has('v'));
const initialCaption=globalThis.researchCaption.read(r);
if(reel){const b=all(buttons,r).find(x=>vis(x)&&/^(bình luận|comment)/i.test(x.ariaLabel||''));if(b){b.click();await pause(800)}}
const plain=e=>{if(!e)return '';let c=e.cloneNode(true);for(const im of all('img',c))im.replaceWith(im.alt||'');c.style.cssText='position:fixed;left:-99999px;top:0;width:800px;pointer-events:none';document.body.append(c);let t=txt(c);c.remove();return t};
// 0.2.23: khóa của chủ bài (profile.php?id= hoặc đường dẫn tên) để nhận vai Tác giả cả ở trang ảnh, nơi không có hộp thoại "Bài viết của …".
const ownerKey=(()=>{try{const u=new URL(location.href);const id=u.searchParams.get('id');if(id&&/^\d+$/.test(id))return id;const h=[...document.querySelectorAll('h2 a[href],h3 a[href],h4 a[href],[role=heading] a[href]')].find(a=>!a.closest('[role=article][aria-label]'));if(!h)return '';const v=new URL(h.href);return v.pathname==='/profile.php'?v.searchParams.get('id')||'':v.pathname.replace(/\/$/,'')||'';}catch{return '';}})();
// Cây bình luận: mỗi lượt đọc DỰNG LẠI cả cây theo đúng thứ tự trên trang (bản cũ nối phản hồi vào cuối danh sách
// và bỏ qua comment cha đã đọc, nên phản hồi mất cấp hoặc nằm sai chỗ). Giới hạn tính theo số comment GỐC; mọi
// phản hồi của các comment gốc được lấy đều được mở ("Xem N câu trả lời", "Xem 1 phản hồi").
let comments=[],rootCount=0,cutoff=null;
const readComments=r=>{let author=(r.ariaLabel||'').match(/^(?:bài viết của |post by |post from )(.+)/i)?.[1]||txt(r.querySelector('h2 a,h3 a,h4 a,[role=heading] a'));
const list=[],hist=[],seen=new Set();let roots=0;cutoff=null;
for(const c of all(article,(reel||photo)?document:r)){let label=c.ariaLabel||'';if(!/bình luận|phản hồi|đáp lại|comment|repl/i.test(label))continue;let own=s=>all(s,c).filter(e=>e.closest(article)===c);
let nm=own('a[role=link],a[href],strong').map(txt).find(t=>t&&t.length<100);if(!nm)continue;
let parent=label.match(/(?:đáp lại phản hồi của |phản hồi bình luận của |reply to (?:a comment by )?)(.+?)(?: dưới tên | vào | by | on |$)/i)?.[1];let d=0;if(parent||/reply|replied|phản hồi|đáp lại/i.test(label))d=1+(hist.findLast(x=>x.n===parent)?.d||0);else {let p=c.parentElement.closest(article);while(p && p!==r && /bình luận|phản hồi|đáp lại|comment|repl/i.test(p.ariaLabel||'')){d++;p=p.parentElement.closest(article)}}
if(!d){roots++;if(Number.isFinite(limit)&&roots>limit){cutoff=c;roots--;break}hist.length=0}hist.push({n:nm,d});
let pieces=own('[dir=auto]').filter(e=>!e.closest('a,button,[role=button]')&&!e.querySelector('[dir=auto]')).map(plain).filter(t=>t&&t!==nm&&!/^(tác giả|của tác giả|author|top fan|fan cứng|người theo dõi|follower|like|thích|reply|phản hồi)$/i.test(t));
let content=pieces.join('\n');if(!content){let alt=own('img').map(e=>e.alt).find(s=>s&&/sticker|nhãn dán|thumb|heart|love|clap/i.test(s));if(alt)content=/heart|love|tim/i.test(alt)?'❤️':/clap|vỗ tay/i.test(alt)?'👏':/thumb|like/i.test(alt)?'👍':/laugh|cười/i.test(alt)?'😄':'💬'}if(!content)continue;
// Khóa chống trùng PHẢI riêng cho từng bình luận. Bản cũ lấy comment_id số ở link cuối của mục, mà link đó của một
// câu trả lời trỏ về bình luận CHA, nên mọi câu trả lời trùng khóa với cha và bị bỏ (Post Research chưa từng xuất được
// câu trả lời). Nay dùng reply_comment_id nếu có, nếu không thì mã comment_id đầu tiên của chính mục đó (mỗi mục một mã),
// kèm nhãn, tên và nội dung.
const ids=own('a[href*="comment_id="]').map(a=>{try{const u=new URL(a.href);return u.searchParams.get('reply_comment_id')||u.searchParams.get('comment_id')||''}catch{return ''}}).filter(Boolean);
let key=[ids[0]||'',label,nm,content].join('|');if(seen.has(key))continue;seen.add(key);
const profileLink=own("a[href]").find(a=>txt(a)===nm);let personKey;if(profileLink){const u=new URL(profileLink.href);personKey=u.pathname==="/profile.php"?u.searchParams.get("id"):u.pathname.replace(/\/$/,"")||undefined}const authorBadge=own('[aria-label="Tác giả"],[aria-label="Author"]').length||own('span,div').some(e=>!e.children.length&&/^(?:tác giả|author)$/i.test(txt(e)));list.push({personKey,originalName:nm,name:nm===author||authorBadge||(ownerKey&&personKey===ownerKey)?'Tác giả':nm,text:content,depth:d})}
comments=list;rootCount=roots;
};
const commentLabel=/bình luận dưới tên|phản hồi bình luận|đáp lại phản hồi|comment by|reply by|reply to/i;
let stoppedEarly=false,last='',idle=0;
const filter=all(buttons,root()).find(e=>/^(phù hợp nhất|most relevant|mới nhất|newest)$/i.test(txt(e)));
if(filter){filter.click();await pause(350);let opt=all('[role=menuitem],[role=menuitemradio],[role=option],'+buttons).find(e=>vis(e)&&/^(tất cả bình luận|all comments)(?:\n|$)/i.test(txt(e)));if(opt)opt.click();else filter.click();await pause(350)}
const expander=/^(xem thêm|see more|(?:xem|view|see|show) (?:thêm |more |previous |all |tất cả )?(?:\d+ )?(?:bình luận|phản hồi|câu trả lời|replies|comments)(?: khác| trước| nữa| more)?|\d+ (?:phản hồi|câu trả lời|replies))$/i;
const moreRoots=/(?:bình luận|comments)/i;
for(let k=0;;k++){r=root();readComments(r);const full=Number.isFinite(limit)&&rootCount>=limit;
let clicks=all(buttons,r).filter(e=>vis(e)&&expander.test(txt(e)));
// Đủ số comment gốc: không tải thêm comment gốc, nhưng vẫn mở phản hồi/"Xem thêm" của các comment đã lấy (nằm trước comment gốc bị cắt).
if(full)clicks=clicks.filter(e=>!moreRoots.test(txt(e))&&(!cutoff||(e.compareDocumentPosition(cutoff)&Node.DOCUMENT_POSITION_FOLLOWING)));
let sig=comments.length+'|'+clicks.map(txt).join('|');idle=sig===last?idle+1:0;last=sig;if(idle>=3){stoppedEarly=!!clicks.length;break}
if(!clicks.length){if(full)break;let lastComment=all(article,r).at(-1);lastComment?.scrollIntoView({block:'end'});await pause(600);if(k>40)break;continue}
clicks.slice(0,8).forEach(e=>e.click());await pause(650)}
// Trang ảnh (/photo/?fbid=): caption nằm ở khung bên phải [role=complementary], NGOÀI [role=main], nên bản cũ không thấy
// caption và dùng bản xem trước đã bị cắt ở dòng thời gian ("…"). Đọc khối chữ đầu tiên của khung, bỏ dòng ngày đăng
// (Facebook chèn ký tự ẩn U+034F), số đếm ảnh "6/29" và bình luận; bấm "Xem thêm" trước nếu có.
const photoCaption=async()=>{const side=all('[role=complementary]').find(vis);if(!side)return null;
for(const b of all(buttons,side).filter(e=>vis(e)&&!globalThis.researchCaption.isComment(e)&&/^(xem thêm|see more)$/i.test(txt(e))).slice(0,2)){b.click();await pause(500)}
const blocks=all('div[dir="auto"],span[dir="auto"]',side).filter(e=>vis(e)&&!globalThis.researchCaption.isComment(e)&&!e.closest('a,time,button,[role=button],h1,h2,h3,h4,[role=heading]')&&!e.querySelector('h1,h2,h3,h4,[role=heading],button,[role=button]'));
const outer=blocks.filter(e=>!blocks.some(o=>o!==e&&o.contains(e)));
const el=outer.find(e=>{const t=txt(e);return t&&!/\u034f/.test(t)&&!/xem bài viết|^\d+\s*\/\s*\d+$|^\d{1,2} tháng \d/i.test(t)});
return el?{text:globalThis.researchCaption.text(el),partial:/\bsee more\s*$|xem thêm\s*$/i.test(el.innerText||''),method:'photo-panel'}:null};
r=root();let capturedCaption=globalThis.researchCaption.choose(globalThis.researchCaption.read(r),initialCaption);if(photo){const pc=await photoCaption();if(pc?.text)capturedCaption={...pc,fallback:false};}let body=capturedCaption.text;let head=r.querySelector('h2,h3,h4,[role=heading]');let author=(r.ariaLabel||'').replace(/^(bài viết của |post by |post from )/i,'');if(!author||author===r.ariaLabel)author=txt(head?.querySelector('a'))||txt(head);
let locationText=txt(head).match(/(?:đang ở|is at|đang tại)\s+(.+?)(?:[.\n]|$)/i)?.[1]||'';
let images=[],gallery='',more=false;for(const a of all('a[href*="/photo"]',r)){if(globalThis.researchCaption.isComment(a))continue;let im=a.querySelector('img');if(im?.src&&!images.includes(im.src))images.push(im.src);if(!gallery&&/set=pcb[.%]/i.test(a.href))gallery=a.href;if(/\+\s*\d+/.test(txt(a)))more=true}
if(photo){let im=all('img[data-visualcompletion="media-vc-image"],[role=main] img').filter(e=>vis(e)&&e.naturalWidth>200).sort((a,b)=>b.clientWidth*b.clientHeight-a.clientWidth*a.clientHeight)[0];if(im)images=[im.src]}
// 0.2.26.7: <video> trong bình luận (GIF, video người bình luận gửi) không phải media của bài. Bản cũ tính cả nó,
// nên bài ảnh có bình luận dạng GIF bị coi là bài video (Docs "yến 5": bài 13, 18).
const inComment=e=>globalThis.researchCaption.isComment(e)||Boolean(e.closest('[role=article][aria-label*="luận"],[role=article][aria-label*="comment"],[role=article][aria-label*="reply"]'));
const vs=all('video',r).filter(e=>!inComment(e));const v=vs.find(vis)||vs[0]||(videoPage?all('video').find(vis):null);readComments(r);
if(!body&&!images.length&&!v&&!videoPage)throw Error('Không thấy nội dung. Kiểm tra bài trong tab Facebook (đăng nhập, quyền xem hoặc giao diện mới).');
// A permalink can expose the original file in its Open Graph metadata
// even when its HTML player uses a MediaSource blob.
const current = new URL(location.href);
const canonical = document.querySelector('meta[property="og:url"]')?.content;
const videoKey=u=>u.pathname.replace(/\/$/,'')+'|'+(u.searchParams.get('v')||u.searchParams.get('fbid')||u.searchParams.get('story_fbid')||'');
let ogVideo='',captionMeta=false;
// 0.2.22: Reel/video thường không có khối message như bài thường; bản cũ lấy nhầm chữ "Facebook" của giao diện.
// Khi DOM không có caption, dùng og:description của đúng trang này (og:url phải trùng link đang mở).
if(!body&&(reel||videoPage)&&canonical)try{if(videoKey(new URL(canonical))===videoKey(current)){const meta=String(document.querySelector('meta[property="og:description"]')?.content||document.querySelector('meta[name="description"]')?.content||'').trim();if(meta&&!/(?:on|trên) facebook|log ?in|đăng nhập|^(?:reels?|facebook|video)$/i.test(meta)){body=meta;captionMeta=true;}}}catch{}
if(canonical && (v||reel))try{
  if(videoKey(new URL(canonical))===videoKey(current)){
    ogVideo=all('meta[property="og:video:secure_url"],meta[property="og:video:url"],meta[property="og:video"]').map(m=>m.content).find(h=>{
      try{const u=new URL(h);return u.protocol==='https:'&&/(^|\.)(fbcdn\.net|fbsbx\.com|facebook\.com)$/.test(u.hostname)&&/\.mp4(?:$|\?)/i.test(u.href)}catch{return false}
    })||'';
  }
}catch{}
// Link riêng của TỪNG video trong vùng media của bài (không lấy trong bình luận). Ô video trong album có dạng
// /<uid>/videos/pcb.<album>/<mã video>; link bài viết (/posts/…) thì yt-dlp không đọc được khi chưa đăng nhập.
const videoLinks=[],videoIds=new Set();
const addVideo=h=>{try{const u=new URL(h,location.href);const id=u.searchParams.get('v')||u.pathname.match(/\/(?:videos|reels?)\/(?:pcb\.\d+\/)?(\d{6,})/)?.[1];if(!id||videoIds.has(id))return;videoIds.add(id);u.hash='';for(const k of [...u.searchParams.keys()])if(k!=='v')u.searchParams.delete(k);u.hostname='www.facebook.com';videoLinks.push(u.href)}catch{}};
// 0.2.26.1: không phụ thuộc aria-label hay thẻ video con. Facebook có thể render ô media bằng link video
// không có nhãn tiếng Việt/tiếng Anh; trong vùng bài (loại trừ comment), link /videos/, /reel/, /watch?v=
// vẫn là nguồn của chính media đó và có thể xuất thành Media JSON riêng.
// 0.2.26.7: trang Reel/video chỉ có MỘT video và mã của nó nằm ngay trên link trang. Không gom link khác
// (gợi ý, Reel kế tiếp) vì đó không phải video của bài (Docs "yến 5": mỗi Reel thừa một mã lạ).
if(videoPage)addVideo(location.href);
if(!videoPage)for(const a of all('a[href]',r)){
 if(inComment(a))continue;
 const h=a.getAttribute('href')||'';if(/\/(?:videos|reels?)\/|\/watch\/?\?v=/.test(h))addVideo(a.href);
}
// 0.2.26.2: Facebook đóng gói link/video ID trong JSON trong script, không đặt nó trên <a>.
// Đọc cả payload và chuyển mọi video_id/reel/watch link trong vùng bài thành link riêng.
const sourcePayload=[...all('script[type="application/json"],script:not([src])')].map(s=>s.textContent||'').join('\n');
// 0.2.26.6: script/JSON chỉ được dùng sau khi đã xác nhận bài là video bằng DOM hoặc og:video.
// Không dùng nó cho bài ảnh vì HTML trang bài có thể chứa nhiều mã ID gợi ý/cấu trúc và số đó không phải mã video.
// 0.2.26.7: payload là của CẢ trang (video gợi ý, cột bên, Reel khác), không riêng bài. Bản cũ gom hết nên bài ảnh
// ra 7 dòng Media JSON lạ, có mã trùng giữa các bài khác nhau. Nay chỉ dùng khi bài có <video> thật mà DOM không
// cho link, và chỉ nhận khi số mã tìm được không vượt số video của bài; nhiều hơn thì không đoán (để trống, quét lại tay).
const fallbackConfirmedVideo=Boolean(v)&&!videoPage&&!videoLinks.length;
const linksBeforePayload=videoLinks.length;
if(fallbackConfirmedVideo){
 for(const h of sourcePayload.match(/https?:\\?\/\\?\/(?:www\\.)?facebook\\.com[^"'\s<>]*/g)||[]){
  const clean=h.replaceAll('\\/','/').replaceAll('\\\\','');
  if(/\/(?:videos|reels?)\/|\/watch\/?\?v=/.test(clean))addVideo(clean);
 }
 for(const match of sourcePayload.matchAll(/["']?(?:video[_-]?id|videoId)["']?\s*:\s*["']?(\d{6,25})/gi)){
  addVideo('https://www.facebook.com/watch/?v='+match[1]);
 }
 for(const match of sourcePayload.matchAll(/\/(?:reel|reels)\/(\d{6,25})/g)){
  addVideo('https://www.facebook.com/reel/'+match[1]);
 }
 for(const match of sourcePayload.matchAll(/\/(?:videos)\/[^"'\\s]*\/(\d{6,25})/g)){
  addVideo('https://www.facebook.com/watch/?v='+match[1]);
 }
 if(videoLinks.length-linksBeforePayload>vs.length){for(const link of videoLinks.splice(linksBeforePayload)){try{const u=new URL(link);videoIds.delete(u.searchParams.get('v')||u.pathname.match(/(\d{6,})/)?.[1]);}catch{}}}
}
if(!videoLinks.length&&(reel||videoPage))addVideo(canonical||location.href);
// Caption lấy theo cách dự phòng (text-block) mà mở đầu bằng tên một người bình luận trong chính bài: nghi là lời trả lời
// bình luận (vd. "Duy Nguyễn tks bro"). Chỉ đánh dấu để người vận hành kiểm tra; caption đọc từ khối message giữ nguyên.
const lowerVi=v=>String(v||'').normalize('NFC').toLocaleLowerCase('vi').trim();
const captionSuspect=Boolean(body)&&!captionMeta&&capturedCaption.method==='text-block'&&comments.some(c=>c.originalName&&lowerVi(body).startsWith(lowerVi(c.originalName)+' '));
let authorURL=head?.querySelector('a[href]')?.href;try{let u=new URL(authorURL);if(!/(^|\.)facebook\.com$/.test(u.hostname)||!/^\/(?:profile\.php|people\/[^/]+\/\d+|[\w.-]+)\/?$/.test(u.pathname)||/^(?:\/(?:groups|reel|watch|photo.php|stories))$/.test(u.pathname))authorURL=null}catch{authorURL=null}
// 0.2.26.6: og:type="video.other" không phải bằng chứng bài là video. Bài ảnh phải có ít nhất
// một phần tử <video>, og:video hoặc URL Reel/video/watch thật mới được đánh dấu video.
const confirmedVideo=Boolean(v||ogVideo||videoPage);
return {stoppedEarly,body,captionEmptyCandidate:!body&&Boolean(images.length||confirmedVideo)&&Boolean(author)&&capturedCaption.method==='missing'&&!document.querySelector('[role="progressbar"],[aria-busy="true"],input[name="pass"]')&&!(/login|checkpoint/.test(location.pathname)),captionPartial:captionMeta?false:(capturedCaption.partial||captionSuspect),captionMethod:captionMeta?'meta':captionSuspect?'nghi-tra-loi-binh-luan':capturedCaption.method,author,authorURL,location:locationText,images,comments,gallery,more,video:confirmedVideo,videoLinks:confirmedVideo?videoLinks:[],sourceKind:reel||/\/reels?\//.test(canonical||'')?'reel':confirmedVideo?'video':'post',videoURL:[v?.currentSrc,v?.src,v?.querySelector('source')?.src,ogVideo].find(s=>/^https:/.test(s||''))||''}
}






