import {stageMediaChunk,POST_LIMIT_MB} from './media-transfer.js';
import {taskSlot} from './run-control.js';
import {fillMissingContent,cleanCaption} from './scenario.js';
import {openWorkTab,closeWorkTab} from './work-tabs.js';
import {inspectPost,findPublished} from './published-link.js';
import {canonicalPost,captionIssue,mediaOnlyPost,normalizedProfile} from './automation-model.js';
import {facebookBot} from './facebook-bot.js';
import {waitFacebookTab} from './tab-ready.js';
import {STORY_CREATE_URL} from './story-model.js';
import {truncatedPrefix,acceptRecovered,isVideoSource,readFullCaption} from './full-caption.js';
const status=document.getElementById('status');const sleep=ms=>new Promise(r=>setTimeout(r,ms));let running=false;
// 3.8.7-cap: thứ tự thử: Media Bridge (Reel/video) → mở bài gốc bằng phiên đăng nhập → đăng đoạn đã có, bỏ "…".
async function recoverFullCaption(j){
 const prefix=truncatedPrefix(j.post.sourceCaption||j.post.text);
 const video=(j.post.media||[]).find(m=>m.type==='video'&&m.manifest?.sourceUrl)?.manifest?.sourceUrl;
 const source=j.post.sourcePostUrl||'';
 for(const url of [video,isVideoSource(source)?source:''].filter(Boolean)){
  try{const r=await fetch('http://127.0.0.1:47833/probe',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:'desk.media/1',kind:/\/reels?\//.test(url)?'reel':'video',sourceUrl:url}),signal:AbortSignal.timeout(90000)});
   if(r.ok){const info=await r.json();if(info?.captionKnown&&acceptRecovered(prefix,info.caption))return {text:String(info.caption).trim(),method:'media-bridge'};}}catch{}
 }
 if(/^https:\/\/(?:www\.)?facebook\.com\//.test(source)){
  let tab;
  try{
   tab=await openWorkTab({url:source,active:true},j.id,true);await loaded(tab.id);
   for(let attempt=0;attempt<12;attempt++){
    const [read]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:readFullCaption,args:[{prefix,expand:attempt<6}]}).catch(()=>[{}]);
    const got=read?.result||{};
    if(got.found&&acceptRecovered(prefix,got.text))return {text:got.text,method:'source-page'};
    await sleep(got.expanding?1200:800);
   }
  }catch{}finally{if(tab)await closeWorkTab(tab.id).catch(()=>{});}
 }
 return {text:prefix,method:'trimmed'};
}
// 3.8.6: service worker MV3 có thể khởi động lại giữa lượt; thử lại các lệnh an toàn thay vì đánh lỗi cả bài.
const RETRYABLE=['runner-caption','runner-full-caption','runner-touch','runner-progress','runner-media','runner-media-chunk','runner-media-release','runner-finish','posting-clean-children'];
async function rpc(type,values={}){for(let attempt=0;;attempt++){let r;try{r=await chrome.runtime.sendMessage({type,...values});}catch(error){r={ok:false,error:error.message,transport:true};}if(!r)r={ok:false,error:'Bộ điều khiển chưa phản hồi.',transport:true};if(r.ok)return r.data;const transport=r.transport||/message channel closed|Could not establish connection|Receiving end does not exist|Extension context/i.test(r.error||'');if(transport&&RETRYABLE.includes(type)&&attempt<3){await sleep(1500*(attempt+1));continue;}throw Error(r.error||'Mất kết nối bộ điều khiển.');}}
async function loaded(tabId){return waitFacebookTab(tabId,id=>chrome.tabs.get(id),sleep);}
async function execute(j){

 let files=[];let tabId,verifiedSelfUrl='',submitted=false,url='',proof={},stage='Khởi tạo',completed=false;const auth={jobId:j.id,token:j.token};let alive=true;
 const timer=setInterval(()=>rpc('runner-touch',auth).then(()=>{alive=true;}).catch(()=>{alive=false;}),20000);
 const checkpoint=async(nextStage,extra={})=>{stage=nextStage;if(!alive)throw Error('Mất quyền điều khiển lượt chạy.');const state=await rpc('runner-progress',{...auth,stage,...extra});submitted=state.submitted;if(!state.enabled&&!submitted)throw Error('Bot đã dừng trước khi đăng.');status.textContent=j.post.title+'\n'+stage;};
 // 3.8.6.3: log thật cho thấy lỗi tải media / 0 ảnh / nút khóa thường kèm "tab hidden" (cửa sổ bị
 // che hoặc thu nhỏ, Chrome ngừng vẽ trang). Trước các bước quan trọng, đưa cửa sổ của tab lên.
 const ensureVisible=async()=>{try{const [read]=await chrome.scripting.executeScript({target:{tabId},func:()=>document.visibilityState});if(read?.result==='visible')return;const t=await chrome.tabs.get(tabId);await chrome.tabs.update(tabId,{active:true});const w=await chrome.windows.get(t.windowId);if(w.state==='minimized')await chrome.windows.update(w.id,{state:'normal'});await chrome.windows.update(w.id,{focused:true});await sleep(1500);}catch{}};
 const action=async(name,extra={})=>{if(['open','resume-open','upload','upload-check','check','commit','story-open','story-upload','story-check','story-commit'].includes(name))await ensureVisible();const r=(await chrome.scripting.executeScript({target:{tabId},func:facebookBot,args:[name,{...auth,actor:j.actor,verifiedSelfUrl,text:j.post.text,audience:'default',expectedMedia:j.expectedMedia||j.post.media.map(m=>m.type),...extra}]}))[0]?.result;if(!r?.ok){const e=Error(r?.error||'Facebook không phản hồi.');e.options=r?.options;e.action=name;e.uiDiagnostic=r?.uiDiagnostic;throw e;}return r;};
 try{
  // 3.8.7-story: lượt ĐĂNG STORY (vùng riêng). Dùng chung giãn cách bấm, kiểm tra nick và ghi submittedAt trước khi bấm.
  if(j.kind==='story'){
   const kind=j.post.storyKind;const sx=(name,extra={})=>action(name,{storyKind:kind,...extra});
   if(kind!=='text'&&j.post.media.length!==1)throw Error('Mỗi tin cần đúng 1 ảnh hoặc 1 video.');
   if(kind==='text'&&!String(j.post.text||'').trim())throw Error('Tin chữ trống.');
   await checkpoint('Tải tệp cho tin');files=[];for(let i=0;i<j.post.media.length;i++){const f=await rpc('runner-media',{...auth,index:i});files.push(f);}
   await checkpoint('Mở trang tạo tin');const tab=await openWorkTab({url:STORY_CREATE_URL,active:true},j.id,true);tabId=tab.id;
   try{await chrome.tabs.update(tabId,{active:true});const w=await chrome.windows.get(tab.windowId);if(w.state==='minimized')await chrome.windows.update(w.id,{state:'normal'});}catch{}
   await checkpoint('Chờ Facebook');await loaded(tabId);await checkpoint('Facebook đã tải xong',{facebookTabId:tabId});
   await checkpoint('Mở trình tạo tin');await sx('story-open');
   if(kind==='text'){await checkpoint('Điền chữ cho tin');await sx('story-text');}
   else{
    for(const file of files.filter(f=>f.transferId)){for(let index=0;index<file.chunks;index++){if(index%8===0)await checkpoint('Chuyển tệp '+Math.round(index/file.chunks*100)+'%');const part=await rpc('runner-media-chunk',{...auth,transferId:file.transferId,index});const staged=(await chrome.scripting.executeScript({target:{tabId},func:stageMediaChunk,args:[{...auth,file,index,base64:part.base64}]}))[0]?.result;if(!staged?.ok)throw Error(staged?.error||'Không chuyển được tệp.');}}
    await checkpoint('Tải tệp lên trang tạo tin');const up=await sx('story-upload',{files});await rpc('runner-media-release',auth);await checkpoint('Tệp đã sẵn sàng',{evidence:{type:'media',count:up.count,proofId:up.proofId}});
   }
   await checkpoint('Kiểm tra trước khi chia sẻ');const ready=await sx('story-check');await checkpoint('Chuẩn bị bấm Chia sẻ lên tin',{evidence:{type:'publish-ui',...ready.uiDiagnostic}});
   if(j.dryRun){await checkpoint('Chạy thử: chụp cấu trúc trang tạo tin');const shot=await sx('story-snapshot');await checkpoint('Chạy thử: bỏ bản nháp tin');await sx('story-discard');await rpc('runner-finish',{...auth,result:{state:'cancelled',dryRun:true,url:'',uiSnapshot:shot.snapshot,message:'Chạy thử Story xong: đã mở trang tạo tin, '+(kind==='text'?'điền chữ':'tải tệp')+', nút "Chia sẻ lên tin" bấm được. Không bấm Chia sẻ, đã bỏ bản nháp. Có cấu trúc giao diện để tải về.'}});completed=true;status.textContent='Chạy thử Story xong: '+j.post.title;return;}
   await sx('story-commit');submitted=true;
   await checkpoint('Chờ Facebook đăng tin');let done;
   try{done=await sx('story-published',{timeoutMs:files.some(f=>String(f.type||'').startsWith('video/'))?600000:180000});}
   catch(error){
    // Facebook có thể chuyển trang hẳn sau khi chia sẻ (mất script trong trang). Đã rời trang tạo tin = đã nhận tin.
    const here=await chrome.tabs.get(tabId).catch(()=>null);
    if(here?.url&&!/\/stories\/create/.test(here.url)&&!/Facebook báo lỗi/.test(error.message))done={published:true};else throw error;
   }
   if(!done?.published)throw Error('Đã bấm "Chia sẻ lên tin" nhưng Facebook chưa rời trang tạo tin sau '+Math.round((done?.waitedMs||0)/60000)+' phút. Kiểm tra tin trên Facebook; không tự đăng lại.');
   await rpc('runner-finish',{...auth,result:{state:'success',url:'',published:true,source:'Facebook rời trang tạo tin sau khi bấm Chia sẻ lên tin',message:'Đã đăng Story: Facebook đã nhận tin.'}});completed=true;status.textContent='Đã đăng Story: '+j.post.title;return;
  }
 if(!mediaOnlyPost(j.post)){fillMissingContent(j.post);cleanCaption(j.post);fillMissingContent(j.post);}
  if(j.post.captionSuspect){await checkpoint('Đọc lại caption video');j.post=await rpc('runner-caption',auth);}
  // 3.8.7-cap: caption rút gọn ("…") thì lấy caption đầy đủ từ bài gốc trước khi đăng, thay vì chặn bài.
  if(j.post.captionPartial&&!/nghi-tra-loi-binh-luan/.test(j.post.captionEvidence||'')&&!mediaOnlyPost(j.post)){await checkpoint('Lấy caption đầy đủ từ bài gốc');const full=await recoverFullCaption(j);j.post=await rpc('runner-full-caption',{...auth,text:full.text,method:full.method});}
  if((j.expectedMedia&&JSON.stringify(j.expectedMedia)!==JSON.stringify(j.post.media.map(m=>m.type)))||(j.post.original?.media?.length||0)>j.post.media.length)throw Error('Media nguồn không khớp hàng chờ. Dừng trước khi mở Facebook.');
  const issue=captionIssue(j.post);if(issue)throw Error(issue);
  if(j.post.missingVideo)throw Error('Nguồn thiếu tệp video/Reels. Cập nhật link tệp trong Docs rồi tạo lượt mới.');
  await checkpoint('Tải media');files=[];let size=0;for(let i=0;i<j.post.media.length;i++){await checkpoint('Tải tệp '+(i+1));const f=await rpc('runner-media',{...auth,index:i});size+=f.size;if(size>POST_LIMIT_MB*1024*1024)throw Error('Tổng media vượt '+POST_LIMIT_MB+' MB. Bot chưa mở bài đăng.');files.push(f);}
  await checkpoint('Mở Facebook');const home=/^https:\/\/www\.facebook\.com\/?(?:[?#].*)?$/i.test(j.target||'');let tab;
  if(Number.isInteger(j.resumeFacebookTabId))tab=await chrome.tabs.get(j.resumeFacebookTabId).catch(()=>null);
  const resuming=Boolean(tab);const ownTarget=!resuming&&(home||j.target===j.actor.url);if(!tab)tab=await openWorkTab({url:ownTarget?'https://www.facebook.com/me/':j.target,active:true},j.id,true);tabId=tab.id;
  // 3.8.6: tab Facebook phải là tab đang hiện trong cửa sổ; chạy nền thì Chrome dừng dựng giao diện/animation.
  try{await chrome.tabs.update(tabId,{active:true});const w=await chrome.windows.get(tab.windowId);if(w.state==='minimized')await chrome.windows.update(w.id,{state:'normal'});}catch{}await checkpoint('Chờ Facebook');const settled=await loaded(tabId);try{if(ownTarget&&normalizedProfile(settled.url)===normalizedProfile(j.actor.url))verifiedSelfUrl=settled.url;}catch{}await checkpoint('Facebook đã tải xong',{facebookTabId:tabId});
  await checkpoint('Mở ô soạn bài');const opened=await action(resuming?'resume-open':'open',{resumeDraftText:j.resumeDraftText,resumePrior:j.prior});
  await checkpoint('Điền nội dung',{prior:opened.prior});if(j.post.text?.trim()&&!opened.textReady)await action('text');
  if(files.length){
   if(!opened.resumeMedia)for(const file of files.filter(f=>f.transferId)){for(let index=0;index<file.chunks;index++){if(index%8===0)await checkpoint('Chuyển media '+Math.round(index/file.chunks*100)+'%');const part=await rpc('runner-media-chunk',{...auth,transferId:file.transferId,index});const staged=(await chrome.scripting.executeScript({target:{tabId},func:stageMediaChunk,args:[{...auth,file,index,base64:part.base64}]}))[0]?.result;if(!staged?.ok)throw Error(staged?.error||'Không chuyển được phần media.');}}
   await checkpoint('Tải ảnh/video lên Facebook');const uploaded=await action(opened.resumeMedia?'upload-check':'upload',{files});await rpc('runner-media-release',auth);await checkpoint('Media đã sẵn sàng',{evidence:{type:'media',count:uploaded.count,proofId:uploaded.proofId}});}
  const applied=[];
  if(j.post.location){await checkpoint('Chọn địa điểm');const result=await action('pick',{field:'location',value:j.post.location});applied.push(result);await checkpoint('Đã chọn địa điểm',{evidence:result});}
  if(j.post.feeling){await checkpoint('Chọn cảm xúc');const result=await action('pick',{field:'feeling',value:j.post.feeling});applied.push(result);await checkpoint('Đã chọn cảm xúc',{evidence:result});}
  for(const person of j.tags){await checkpoint('Gắn thẻ '+person);const result=await action('pick',{field:'people',value:person});applied.push(result);await checkpoint('Đã gắn thẻ',{evidence:result});}
  await checkpoint('Kiểm tra trước khi đăng');const ready=await action('check',{applied});await checkpoint('Chuẩn bị bấm Đăng',{evidence:{type:'publish-ui',...ready.uiDiagnostic}});
  // 3.8.7: chạy thử dừng tại đây, KHÔNG bấm Đăng: chụp cấu trúc giao diện rồi bỏ bản nháp.
  if(j.dryRun){await checkpoint('Chạy thử: chụp cấu trúc giao diện');const shot=await action('snapshot');await checkpoint('Chạy thử: bỏ bản nháp');await action('discard');await rpc('runner-finish',{...auth,result:{state:'cancelled',dryRun:true,url:'',uiSnapshot:shot.snapshot,message:'Chạy thử xong: đã mở ô soạn, điền nội dung, tải '+files.length+' media, Facebook cho phép bấm Đăng. Không bấm Đăng, đã bỏ bản nháp. Có cấu trúc giao diện để tải về.'}});completed=true;status.textContent='Chạy thử xong: '+j.post.title;return;}
await action('commit',{applied});proof.audienceMode='default';submitted=true;
  // 3.8.7: chờ Facebook đóng hộp soạn (đã nhận bài) TRƯỚC khi đọc link hoặc chuyển trang. Album/video cần
  // thêm thời gian gửi sau khi bấm Đăng; chuyển tab sớm làm bài không lên.
  await checkpoint('Chờ Facebook đăng xong');const hasVideo=files.some(f=>String(f.type||'').startsWith('video/'));
  const done=await action('published',{timeoutMs:hasVideo?600000:180000});proof.published=done.published===true;
  await checkpoint('Tìm permalink và xác minh');let verification;
  try{verification=await action('verify',{prior:opened.prior});}catch{
   if(!proof.published)throw Error('Đã bấm Đăng nhưng hộp soạn của Facebook vẫn mở sau '+Math.round((done.waitedMs||0)/60000)+' phút. Giữ tab để Facebook đăng xong; không tự đăng lại.');
   const here=await chrome.tabs.get(tabId).catch(()=>null);
   if(here?.url&&canonicalPost(here.url)){
    try{
     const [read]=await chrome.scripting.executeScript({target:{tabId},func:inspectPost,args:[{actor:j.actor,text:j.post.text,open:false}]});
     const link=canonicalPost(read?.result?.url);
     if(link&&link===canonicalPost(here.url)&&!opened.prior.includes(link))verification={url:link,textMatch:true,authorMatch:true,source:'Thời gian dưới tên nick'};
    }catch{}
   }
   try{if(!verification)verification=await findPublished({...j,prior:opened.prior},tabId);}catch(error){
    // Facebook đã nhận bài: ghi Đã đăng, đóng tab. Link được tìm lại sau khi hàng chờ rảnh.
    verification={url:'',published:true,source:'Facebook đóng hộp soạn sau khi bấm Đăng',lookupError:String(error.message||'').slice(0,300)};
   }
  }
  url=verification.url||'';proof={...proof,textMatch:verification.textMatch,authorMatch:verification.authorMatch,source:verification.source||'Trang cá nhân'};
  if(j.backdate&&!url){await rpc('runner-finish',{...auth,result:{state:'partial',url:'',...proof,message:'Đã đăng nhưng chưa lấy được link nên chưa đổi ngày. Kiểm tra bài trên Facebook.'}});completed=true;status.textContent='Đã đăng (thiếu link): '+j.post.title;return;}
  if(j.backdate){await checkpoint('Đổi ngày bài đã đăng');await chrome.tabs.update(tabId,{url});await loaded(tabId);const result=await action('backdate',{url,requestedTime:j.requestedTime});proof.dateVerified=result.dateVerified;}
  await rpc('runner-finish',{...auth,result:{state:'success',url,...proof,message:url?'Bot đã đăng và xác minh tác giả, nội dung, permalink'+(j.backdate?' và ngày giờ.':'.'):'Đã đăng: Facebook đã nhận bài (hộp soạn đóng sau khi bấm Đăng). Chưa lấy được link, bot sẽ tự tìm lại khi hàng chờ rảnh.'}});completed=true;status.textContent='Hoàn tất: '+j.post.title+'\n'+(url||'(chưa có link)');
 }catch(e){
  try{const s=await rpc('runner-touch',auth);submitted=s.submitted;}catch{}
  const result={state:submitted?(url?'partial':'unknown'):'failed',url,...proof,message:stage+': '+e.message+(e.uiDiagnostic?' [UI: '+e.uiDiagnostic.status+'; '+e.uiDiagnostic.language+'; '+e.uiDiagnostic.viewport?.width+'×'+e.uiDiagnostic.viewport?.height+'; tab '+(e.uiDiagnostic.visibility||'?')+']':''),...(e.options?{choices:e.options}:{}),failedAction:e.action||'',...(e.uiDiagnostic?{uiDiagnostic:e.uiDiagnostic}:{})};
  try{const saved=await rpc('runner-finish',{...auth,result});completed=!submitted&&['failed','queued'].includes(saved?.state);if(saved?.state==='queued')e.message+=' → tự thử lại sau 90 giây.';}catch(finishError){status.textContent='Không ghi được kết quả: '+finishError.message;return;}
  status.textContent=j.post.title+'\n'+result.state+': '+e.message;
 }finally{clearInterval(timer);await rpc('runner-media-release',auth).catch(()=>{});if(Number.isInteger(tabId)&&files.some(f=>f.transferId))await chrome.scripting.executeScript({target:{tabId},func:stageMediaChunk,args:[{clear:true,ids:files.map(f=>f.transferId).filter(Boolean)}]}).catch(()=>{});if(completed){if(Number.isInteger(tabId))await rpc('posting-clean-children',{root:tabId}).catch(()=>{});await closeWorkTab(tabId);}}
}
async function loop(){if(running)return;running=true;try{await taskSlot(async()=>{const j=await rpc('runner-claim');if(j)await execute(j);});}catch(e){status.textContent=e.message;}finally{running=false;}}
setInterval(loop,2000);try{const tick=new Worker('runner-tick.js');tick.onmessage=()=>loop();}catch{}loop();
