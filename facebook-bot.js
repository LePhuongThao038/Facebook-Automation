// Runs only in the selected Facebook tab. No Facebook private APIs, tokens or cookies.
export async function facebookBot(action,payload={}){
 const botClick=el=>{
  const guard=globalThis.__deskTabGesture;
  if(guard&&payload.jobId)guard.actionAt=Date.now();
  el.click();
 };
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));const norm=s=>String(s||'').normalize('NFKC').replace(/[\u200b-\u200f\u034f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
 // 3.8.6: không loại phần tử theo opacity. Tab nền/cửa sổ bị che làm Chrome dừng animation,
 // hộp soạn có thể kẹt ở opacity 0 dù đã dựng xong và thao tác được.
 const visible=e=>!!(e&&e.isConnected&&!e.closest('[hidden],[inert],[aria-hidden="true"]')&&e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden');
 const label=e=>{
  const ids=(e.getAttribute('aria-labelledby')||'').trim().split(/\s+/).filter(Boolean);
  const linked=ids.map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();
  return String(e.getAttribute('aria-label')||linked||e.getAttribute('title')||e.innerText||e.value||'').normalize('NFKC').replace(/[\u200b-\u200f\u202a-\u202e\u2066-\u2069\u034f]/g,'').replace(/\s+/g,' ').trim();
 };
 const all=(sel,root=document)=>[...root.querySelectorAll(sel)].filter(visible);
 const buttons=(root=document)=>all('button,[role="button"],input[type="submit"],input[type="button"]',root);
 const find=(patterns,root=document)=>{const matches=buttons(root).filter(e=>patterns.some(p=>p.test(label(e))));if(matches.length!==1)throw Error('Không xác định duy nhất nút: '+patterns.map(String).join(' / '));return matches[0];};
 const wait=async(fn,timeout=15000)=>{const start=Date.now();while(Date.now()-start<timeout){const r=fn();if(r)return r;await sleep(300);}throw Error('Facebook phản hồi quá chậm hoặc giao diện không khớp.');};
 const inputValue=(e,value)=>{e.focus();if(e.isContentEditable){const range=document.createRange();range.selectNodeContents(e);const s=getSelection();s.removeAllRanges();s.addRange(range);if(!document.execCommand('insertText',false,value))throw Error('Không điền được nội dung.');}else{const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,value);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}};
 const draftEditors=root=>{
  const editable=all('[contenteditable="true"]',root).filter(e=>!e.closest('[role="combobox"],[role="search"]'));
  const named=editable.filter(e=>e.matches('[role="textbox"],[data-lexical-editor="true"]'));
  return named.length?named:editable;
 };
 const composerCandidates=()=>{
  const found=all('[role="dialog"],dialog').filter(e=>/create (?:a )?post|tạo bài viết|tạo bài đăng/i.test(label(e)+' '+e.innerText)&&draftEditors(e).length===1);
  return found.filter(e=>!found.some(other=>other!==e&&e.contains(other)));
 };
 const composer=()=>{const found=composerCandidates();if(found.length===1)return found[0];if(found.length)return null;const review=globalThis.__deskReviewComposer;return review?.jobId===payload.jobId&&review.token===payload.token&&visible(review.root)?review.root:null;};
 const publishName=e=>/^(?:post|publish|post now|publish now|đăng|đăng bài|đăng bài viết|đăng ngay|đăng bây giờ)$/i.test(label(e));
 const disabled=e=>!!(e.disabled||e.matches(':disabled')||e.closest('[aria-disabled="true"],[inert],[aria-busy="true"]')||e.closest('fieldset[disabled]')||getComputedStyle(e).pointerEvents==='none');
 // 3.8.6: "bị che" chỉ được kết luận bằng hit-test ngay tại nút Đăng. Bản cũ coi mọi hộp
 // thoại khác giao với vùng soạn (chat Messenger, popover nằm dưới lớp phủ) là đang che,
 // nên báo blocking-dialog ở hầu hết lượt chạy dù nút bấm được.
 const coveredBy=b=>{
  let r=b.getBoundingClientRect();
  if(!r.width||!r.height)return 'nút không có kích thước';
  if(r.top<0||r.left<0||r.bottom>innerHeight||r.right>innerWidth){b.scrollIntoView({block:'center',inline:'nearest'});r=b.getBoundingClientRect();}
  const x=Math.min(Math.max(r.left+r.width/2,0),innerWidth-1),y=Math.min(Math.max(r.top+r.height/2,0),innerHeight-1);
  const hit=document.elementFromPoint(x,y);
  if(!hit)return 'nút nằm ngoài khung nhìn';
  if(hit===b||b.contains(hit)||hit.contains(b))return '';
  const layer=hit.closest('[role="dialog"],dialog,[role="menu"],[role="listbox"],[role="tooltip"]');
  return (layer?(layer.getAttribute('role')||layer.tagName)+': '+(label(layer)||layer.innerText||'').slice(0,60):hit.tagName+(hit.getAttribute('aria-label')?' '+hit.getAttribute('aria-label').slice(0,40):'')).replace(/\s+/g,' ');
 };
 const publishSnapshot=root=>{
  if(!root)return {status:composerCandidates().length>1?'ambiguous-composer':'missing-composer',candidates:[]};
  const matches=buttons(root).filter(e=>publishName(e)&&root.contains(e));
  const unique=matches.filter(e=>!matches.some(other=>other!==e&&e.contains(other)));
  const enabled=unique.filter(e=>!disabled(e));
  let cover='';if(enabled.length===1)cover=coveredBy(enabled[0]);
  const status=enabled.length>1?'ambiguous-button':enabled.length===1?(cover?'blocking-dialog':'ready'):unique.length?'disabled-button':'missing-button';
  return {status,button:status==='ready'?enabled[0]:null,candidates:unique.map(e=>({label:label(e).slice(0,100),tag:e.tagName,disabled:disabled(e)})),blockingDialogs:cover?1:0,cover};
 };
 const publishDiagnostic=()=>{try{const root=composer(),snapshot=publishSnapshot(root);return {stage:action,status:snapshot.status,cover:snapshot.cover||'',visibility:document.visibilityState,language:document.documentElement.lang||'',platform:navigator.platform,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},composerCount:composerCandidates().length,candidates:snapshot.candidates,visibleButtons:root?buttons(root).map(e=>label(e).slice(0,100)).filter(Boolean).slice(0,20):[],blockingDialogs:snapshot.blockingDialogs||0};}catch{return {stage:action,status:'diagnostic-unavailable',visibility:document.visibilityState};}};

 const audienceLabels=e=>[label(e),e.getAttribute('title')||'',e.innerText||''].map(norm).filter(Boolean);
 const audienceButtons=root=>root?buttons(root).filter(e=>e.closest('[role="dialog"],dialog')===root&&!e.closest('[contenteditable="true"]')&&audienceLabels(e).some(value=>!/(?:tag|gắn thẻ|bình luận|comment|story|tin của bạn)/i.test(value)&&(/^(?:public|friends(?: except.*)?|only me|specific friends|custom|công khai|bạn bè(?: ngoại trừ.*)?|chỉ mình tôi|bạn bè cụ thể|tùy chỉnh)$/i.test(value)||/^(?:select |edit |change |chọn |chỉnh sửa )?(?:post audience|audience|privacy|đối tượng|quyền riêng tư)/i.test(value)))):[];
 const audienceValue=value=>value
  .replace(/^(?:edit privacy\.\s*sharing with|chỉnh sửa quyền riêng tư\.\s*đang chia sẻ với)\s+/i,'')
  .replace(/\.$/,'').trim();
 const audienceState=()=>{
  const root=composer();if(!root)return {mode:'unknown',label:'Không thấy hộp soạn'};
  const controls=audienceButtons(root);if(controls.length!==1)return {mode:'unknown',label:'Có '+controls.length+' nút đối tượng phù hợp'};
  const names=audienceLabels(controls[0]).map(audienceValue);const publicLabel=names.find(value=>/^(?:public|công khai)$|^(?:post audience|audience|đối tượng(?: của bài viết)?|quyền riêng tư)\s*[:：·-]?\s*(?:public|công khai)$/i.test(value));
  const nonPublic=names.some(value=>/^(?:(?:your )?friends(?: except.*)?|only me|specific friends|custom|bạn bè(?: của bạn| ngoại trừ.*)?|chỉ mình tôi|bạn bè cụ thể|tùy chỉnh)$/i.test(value));
  return {mode:publicLabel&&!nonPublic?'public':'other',label:label(controls[0]),button:controls[0]};
 };
 const checkAudiencePolicy=()=>{
  if(payload.audience==='default')return {jobId:payload.jobId,token:payload.token,mode:'default'};
  const state=audienceState(),proof=globalThis.__deskPublicAudience;
  if(state.mode!=='public'||proof?.jobId!==payload.jobId||proof?.token!==payload.token)throw Error('Chưa xác nhận Công khai/Public cho đúng bài. Đối tượng hiện tại: '+state.label);
  return {jobId:payload.jobId,token:payload.token,mode:'public',label:state.label};
 };
 const ensurePublicAudience=async()=>{
  cancel();const current=audienceState();
  if(current.mode!=='public'){
   delete globalThis.__deskPublicAudience;
   throw Error('Chưa xác nhận Công khai/Public: '+current.label+'. Hãy tự đặt đối tượng bài viết thành Công khai rồi chạy lại. FB Desk không tự đổi quyền riêng tư.');
  }
  globalThis.__deskPublicAudience={jobId:payload.jobId,token:payload.token,mode:'public'};
  return {ok:true,audience:'public',label:current.label};
 };
 const publishError=snapshot=>({ 'missing-composer':'Chưa xác định được hộp soạn đang hoạt động.', 'ambiguous-composer':'Có nhiều hộp soạn đang mở; chưa xác định được đúng bài.', 'missing-button':'Chưa thấy nút Post/Đăng trong đúng hộp soạn.', 'ambiguous-button':'Có nhiều nút Post/Đăng đang hoạt động trong hộp soạn.', 'disabled-button':'Đã tìm thấy nút Post/Đăng nhưng Facebook còn khóa nút.', 'blocking-dialog':'Có hộp thoại khác đang che bước đăng.' }[snapshot.status]||'Nút đăng chưa sẵn sàng.');
 const waitPublish=async(timeout=20000)=>{const start=Date.now();let snapshot;do{cancel();snapshot=publishSnapshot(composer());if(snapshot.status==='ready')return snapshot.button;if(snapshot.status==='ambiguous-button'||snapshot.status==='ambiguous-composer')break;await sleep(300);}while(Date.now()-start<timeout);throw Error(publishError(snapshot)+(snapshot.cover?' Lớp che: '+snapshot.cover+'.':'')+' Nhãn thấy: '+(snapshot.candidates.map(e=>e.label+(e.disabled?' [khóa]':'')).join(' / ')||'không có'));};
 const captionMatches=()=>{const root=composer();if(!root)return false;const edits=draftEditors(root);if(edits.length===1)return matches(edits[0],payload.text);const review=globalThis.__deskReviewComposer;return review?.root===root&&review.text===norm(payload.text)&&(!norm(payload.text)||norm(root.innerText).includes(norm(payload.text)));};
 const advancePublish=async()=>{
  const root=composer();if(!root)throw Error(publishError(publishSnapshot(root)));
  if(publishSnapshot(root).candidates.length)return;
  const next=buttons(root).filter(e=>/^(?:next|tiếp|tiếp theo)$/i.test(label(e))&&!disabled(e));
  if(next.length!==1)return;
  assertMedia();if(!captionMatches())throw Error('Nội dung chưa khớp trước bước Tiếp theo.');cancel();await checkActor();cancel();
  const session={jobId:payload.jobId,token:payload.token,text:norm(payload.text)};
  globalThis.__deskReviewComposer=null;botClick(next[0]);
  await wait(()=>{
   const roots=all('[role="dialog"],dialog').filter(e=>/post settings|review post|cài đặt bài viết|xem lại bài viết|create (?:a )?post|tạo bài viết/i.test(label(e)+' '+e.innerText)&&buttons(e).some(publishName)&&(!session.text||norm(e.innerText).includes(session.text.slice(0,80))));
   const unique=roots.filter(e=>!roots.some(other=>other!==e&&e.contains(other)));if(unique.length!==1)return;
   globalThis.__deskReviewComposer={...session,root:unique[0]};return true;
  },20000);
  // Màn Tiếp theo vẫn phải còn đủ media (đếm lại, không so URL ảnh).
  assertMedia();
 };
 // 3.8.6: đếm media bằng ảnh/video xem trước MỚI xuất hiện trong hộp soạn (+N của album),
 // không bắt nút xóa phải khớp từng ảnh và không so URL ảnh (Facebook đổi blob: -> CDN sau khi tải).
 const mediaState=expected=>{
  const root=composer();if(!root)return {ready:false,count:0,images:0,videos:0,reason:'Hộp soạn đã đóng.'};
  const before=new Set(globalThis.__deskUploadBaseline||[]);
  const previews=all('img,video',root).filter(e=>{
   const src=e.currentSrc||e.src||e.poster||'';if(e.closest('[contenteditable="true"]'))return false;
   if(e.tagName==='IMG'&&(!src||before.has(src)))return false;
   if(e.tagName==='IMG'&&(e.complete===false||e.naturalWidth<32))return false;
   const r=e.getBoundingClientRect();return r.width>=48&&r.height>=48;
  });
  const videos=previews.filter(e=>e.tagName==='VIDEO').length;
  // Ảnh bìa của video (img nằm cùng khung với thẻ video) không tính thêm.
  const images=previews.filter(e=>e.tagName==='IMG'&&!previews.some(v=>v.tagName==='VIDEO'&&v.parentElement&&v.parentElement.parentElement?.contains(e))).length;
  let extra=0;for(const e of all('span,div',root))if(!e.children.length){const m=(e.innerText||'').trim().match(/^\+\s?(\d{1,3})$/);if(m)extra=Math.max(extra,Number(m[1]));}
  const albumLabel=Math.max(0,...[root,...all('[aria-label]',root)].map(e=>{const m=(e.getAttribute('aria-label')||'').match(/(?:^|\s)(\d{1,3})\s*(?:photos|images|ảnh)(?:\s|$)|^(?:edit all|chỉnh sửa tất cả|sửa tất cả)\s*\(?(\d{1,3})\)?/i);return m?Number(m[1]||m[2]):0;}));
  // Ô cuối mang nhãn "+N" đã nằm trong N (log thật: 5 ô + "+2" = 6 ảnh, 5 ô + "+6" = 10 ảnh).
  const total=Math.max(images+videos+(extra?extra-1:0),albumLabel);
  const loading=Boolean(all('[role="progressbar"]',root).length||/uploading|đang tải lên|processing video|đang xử lý video/i.test(root.innerText));
  const error=all('[role="alert"]',root).some(e=>/failed|error|không thể|lỗi/i.test(e.innerText));
  const wantedImages=expected.filter(t=>t==='image').length,wantedVideos=expected.filter(t=>t==='video').length;
  const ready=!loading&&!error&&(total===expected.length||(wantedVideos>0&&total>expected.length));
  return {ready,count:ready?expected.length:total,images:ready?wantedImages:images,videos:ready?wantedVideos:videos,total,signature:String(total),reason:`cần ${wantedImages} ảnh/${wantedVideos} video; thấy ${images} ảnh/${videos} video${extra?' +'+extra:''}${albumLabel?'; nhãn album '+albumLabel:''}; đang tải=${loading}; lỗi=${error}`};
 };
 const assertMedia=()=>{
  if(!Array.isArray(payload.expectedMedia)||payload.expectedMedia.some(t=>!['image','video'].includes(t)))throw Error('Dừng an toàn: thiếu khai báo media của bài.');
  const expected=payload.expectedMedia,proof=globalThis.__deskMediaProof;
  if(expected.length&&(!proof||proof.jobId!==payload.jobId||proof.token!==payload.token||JSON.stringify(proof.expected)!==JSON.stringify(expected)))throw Error('Dừng an toàn: chưa có bằng chứng tải đủ media của lượt này.');
  const live=mediaState(expected);
  if(!live.ready)throw Error('Dừng an toàn: media chưa đủ hoặc đang tải trước khi đăng ['+live.reason+']. Không đăng riêng caption.');
  return {jobId:payload.jobId,token:payload.token,count:live.count,images:live.images,videos:live.videos,proofId:expected.length?proof.id:''};
 };
 const editor=()=>{const root=composer();if(!root)throw Error('Không thấy hộp tạo bài.');const es=draftEditors(root);if(es.length!==1)throw Error('Có nhiều ô soạn, cần kiểm tra.');return es[0];};
 const editorText=el=>{
  const read=node=>{
   if(node.nodeType===3)return node.nodeValue;
   if(node.tagName==='IMG')return node.alt||'';
   if(node.tagName==='BR')return '\n';
   const value=Array.from(node.childNodes,read).join('');
   return ['P','DIV','LI'].includes(node.tagName)?value+'\n':value;
  };
  return read(el).trimEnd();
 };
 const matches=(el,text)=>[editorText(el),el.innerText].some(value=>norm(value)===norm(text));
 const fillText=async(el,text)=>{
  el.focus();
  const dt=new DataTransfer();dt.setData('text/plain',text);
  const ev=new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true});
  el.dispatchEvent(ev);
  await sleep(350);
  if(!matches(el,text)){
   if(!el.isConnected)throw Error('Ô soạn đã thay đổi. Mở lại bài.');
   const range=document.createRange();range.selectNodeContents(el);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.execCommand('delete');el.focus();
   for(const [i,line] of text.replace(/\r\n?/g,'\n').split('\n').entries()){
    if(i)document.execCommand('insertParagraph');
    if(line)document.execCommand('insertText',false,line);
   }
  }
  await wait(()=>matches(el,text),4500).catch(()=>{throw Error('Nội dung trong ô soạn chưa khớp sau khi điền ('+editorText(el).length+'/'+text.length+' ký tự).');});
 };
 const canonical=value=>{try{const u=new URL(value,location.origin);if(u.hostname!=='www.facebook.com')return '';if(u.searchParams.get('story_fbid')&&u.searchParams.get('id'))return `${u.origin}/permalink.php?story_fbid=${u.searchParams.get('story_fbid')}&id=${u.searchParams.get('id')}`;if(/\/(posts|videos|reel)\/[\w.-]+/.test(u.pathname))return u.origin+u.pathname.replace(/\/+$/,'');if(/^\/(photo.php|photo\/?|permalink.php)$/.test(u.pathname)&&u.searchParams.get('fbid'))return u.origin+'/photo.php?fbid='+u.searchParams.get('fbid');return '';}catch{return '';}};
 const profile=value=>{try{const u=new URL(value,location.origin);return u.pathname==='/profile.php'&&u.searchParams.get('id')?'id:'+u.searchParams.get('id'):u.pathname.replace(/\/+$/,'').toLowerCase();}catch{return '';}};
 const aiIndex=async(kind,options)=>{
  const answer=await chrome.runtime.sendMessage({type:'bot-ui-choice',jobId:payload.jobId,token:payload.token,kind,options});
  if(!answer?.ok||!Number.isInteger(answer.data)||answer.data<0||answer.data>=options.length)throw Error(answer?.error||'Gemini chưa chọn được mục.');
  return answer.data;
 };
 function readProfileHeader(trustedRedirect,diag={}){
  const u=new URL(location.href),path=u.pathname.replace(/\/+$/,'');
  if(u.origin!=='https://www.facebook.com')return null;
  const people=path.match(/^\/people\/[^/]+\/(\d+)$/i);
  const id=people?.[1]||(path==='/profile.php'?u.searchParams.get('id'):'');
  const slug=/^\/[a-z0-9.]+$/i.test(path)&&!/^\/(?:me|home|groups|watch|marketplace|friends|settings|help|notifications|messages|reel|gaming|pages|events|stories|accounts|privacy|consent|login|checkpoint|recover|search|photos|videos|.*\.php)$/i.test(path);
  if(!/^\d+$/.test(id||'')&&!slug)return null;
  const url=id?u.origin+'/profile.php?id='+id:u.origin+path;
  const ignore='article,[role="article"],[role="dialog"],[role="navigation"],nav,[role="feed"]';
  const clean=v=>String(v||'').normalize('NFKC').replace(/[\u200b-\u200f]/g,'').replace(/\s+/g,' ').trim();
  const usable=v=>v&&v.length<=160&&!/^(facebook|home|trang chủ|notifications?|thông báo|profile|trang cá nhân)$/i.test(v);
  const edit=all('button,[role="button"],a[href],span[tabindex],div[tabindex],span').find(e=>!e.closest(ignore)&&[label(e),e.innerText].some(v=>/^(chỉnh sửa trang cá nhân|edit profile)$/i.test(clean(v))));
  diag.reason=edit?'Đã thấy nút sửa, chưa đọc được tên.':'Không đọc được nút sửa trên tab này.';
  if(!edit&&!trustedRedirect)return null;
  const meta=clean(document.querySelector('meta[property="og:title"]')?.content||document.title).replace(/^\(\d+\)\s*/,'').replace(/\s*[|·–-]\s*Facebook$/i,'').trim();
  const headings=all('h1,h2,[role="heading"]').filter(e=>!e.closest(ignore));
  if(usable(meta)&&headings.some(e=>clean(e.innerText)===meta))return {name:meta,url};
  if(edit&&usable(meta)&&all('span,strong').some(e=>!e.closest(ignore)&&clean(e.innerText)===meta))return {name:meta,url};
  // Start at the edit control to exclude suggested friends elsewhere on the page.
  for(let root=edit?.parentElement;root&&root!==document.body;root=root.parentElement){
   const names=[...new Set(headings.filter(e=>root.contains(e)&&e.matches('h1,[aria-level="1"]')).map(e=>clean(e.innerText)).filter(usable))];
   if(names.length===1)return {name:names[0],url};
   if(names.length>1)break;
  }

  const primary=headings.filter(e=>e.matches('h1,[aria-level="1"]')).map(e=>clean(e.innerText)).filter(usable);
  return trustedRedirect&&new Set(primary).size===1?{name:primary[0],url}:null;
 }
 // Chủ trang: địa chỉ trang đang mở trùng nick đã liên kết VÀ có nút sửa trang (chỉ chủ trang mới thấy). Không cần đọc tên.
 const ownerByUid=diag=>{
  if(!payload.actor?.url)return null;
  const here=profile(location.href),want=profile(payload.actor.url);
  if(!want||here!==want||(!/^id:\d+$/.test(want)&&!/^\/[a-z0-9.]+$/i.test(want))){diag.uid='Trang đang mở không trùng nick đã liên kết.';return null;}
  const skip='article,[role="article"],[role="dialog"],[role="navigation"],nav,[role="feed"]';
  const edit=all('button,[role="button"],a[href],span[tabindex],div[tabindex],span').find(e=>!e.closest(skip)&&[label(e),e.innerText].some(v=>/^(chỉnh sửa trang cá nhân|edit profile)$/.test(norm(v))));
  if(!edit){diag.uid='Đúng địa chỉ nick nhưng không thấy nút sửa trang: có thể đang đăng nhập nick khác.';return null;}
  return {name:payload.actor.name,url:new URL(payload.actor.url,location.origin).href,byUid:true};
 };
 const isComposerOpener=b=>!b.closest('[role=article],article,[role=dialog]')&&/^(what.s on your mind|(?:.*?ơi,?\s*)?bạn đang nghĩ gì|create (?:a )?post$|tạo bài viết(?: mới)?$)/i.test(label(b));
 const identity=async()=>{
  const diag={};
  if(payload.verifiedSelfUrl&&location.href===payload.verifiedSelfUrl&&location.href===payload.actor?.url&&/^https:\/\/www\.facebook\.com\/profile\.php\?id=\d+$/.test(location.href))return payload.actor;
  const owner=readProfileHeader(false,diag);if(owner)return owner;
  const viaUid=ownerByUid(diag);if(viaUid)return viaUid;
  const regions=all('[role="region"],section').filter(e=>!e.querySelector('article,[role="article"]')&&/create (?:a )?post|tạo bài viết/i.test((e.getAttribute('aria-label')||'')+' '+e.innerText));
  let links=regions.flatMap(e=>all('a[href]',e)).filter(e=>/profile.php\?id=|facebook.com\/[^/?]+\/?$/.test(e.href)&&!e.href.includes('/stories/'));
  if(!links.length){const navs=all('[role="navigation"],nav').filter(e=>/facebook menu|menu facebook/i.test(e.innerText));links=navs.flatMap(e=>all('a[href]',e)).filter(e=>e.href.includes('/profile.php?id=')||/timeline|dòng thời gian/i.test(label(e)));}
  // The layout can omit the named region. Use links next to the composer opener.
  const opener=buttons().find(isComposerOpener);
  if(opener){
   for(let root=opener.parentElement,depth=0;root&&depth<6;root=root.parentElement,depth++){
    if(root.querySelector('[role="article"],article')||root===document.body)break;
    const self=all('a[href]',root).filter(a=>{const u=new URL(a.href);return u.origin===location.origin&&(/timeline|dòng thời gian/i.test(label(a))||(u.pathname==='/profile.php'&&/^\d+$/.test(u.searchParams.get('id')||'')&&a.querySelector('img[alt]')));});
    if(self.length){links=self;break;}
   }
  }
  const mapped=links.map(e=>({url:e.href,name:(label(e)||e.querySelector('img[alt]')?.alt||'').replace(/'s timeline$|,?\s*dòng thời gian.*$/i,'').trim()})).filter(x=>x.name);
  const unique=[...new Map(mapped.map(x=>[profile(x.url),x])).values()];let chosen=unique.length===1?unique[0]:null;
  if(!chosen && payload.jobId && unique.length && unique.length<=30){
   const idx=await aiIndex('actor',unique.map(x=>x.name+' | '+x.url.split('&')[0]));
   chosen=unique[idx];
   if(profile(chosen.url)!==profile(payload.actor.url))throw Error('Tài khoản được nhận diện khác nick của bài.');
  }
  if(!chosen)throw Error('Chưa nhận diện được nick từ khu vực soạn bài Facebook. [trang='+location.pathname.slice(0,40)+'; vùng soạn='+regions.length+'; nút soạn='+(opener?1:0)+'; link nick='+unique.length+'; '+(diag.reason||'')+(diag.uid?' '+diag.uid:'')+']');
  const u=new URL(chosen.url);for(const k of [...u.searchParams.keys()])if(k!=='id')u.searchParams.delete(k);u.hash='';return {name:chosen.name,url:u.href};
 };
 // 3.8.6: nhận diện nick không phụ thuộc giao diện. c_user là UID của phiên đăng nhập hiện tại
 // (chỉ đọc để so với UID đã liên kết, không gửi đi đâu). Nick dạng slug dùng kết quả chuyển
 // hướng /me/ mà runner đã xác minh. Khi hộp soạn mở, Facebook đặt aria-hidden cho trang nền
 // nên cách đọc nút "Chỉnh sửa trang cá nhân" cũ thất bại giữa chừng.
 const sessionUid=()=>{try{return (document.cookie.match(/(?:^|;\s*)c_user=(\d+)/)||[])[1]||'';}catch{return '';}};
 const actorUid=()=>{try{const u=new URL(payload.actor?.url||'',location.origin);return u.searchParams.get('id')||(u.pathname.match(/^\/people\/[^/]+\/(\d+)/)||[])[1]||String(payload.actor?.uid||'');}catch{return '';}};
 const quickActor=()=>{
  const want=actorUid(),me=sessionUid();
  if(want&&me)return want===me?'match':'mismatch';
  const ok=globalThis.__deskActorOk;
  if(ok&&ok.jobId===payload.jobId&&ok.token===payload.token&&(!me||ok.me===me))return 'match';
  if(payload.verifiedSelfUrl&&payload.actor?.url&&profile(payload.verifiedSelfUrl)===profile(payload.actor.url)&&profile(location.href)===profile(payload.actor.url))return 'match';
  return 'unknown';
 };
 const rememberActor=()=>{if(payload.jobId)globalThis.__deskActorOk={jobId:payload.jobId,token:payload.token,me:sessionUid()};};
 const checkActor=async()=>{
  const quick=quickActor();
  if(quick==='mismatch')throw Error('Tài khoản Facebook đang đăng nhập (UID '+sessionUid()+') khác nick đã liên kết.');
  if(quick==='match'){rememberActor();return;}
  const preview=all('[aria-label="Post preview"],[aria-label="Xem trước bài viết"]')[0];
  if(preview&&all('span,div',preview).some(e=>!e.children.length&&norm(e.innerText)===norm(payload.actor.name))){rememberActor();return;}
  const id=await identity();if(profile(id.url)!==profile(payload.actor.url)||norm(id.name)!==norm(payload.actor.name))throw Error('Tài khoản Facebook hiện tại khác tài khoản đã liên kết.');
  rememberActor();
 };
 const cancel=()=>{if(document.documentElement.dataset.facebookDeskJob!==payload.jobId||(payload.token&&document.documentElement.dataset.facebookDeskToken!==payload.token))throw Error('Phiên bot không khớp, đã dừng hoặc trang đã tải lại.');};
 const fail=e=>({ok:false,error:e.message,action,...(['check','commit','upload','upload-check','audience'].includes(action)?{uiDiagnostic:publishDiagnostic()}:{} )});
 try{
  if(/checkpoint|login/.test(location.pathname)||document.querySelector('input[name="pass"]'))throw Error('Facebook yêu cầu đăng nhập hoặc kiểm tra tài khoản.');
  if(action==='edit-existing-text'){
   if(!canonical(location.href)||canonical(location.href)!==canonical(payload.url))throw Error('Sai liên kết bài đã đăng.');
   const roots=all('[role="article"],article,[role="dialog"]').filter(e=>norm(e.innerText).includes(norm(payload.before).slice(0,60))&&all('a[href]',e).some(a=>profile(a.href)===profile(payload.actor.url)&&norm(a.innerText)===norm(payload.actor.name)));
   const menus=[...new Set(roots.flatMap(root=>buttons(root).filter(b=>/actions for this post|hành động đối với bài viết này/i.test(label(b)))))];
   if(menus.length!==1)throw Error('Chưa xác định được menu của bài cũ. Mở bài để chỉnh sửa trực tiếp.');
   botClick(menus[0]);
   const edit=await wait(()=>{const items=all('[role="menuitem"]').filter(e=>/^(edit post|chỉnh sửa bài viết)$/i.test(label(e)));return items.length===1&&items[0]});
   botClick(edit);
   const dialog=await wait(()=>all('[role="dialog"]').find(e=>/edit post|chỉnh sửa bài viết/i.test(e.innerText)&&draftEditors(e).length===1));
   const el=all('[contenteditable="true"][role="textbox"]',dialog)[0];
   if(!matches(el,payload.before))throw Error('Bài trên Facebook đã thay đổi. Kiểm tra trước khi lưu.');
   const range=document.createRange();range.selectNodeContents(el);el.focus();const selection=getSelection();selection.removeAllRanges();selection.addRange(range);document.execCommand('delete');
   await fillText(el,payload.text);
   const save=find([/^(save|lưu)$/i],dialog);if(save.disabled||save.getAttribute('aria-disabled')==='true')throw Error('Chưa thể lưu bài.');botClick(save);
   await wait(()=>!visible(dialog)&&all('[role="article"],article,[role="dialog"]').some(e=>norm(e.innerText).includes(norm(payload.text))));
   return {ok:true};
  }
  if(action==='recover-open'){
   if(!composer() || document.documentElement.dataset.facebookDeskJob!==payload.jobId || editor().innerText.trim())return {ok:false,error:'Không có ô soạn trống của lượt này.'};
   await checkActor();return {ok:true,prior:[...new Set(all('a[href]').map(a=>canonical(a.href)).filter(Boolean))]};
  }
  if(action==='verify-profile'){
   try{return {ok:true,actor:await wait(()=>readProfileHeader(false),8000)};}
   catch{throw Error('Không xác minh được chủ trang. Hãy dùng link trang của bạn có nút Chỉnh sửa trang cá nhân.');}
  }
  if(action==='profile-tab'||action==='own-profile'){
   const trustedRedirect=action==='own-profile';
   if(!trustedRedirect){
    const diag={},actor=readProfileHeader(false,diag);
    if(!actor)throw Error(diag.reason||'Địa chỉ không phải trang cá nhân.');
    return {ok:true,actor};
   }
   try{return {ok:true,actor:await wait(()=>readProfileHeader(true),8000)};}
   catch{throw Error('Facebook chưa hiển thị tên trên trang cá nhân. Mở trang của bạn rồi bấm Liên kết tài khoản.');}
  }
  if(action==='identity')return {ok:true,actor:await identity()};
  if(action==='open'||action==='resume-open'){
   let actor;const quick=quickActor();
   if(quick==='mismatch')throw Error('Sai tài khoản đăng: Facebook đang đăng nhập UID '+sessionUid()+'.');
   if(quick==='match'){actor=payload.actor;rememberActor();}
   const deadline=Date.now()+20000;
   while(!actor){
    try{actor=await identity();}
    catch(error){if(!error.message.startsWith('Chưa nhận diện được nick')||Date.now()>=deadline)throw error;await sleep(500);}
   }if(profile(actor.url)!==profile(payload.actor.url))throw Error('Sai tài khoản đăng.');
   rememberActor();
   if(composer()){
    if(action!=='resume-open'||!matches(editor(),payload.resumeDraftText||''))throw Error('Hộp soạn đã có nội dung khác. Không tự ghi đè; kiểm tra bản nháp trước.');
    const textReady=matches(editor(),payload.text);if(!textReady)await fillText(editor(),'');
    document.documentElement.dataset.facebookDeskJob=payload.jobId;document.documentElement.dataset.facebookDeskToken=payload.token;
    return {ok:true,prior:payload.resumePrior||[],actor,textReady,resumeMedia:globalThis.__deskUploadJob===payload.jobId};
   }
   const prior=[...new Set(all('a[href]').map(a=>canonical(a.href)).filter(Boolean))];
   let opener;
   try{opener=await wait(()=>{const choices=buttons().filter(isComposerOpener);return choices.length===1&&choices[0];},12000);}
   catch{
    const choices=buttons().filter(b=>/what.s on your mind|đang nghĩ gì|^create (a )?post$|^tạo bài viết( mới)?$|^write a post|^viết bài/i.test(label(b))&&!b.closest('[role=article],article,[role=dialog]')).slice(0,20);
    if(!choices.length)throw Error('Chưa thấy nút mở ô soạn.');
    const descriptions=choices.map(b=>label(b).slice(0,300));
    const index=choices.length===1?0:await aiIndex('composer',descriptions);
    opener=choices[index];
    if(!opener?.isConnected||label(opener).slice(0,300)!==descriptions[index])throw Error('Nút mở ô soạn vừa thay đổi.');
   }
   opener.scrollIntoView({block:'center'});botClick(opener);try{await wait(composer,25000);}catch{const dialogs=all('[role="dialog"],dialog');throw Error('Đã bấm mở bài nhưng chưa nhận diện được ô nhập. Hộp thoại hiện: '+dialogs.length+'; số ô nhập theo hộp: '+dialogs.map(d=>draftEditors(d).length).join(','));}if(editor().innerText.trim())throw Error('Facebook phục hồi bản nháp có sẵn. Bot không ghi đè.');
   document.documentElement.dataset.facebookDeskJob=payload.jobId;document.documentElement.dataset.facebookDeskToken=payload.token;await checkActor();return {ok:true,prior,actor};
  }
  if(['text','upload','upload-check','pick','check','commit','audience'].includes(action)){cancel();await checkActor();}
  if(action==='audience')return await ensurePublicAudience();
  if(action==='text'){if(editor().innerText.trim())throw Error('Ô soạn đã có chữ.');await fillText(editor(),payload.text);return {ok:true};}
  if(action==='upload'||action==='upload-check'){
   let before=new Set(globalThis.__deskUploadBaseline||[]);
   if(action==='upload'){
   // 3.8.6: chọn ô tải trong hộp soạn, phát cả input+change; nếu Facebook không nhận trong
   // 10 giây thì thả tệp (drop) vào hộp soạn như kéo-thả. Không ném lỗi khi có nhiều ô tải.
   const root0=composer();if(!root0)throw Error('Không thấy hộp tạo bài khi tải media.');
   const accepts=(input,file)=>!input.accept||input.accept.split(',').some(v=>{v=v.trim().toLowerCase();return v===file.type||v===file.type.split('/')[0]+'/*'||(v.startsWith('.')&&file.name.toLowerCase().endsWith(v));});
   const fileInputs=scope=>[...scope.querySelectorAll('input[type="file"]')].filter(input=>!input.disabled&&(!input.accept||/image|video|\.(?:jpe?g|png|gif|webp|mp4|mov)/i.test(input.accept)));
   const usable=list=>list.filter(input=>(payload.files.length===1||input.multiple)&&payload.files.every(f=>accepts(input,f)));
   let inputs=usable(fileInputs(root0));
   if(!inputs.length){
    const opener=buttons(root0).find(e=>/^(?:photo\/video|ảnh\/video|add photos?(?:\/| or )videos?|thêm ảnh(?:\/| hoặc )video)/i.test(label(e)));
    if(opener){botClick(opener);await wait(()=>usable(fileInputs(composer()||root0)).length,6000).catch(()=>{});}
    inputs=usable(fileInputs(composer()||root0));if(!inputs.length)inputs=usable(fileInputs(document));
   }
   const kinds=[...new Set(payload.files.map(f=>f.type.split('/')[0]))];
   inputs.sort((a,b)=>Number(b.multiple)-Number(a.multiple)||Number(kinds.length===1&&(kinds[0]==='image'?!/video/i.test(b.accept):!/image/i.test(b.accept)))-Number(kinds.length===1&&(kinds[0]==='image'?!/video/i.test(a.accept):!/image/i.test(a.accept))));
   before=new Set(all('img,video',composer()).map(e=>e.currentSrc||e.src).filter(Boolean));globalThis.__deskUploadBaseline=[...before];globalThis.__deskUploadJob=payload.jobId;
   const files=[];for(const f of payload.files){if(f.transferId){const record=globalThis.__deskStagedFiles?.get(f.transferId);if(!record||record.next!==f.chunks||record.size!==f.size)throw Error('Chưa chuyển đủ tệp '+f.name);files.push(new File(record.parts,f.name,{type:f.type}));}else files.push(new File([Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0))],f.name,{type:f.type}));}
   const transfer=()=>{const dt=new DataTransfer();for(const file of files)dt.items.add(file);return dt;};
   const started=()=>{const s=mediaState(payload.files.map(f=>f.type.split('/')[0]));return s.total>0||/uploading|đang tải lên|processing video|đang xử lý video/i.test(composer()?.innerText||'')||all('[role="progressbar"]',composer()||document).length>0;};
   if(inputs.length){const input=inputs[0];input.files=transfer().files;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}
   const firstWait=payload.files.some(f=>f.type.startsWith('video/'))?25000:12000;
   let took=await wait(started,firstWait).then(()=>true,()=>false);
   if(!took){
    const target=(()=>{try{return editor();}catch{return composer()||root0;}})();
    const dt=transfer();for(const type of ['dragenter','dragover','drop'])target.dispatchEvent(new DragEvent(type,{bubbles:true,cancelable:true,dataTransfer:dt}));
    took=await wait(started,10000).then(()=>true,()=>false);
   }
   if(!took)throw Error('Facebook không nhận tệp media (đã thử ô tải '+inputs.length+' và kéo-thả). Bot chưa đăng.');
   for(const f of payload.files)if(f.transferId)globalThis.__deskStagedFiles?.delete(f.transferId);
   }
   // Confirm stable attachment previews. The check and commit steps validate the publish UI.
   let stable=0,last='',diagnostic='';const start=Date.now();while(Date.now()-start<(payload.files.some(f=>f.type.startsWith('video/'))?900000:120000)){await sleep(1000);cancel();const root=composer();if(!root)throw Error('Hộp soạn bị đóng khi tải media.');
    if(all('[role="alert"]',root).some(e=>/failed|error|không thể|lỗi/i.test(e.innerText)))throw Error('Facebook báo lỗi tải media.');
    const expected=payload.files.map(f=>f.type.split('/')[0]),snapshot=mediaState(expected);
    stable=snapshot.ready&&snapshot.signature===last?stable+1:0;last=snapshot.signature;diagnostic=snapshot.reason;
    if(snapshot.ready&&stable>=2){
     const proof={id:crypto.randomUUID(),jobId:payload.jobId,token:payload.token,expected,count:snapshot.count};globalThis.__deskMediaProof=proof;
     document.documentElement.dataset.facebookDeskMedia=JSON.stringify({jobId:payload.jobId,count:snapshot.count});return {ok:true,count:snapshot.count,proofId:proof.id};
    }
   }throw Error('Chưa xác minh đủ media tải xong ['+diagnostic+']. Bot chưa đăng; kiểm tra tab Facebook.');
  }
  if(action==='pick'){
   const type=payload.field;const patterns=type==='location'?[/^(location|check in|địa điểm|check-in)$/i]:type==='feeling'?[/^(feeling\/activity|cảm xúc\/hoạt động|cảm xúc)$/i]:[/^(people|tag people|tag friends|gắn thẻ người khác|gắn thẻ bạn bè|với ai)$/i];
   let query=payload.value;const english=(document.documentElement.lang||'').startsWith('en');
   if(english&&type==='feeling'){const aliases={'vui vẻ':'happy','hạnh phúc':'happy','biết ơn':'thankful','hào hứng':'excited','buồn':'sad','tự hào':'proud','thư giãn':'relaxed','mệt mỏi':'tired','may mắn':'lucky','bình yên':'peaceful'};query=aliases[norm(query)]||query;}
   if(english&&type==='location')query=query.replace(/Hàn Quốc/gi,'South Korea').replace(/Nhật Bản/gi,'Japan').replace(/Việt Nam/gi,'Vietnam');
   if(type==='location'&&payload.repair==='city')query=query.split(',')[0].trim();
   if(type==='location'&&payload.repair==='translated')query=query.replace(/Hàn Quốc/gi,'South Korea').replace(/Nhật Bản/gi,'Japan').replace(/Việt Nam/gi,'Vietnam');
   let personUrl='';if(type==='people'&&query.includes('|')){const parts=query.split('|').map(x=>x.trim());query=parts[0];personUrl=parts[1]||'';}
   botClick(find(patterns,composer()));const searches=()=>all('input,[contenteditable="true"]',document).filter(e=>/search feelings|search for friends|where are you|tìm.*cảm xúc|tìm.*bạn|bạn đang ở đâu|tìm kiếm địa điểm/i.test(label(e)+' '+(e.getAttribute('placeholder')||'')));
   const field=await wait(()=>searches().length===1&&searches()[0]);inputValue(field,query);await sleep(1200);
   const options=()=>all('[role="option"]');await wait(()=>options().length);
   const values=options().map(e=>({label:label(e),name:(e.innerText||'').split('\n')[0].trim(),id:e.id||'',url:e.querySelector('a[href]')?.href||''}));
   const wanted=norm(query);let matches=options().filter(e=>norm((e.innerText||'').split('\n')[0])===wanted||norm(label(e).replace(/^(Tag|Gắn thẻ)\s+/i,'').split(', Profile')[0])===wanted);
   if(personUrl)matches=matches.filter(e=>all('a[href]',e).some(a=>profile(a.href)===profile(personUrl))||e.id===new URL(personUrl).searchParams.get('id'));
   if(payload.choiceId)matches=options().filter(e=>e.id===payload.choiceId);
   if(type==='location'&&(matches.length!==1||payload.repair==='city')){
    const nodes=options().slice(0,30);
    const describe=e=>[label(e),e.innerText].filter(Boolean).join(' | ').slice(0,400);
    const descriptions=nodes.map(describe);
    let selected;
    try{selected=nodes[await aiIndex('location',descriptions)];}
    catch(err){
     // Equivalent localized city labels are also usable if Gemini is unavailable.
     const compact=s=>norm(s).replace(/[,\s]+/g,'');
     selected=nodes.find(e=>compact((e.innerText||label(e)).split('\n')[0])===compact(payload.repair==='city'?payload.value:query));
     if(!selected)throw err;
    }
    if(!options().includes(selected)||describe(selected)!==descriptions[nodes.indexOf(selected)])throw Error('Facebook vừa đổi danh sách địa điểm. Thử lại bài này.');
    matches=[selected];
   }
   if(matches.length!==1)return {ok:false,needsChoice:true,error:'Không tìm thấy một lựa chọn duy nhất cho '+payload.value,options:values,field:type};
   const chosen=matches[0],chosenLabel=(chosen.innerText||label(chosen)).split('\n')[0].trim();botClick(chosen);await sleep(400);
   if(type==='people'){const done=buttons().filter(e=>/^(done|xong)$/i.test(label(e)));if(done.length===1)botClick(done[0]);}
   await wait(()=>!all('input').some(e=>visible(e)&&e===field));
   // Must see selected value outside the result list/search input.
   const root=composer();if(!root||!norm(root.innerText).includes(norm(chosenLabel))){const previews=all('[aria-label="Post preview"],[aria-label="Xem trước bài viết"]');if(!previews.some(e=>norm(e.innerText).includes(norm(chosenLabel))))throw Error('Chưa xác nhận Facebook áp dụng '+chosenLabel);}
   return {ok:true,selected:chosenLabel,id:chosen.id||'',field:type};
  }
  if(action==='check'){
   assertMedia();checkAudiencePolicy();
   if(!captionMatches())throw Error('Nội dung thay đổi trước khi đăng.');
   await advancePublish();checkAudiencePolicy();await waitPublish();
   const root=composer();for(const entry of payload.applied||[])if(!norm(root.innerText).includes(norm(entry.selected)))throw Error('Thông số bị mất trước khi đăng: '+entry.selected);
   return {ok:true,uiDiagnostic:publishDiagnostic()};
  }
  if(action==='commit'){
   assertMedia();checkAudiencePolicy();
   if(!captionMatches())throw Error('Nội dung đã thay đổi; dừng trước khi đăng.');
   let root=composer();for(const entry of payload.applied||[])if(!norm(root.innerText).includes(norm(entry.selected)))throw Error('Thông số chưa được áp dụng: '+entry.selected);
   let b=await waitPublish();
   if(globalThis.__deskSubmitAttempt?.jobId===payload.jobId&&globalThis.__deskSubmitAttempt.token===payload.token)throw Error('Lượt này đã gửi thao tác bấm Đăng; không bấm lần hai.');
   let permission;
   do{
    cancel();const restriction=globalThis.deskRestriction?.();if(restriction)throw Error(restriction);
    if(!captionMatches())throw Error('Ô soạn đã thay đổi trong thời gian chờ.');assertMedia();root=composer();
    b=await waitPublish();
    await checkActor();
    const mediaProof=assertMedia(),audienceProof=checkAudiencePolicy();permission=await chrome.runtime.sendMessage({type:'bot-permit',jobId:payload.jobId,token:payload.token,mediaProof,audienceProof});if(permission?.data?.waitMs){let left=Math.min(10000,permission.data.waitMs);while(left>0){const part=Math.min(250,left);await sleep(part);left-=part;cancel();}}
   }while(permission?.data?.waitMs);
   if(!permission?.ok)throw Error(permission?.error||'Bot đã dừng hoặc lượt đăng đã được sử dụng.');
   const noticeLinks=()=>Array.from(document.querySelectorAll('[role="alert"] a[href],[role="status"] a[href],[aria-live="polite"] a[href],[aria-live="assertive"] a[href]'))
    .filter(a=>!a.closest('article,[role="article"]')&&/^(view|view post|see post|view your post|xem|xem bài viết|xem bài viết của bạn)$/i.test(label(a)))
    .map(a=>canonical(a.href)).filter(url=>url.startsWith('https://')&&!url.includes('/photo.php?'));
   const before=new Set(noticeLinks());
   const receipt={jobId:payload.jobId,links:new Set()};
   const collect=()=>{
    const previous=receipt.links.size;
    for(const link of noticeLinks())if(!before.has(link))receipt.links.add(link);
    if(receipt.links.size!==previous)void chrome.runtime.sendMessage({type:'bot-receipt',jobId:payload.jobId,token:payload.token,links:[...receipt.links]}).catch(()=>{});
   };
   const observer=new MutationObserver(collect);
   observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','role','aria-label']});
   globalThis.__deskPostReceipt=receipt;
   setTimeout(()=>observer.disconnect(),20000);
   try{cancel();assertMedia();checkAudiencePolicy();root=composer();const snapshot=publishSnapshot(root);b=snapshot.button;if(!b||!root.contains(b)||!visible(b)||!b.isConnected||disabled(b)||!captionMatches())throw Error('Dừng an toàn: nút Đăng hoặc hộp soạn đã thay đổi.');for(const entry of payload.applied||[])if(!norm(root.innerText).includes(norm(entry.selected)))throw Error('Dừng an toàn: thông số biến mất trước khi bấm Đăng: '+entry.selected);}
   catch(error){observer.disconnect();await chrome.runtime.sendMessage({type:'bot-abort-before-click',jobId:payload.jobId,token:payload.token,reason:error.message}).catch(()=>{});throw error;}
   const publicProof=checkAudiencePolicy();globalThis.__deskSubmitAttempt={jobId:payload.jobId,token:payload.token,at:Date.now()};
   b.scrollIntoView({block:'center',inline:'nearest'});botClick(b);collect();void chrome.runtime.sendMessage({type:'bot-clicked',jobId:payload.jobId,token:payload.token}).catch(()=>{});return {ok:true,clicked:true,audienceProof:publicProof,uiDiagnostic:publishDiagnostic()};
  }
  if(action==='verify'){
   const wanted=norm(payload.text);
   const prior=new Set(payload.prior||[]),clicked=new WeakSet();
   const start=Date.now();while(Date.now()-start<12000){
    const receipt=globalThis.__deskPostReceipt;
    if(receipt?.jobId===payload.jobId){
     const actorId=new URL(payload.actor.url).searchParams.get('id');
     const fresh=[...receipt.links].filter(url=>{
      const owner=new URL(url).searchParams.get('id');
      return !prior.has(url)&&(!owner||!actorId||owner===actorId);
     });
     if(fresh.length===1)return {ok:true,url:fresh[0],textMatch:true,authorMatch:true,source:'Thông báo Xem bài viết'};
    }
    if(wanted.replace(/[\s\ufe0e\ufe0f]/gu,'').length<12){await sleep(200);continue;}
    // Facebook can materialize timestamp hrefs on hover. Expand only a matching author's post.
    const roots=new Set(all('[role="article"],article'));for(const heading of all('h2,h3,h4,[role="heading"]')){let p=heading.parentElement;for(;p&&p!==document.body;p=p.parentElement){if(buttons(p).filter(e=>/actions for this post|hành động.*bài viết/i.test(label(e))).length>1)break;if(norm(p.innerText).includes(wanted.slice(0,80))&&buttons(p).some(e=>/actions for this post|hành động.*bài viết/i.test(label(e)))){roots.add(p);break;}}}
    for(const root of roots){if(!norm(root.innerText).includes(wanted.slice(0,80)))continue;const author=all('a[href]',root).find(a=>norm(a.innerText)&&/\/profile.php|facebook.com\/[^/?]+\/?(?:\?|$)/.test(a.href));if(!author||profile(author.href)!==profile(payload.actor.url)||norm(author.innerText)!==norm(payload.actor.name))continue;
     if(!norm(root.innerText).includes(wanted)){const more=buttons(root).find(e=>/^(see more|xem thêm)$/i.test(label(e)));if(more)botClick(more);}
     for(const a of all('a[href]',root)){
      if(a.hash.startsWith('#?')&&norm(root.innerText).includes(wanted)&&!clicked.has(a)&&
        !a.closest('p,[data-ad-preview="message"]')&&
        (author.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING)&&
        all('a[href]',root).filter(link=>link.hash.startsWith('#?')).length===1){
       clicked.add(a);a.target='_self';botClick(a);
      }
      if(a.hash.startsWith('#?')||a.href.includes('story_fbid=')){
       a.dispatchEvent(new PointerEvent('pointerover',{bubbles:true,pointerType:'mouse'}));
       a.focus({preventScroll:true});
      }
      a.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));a.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));}
    }
    const candidates=[];for(const a of all('a[href]')){const url=canonical(a.href);if(!url||prior.has(url))continue;let root=a.closest('[role="article"],article');if(!root){let parent=a.parentElement;for(;parent&&parent!==document.body;parent=parent.parentElement){if(buttons(parent).filter(e=>/actions for this post|hành động.*bài viết/i.test(label(e))).length>1)break;const txt=norm(parent.innerText);if(txt.includes(wanted)&&buttons(parent).some(e=>/actions for this post|hành động.*bài viết|chỉnh sửa/i.test(label(e)))){root=parent;break;}}}
     if(!root||!norm(root.innerText).includes(wanted))continue;
     const authorLinks=all('a[href]',root).filter(l=>norm(l.innerText)&&(/\/profile.php|facebook.com\/[^/?]+\/?(?:\?|$)/.test(l.href)));const firstAuthor=authorLinks[0];const author=firstAuthor&&profile(firstAuthor.href)===profile(payload.actor.url)&&norm(firstAuthor.innerText)===norm(payload.actor.name);if(!author)continue;
     const header=firstAuthor.closest('h2,h3,h4,[role="heading"]');
     if(!header||!(header.compareDocumentPosition(a)&Node.DOCUMENT_POSITION_FOLLOWING)||a.closest('p,[data-ad-preview="message"],[data-ad-rendering-role="story_message"]'))continue;
     const menu=buttons(root).find(b=>/actions for this post|hành động.*bài viết|tùy chọn.*bài viết/i.test(label(b)));
     const inHeader=menu&&(a.compareDocumentPosition(menu)&Node.DOCUMENT_POSITION_FOLLOWING);
     if(!inHeader&&!a.querySelector('time,abbr')&&!/just now|vừa xong|vừa đăng|phút|giờ|ago/i.test(label(a)))continue;
     candidates.push({url,textMatch:true,authorMatch:true,source:'Thời gian dưới tên nick'});
    }
    let unique=[...new Map(candidates.map(x=>[x.url,x])).values()];const postLinks=unique.filter(x=>/\/posts\/|story_fbid=/.test(x.url));unique=postLinks.length?postLinks:unique.filter(x=>/\/(videos|reel)\//.test(x.url));if(unique.length===1)return {ok:true,...unique[0]};if(unique.length>1)throw Error('Có nhiều link phù hợp. Không tự chọn link chưa chắc chắn.');await sleep(200);
   }return {ok:false,error:'Đã bấm Đăng nhưng chưa tìm được permalink khớp tác giả và nội dung. Không tự đăng lại.',uncertain:true};
  }
  if(action==='backdate'){
   if(!payload.url||canonical(location.href)!==canonical(payload.url))throw Error('Chưa mở đúng bài để đổi ngày.');
   const wanted=norm(payload.text),articles=all('[role="article"],article');let root=articles.find(e=>norm(e.innerText).includes(wanted));if(!root)root=document.querySelector('[role="main"]')||document.body;
   if(!norm(root.innerText).includes(wanted))throw Error('Bài đang mở không khớp nội dung.');
   const menu=buttons(root).filter(e=>/actions for this post|hành động.*bài viết|tùy chọn.*bài viết/i.test(label(e)));if(menu.length!==1)throw Error('Không tìm thấy menu của đúng bài để đổi ngày.');botClick(menu[0]);
   const edit=await wait(()=>all('[role="menuitem"]').find(e=>/^(edit date|change date|chỉnh sửa ngày|thay đổi ngày)$/i.test(label(e))));botClick(edit);
   const dialog=await wait(()=>all('[role="dialog"]').find(e=>/edit date|change date|chỉnh sửa ngày|thay đổi ngày/i.test(e.innerText)));const d=new Date(payload.requestedTime);const values={year:d.getFullYear(),month:d.getMonth()+1,day:d.getDate(),hour:d.getHours(),minute:d.getMinutes()};
   const fields=all('input,select,[role="combobox"]',dialog);let changed=0;
   for(const [part,patterns] of Object.entries({year:/year|năm/i,month:/month|tháng/i,day:/^day$|^ngày$/i,hour:/hour|giờ/i,minute:/minute|phút/i})){
    const field=fields.find(e=>patterns.test(label(e)));if(!field)continue;const value=String(values[part]);
    if(field.tagName==='SELECT'){const opt=[...field.options].find(o=>o.value===value||o.textContent.trim()===value||((part==='month')&&new RegExp('^'+value+'\\b').test(o.textContent)));if(!opt)throw Error('Không tìm thấy giá trị '+part);field.value=opt.value;field.dispatchEvent(new Event('change',{bubbles:true}));}
    else if(field.tagName==='INPUT')inputValue(field,value);
    else{botClick(field);const option=await wait(()=>all('[role="option"]').find(e=>norm(label(e))===norm(value)));botClick(option);}changed++;
   }
   if(changed<3)throw Error('Facebook không cung cấp đủ trường ngày/tháng/năm. Bài đã đăng, chưa đổi ngày.');
   if((values.hour||values.minute)&&changed<5)throw Error('Facebook chỉ hỗ trợ ngày, không đủ trường giờ/phút theo kịch bản. Chưa lưu thay đổi.');
   botClick(find([/^(save|lưu)$/i],dialog));await wait(()=>!visible(dialog));
   // Confirmation needs a machine-readable timestamp matching the requested instant/day.
   const times=[...all('time[datetime]',root).map(e=>new Date(e.dateTime)),...all('[data-utime]',root).map(e=>new Date(Number(e.getAttribute('data-utime'))*1000)),...all('a[aria-label],a[title]',root).map(e=>new Date(e.getAttribute('aria-label')||e.getAttribute('title')))];const match=times.some(t=>Math.abs(t.getTime()-d.getTime())<60000);if(!match)return {ok:false,error:'Đã lưu đổi ngày nhưng chưa xác minh timestamp chính xác. Kiểm tra bài theo link.',partial:true};return {ok:true,dateVerified:true};
  }
  throw Error('Thao tác bot không hợp lệ.');
 }catch(e){return fail(e);}
}
