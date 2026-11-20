import {apiConfig,keyMatches} from './ai-provider.js';
import {audienceService} from './audience-service.js';
import {commentReviewService} from './comment-review-service.js';
import {createCSVAutosave} from './csv-autosave.js';
import {storeTransfer,transferChunk,releaseTransfers,stageMediaChunk,MEDIA_LIMIT_MB,IMAGE_LIMIT_MB,POST_LIMIT_MB} from './media-transfer.js';
import {commentRuntimeService} from './comment-runtime-service.js';
import {personaService} from './persona-service.js';
import {linkAccount,detectAccount} from './account.js';
import {gatewayOrigin,teamCall} from './team-api.js';
import {allowed,actionSlot,RUN_KEY} from './run-control.js';
import {identifyWorkTab,finishPostingChildren,trackPostingChildren,openWorkTab,closeWorkTab} from './work-tabs.js';
import {makeFriends} from './friend-worker.js';
import {sourceChanges} from './source-changes.js';
import {refreshSourceMedia} from './source-media.js';
import {isNewSource,replacePendingPosts} from './replace-pending.js';
import {facebookBot} from './facebook-bot.js';
import {waitFacebookTab} from './tab-ready.js';
import {applyCaptionNames} from './caption-name-filter.js';
import {docsSource,DEFAULT_SOURCE,fbUrl,safeUrl,parseTime,fillMissingContent,cleanCaption,setManualCaption} from './scenario.js';
import {listModels,testManual,connectWeb,processAI,planWithAI,chooseFacebookOption} from './gemini.js';
import {prepareFacebook} from './facebook.js';
import {createAutomation} from './automation.js';
import {publicJob} from './automation-model.js';
import {mediaFetchUrl,mediaType} from './media.js';
import {readProgressFile,restoreCSVProgress,combineProgressRows,progressKey} from './csv-progress.js';
import {exportProgressV2} from './progress-v2.js';
import {exportProgressV3,verifyCSVIntegrity} from './progress-v3.js';
// [3.6.2-video] begin: kiểm tra dung lượng video trước khi tải (video-probe.js)
import {guardVideoSize,probeAllVideos} from './video-probe.js';
// [3.6.2-video] end
trackPostingChildren();
const friendDesk=makeFriends(async()=>{throw Error('3.8.4 dùng hàng chờ duyệt; bạn tự gửi bình luận trên Facebook.');});
let serial=Promise.resolve();const lock=fn=>{const r=serial.then(fn);serial=r.catch(()=>{});return r;};
const personas=personaService({lock,detectAccount});
const comments=commentRuntimeService();
const audiences=audienceService({identify:detectAccount});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[RUN_KEY]?.newValue?.enabled===false)void audiences.stop().catch(console.error);});
const reviewComments=commentReviewService();
const csvAutosave=createCSVAutosave();
const defaults=()=>({sources:[{id:crypto.randomUUID(),url:DEFAULT_SOURCE,note:''}],posts:[],logs:[],settings:{mode:'manual',model:'',target:'https://www.facebook.com/'}});
async function captionNames(d){const {deskPersonas}=await chrome.storage.local.get('deskPersonas');return applyCaptionNames(d,deskPersonas);}
async function db(){const d=(await chrome.storage.local.get('deskV2')).deskV2||defaults();for(const j of d.bot?.jobs||[])if(['queued','running'].includes(j.state))j.audience='public';for(const p of d.posts)if(['draft','error','scheduled','queued'].includes(p.state)){fillMissingContent(p);cleanCaption(p);fillMissingContent(p);}await captionNames(d);return d;}
async function write(d){await captionNames(d);for(const p of d.posts)if(['draft','error','scheduled','queued'].includes(p.state)){fillMissingContent(p);cleanCaption(p);fillMissingContent(p);}if(d.bot&&!d.bot.enabled)for(const j of d.bot.jobs.filter(j=>j.state==='queued')){const p=d.posts.find(p=>p.id===j.postId);if(p&&p.state!=='success'){j.post=structuredClone(p);j.expectedMedia=p.media.map(m=>m.type);p.state='queued';}}await chrome.storage.local.set({deskV2:d,deskBotSummary:botSummary(d)});}
// 3.8.6: tóm tắt nhỏ để runner hỏi việc mỗi 2 giây mà không phải đọc + làm sạch toàn bộ dữ liệu (nguyên nhân lag).
function botSummary(d){const b=d.bot||{};const jobs=b.jobs||[];const active=jobs.some(j=>['running','verifying'].includes(j.state));const due=jobs.filter(j=>j.state==='queued').map(j=>Date.parse(j.dueAt)).filter(Number.isFinite);return {enabled:Boolean(b.enabled),active,nextDue:due.length?Math.min(...due):null,at:Date.now()};}
function event(d,p,status,message,url=''){d.logs.unshift({id:crypto.randomUUID(),at:new Date().toISOString(),postId:p?.id||'',title:p?.title||'Hệ thống',status,message,url});d.logs=d.logs.slice(0,2000);}
function assertEditable(d,id){if(d.posts.some(p=>p.id===id&&p.state==='success')||d.bot?.jobs.some(j=>j.postId===id&&j.state==='success'))throw Error('Bài đã đăng, không thể đăng lại.');if(d.bot?.jobs.some(j=>j.postId===id&&!['success','failed','cancelled'].includes(j.state)&&!(j.state==='queued'&&!d.bot.enabled)))throw Error('Bài đang có lượt bot hoặc cần đối soát. Hủy lượt chưa chạy hoặc đối soát trước.');}
const automation=createAutomation({db,write,lock,event,mediaFile,mediaChunk:transferChunk,mediaRelease:releaseTransfers,chooseAI:async(kind,target,options,settings)=>chooseFacebookOption(kind,target,options,settings,await key(settings)),planAI:async(input,settings)=>planWithAI(input,settings,await key(settings))});
async function key(settings){
 if(!settings)settings=(await chrome.storage.local.get('deskV2')).deskV2?.settings||{};
 const session=await chrome.storage.session.get(['apiKey','apiKeyBinding']),local=await chrome.storage.local.get(['apiKey','apiKeyBinding']);
 for(const saved of [session,local])if(saved.apiKey&&keyMatches(saved.apiKeyBinding,settings))return saved.apiKey;
 return '';
}
async function saveAPIKey(value,settings,remember){
 const apiKeyBinding=apiConfig(settings).binding;
 await chrome.storage.session.set({apiKey:value,apiKeyBinding});
 if(remember)await chrome.storage.local.set({apiKey:value,apiKeyBinding});else await chrome.storage.local.remove(['apiKey','apiKeyBinding']);
}
async function openDesk(){const url=chrome.runtime.getURL('dashboard.html');const tabs=await chrome.tabs.query({url});if(tabs.length){await chrome.tabs.update(tabs[0].id,{active:true});await chrome.windows.update(tabs[0].windowId,{focused:true});}else await chrome.tabs.create({url});}
chrome.action.onClicked.addListener(openDesk);chrome.notifications.onClicked.addListener(()=>openDesk());
async function remind(){await lock(async()=>{const d=await db();let changed=false;for(const p of d.posts){if(p.state==='scheduled'&&p.schedule&&Date.parse(p.schedule)<=Date.now()&&!p.reminded){try{await chrome.notifications.create('desk-'+p.id,{type:'basic',iconUrl:'icon.png',title:'Đến lịch chuẩn bị đăng',message:p.title.slice(0,150)});p.reminded=true;event(d,p,'due','Đã nhắc đến lịch. Chưa đăng lên Facebook.');changed=true;}catch{}}}if(changed)await write(d);});}
// Apply locally verified permalinks on upgrade through the same serialized storage writer.
async function restoreVerifiedLinks(){
 const records=await (await fetch(chrome.runtime.getURL('verified-links.json'))).json();
 if(!records.length)return;
 await lock(async()=>{
  const d=await db();let changed=false;
  for(const record of records){
   const j=d.bot?.jobs.find(job=>job.id===record.jobId && job.submittedAt===record.submittedAt && job.actor?.url===record.actor);
   if(!j||j.state!=='unknown'||j.backdate||j.postUrl)continue;
   const post=d.posts.find(p=>p.id===j.postId);
   if(!post||post.postUrl)continue;
   const url=new URL(fbUrl(record.url));
   if(url.pathname!=='/permalink.php'||!url.searchParams.get('story_fbid')||url.searchParams.get('id')!==new URL(record.actor).searchParams.get('id'))continue;
   j.state=post.state='success';j.postUrl=post.postUrl=url.href;j.error='';j.stage='finished';j.verification={state:'success',url:url.href,authorMatch:true,textMatch:true,checkedOnProfile:true};
   event(d,post,'success','Đã kiểm tra bài và link trên trang cá nhân.',url.href);changed=true;
  }
  if(changed)await write(d);
 });
}
async function init(){await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});await chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});await lock(async()=>{const saved=await chrome.storage.local.get(['deskV2','posts']);if(!saved.deskV2){const d=defaults();d.posts=(saved.posts||[]).map(p=>({id:'legacy:'+p.id,sourceKey:'legacy',title:p.title||'Bản nháp cũ',text:p.text,blocks:[{runs:[{text:p.text}]}],media:[],notes:[],comments:[],location:'',feeling:'',withPeople:'',time:p.schedule||'',timing:parseTime(p.schedule||''),state:'draft'}));await write(d);}});await chrome.alarms.create('desk-reminders',{periodInMinutes:1});void friendDesk.tick().catch(console.error);await restoreVerifiedLinks();await remind();if(await allowed())await automation.heartbeat();}
chrome.alarms.get('desk-reminders').then(a=>a||chrome.alarms.create('desk-reminders',{periodInMinutes:1})).catch(console.error);
chrome.runtime.onInstalled.addListener(()=>init().catch(console.error));chrome.runtime.onStartup.addListener(()=>init().catch(console.error));chrome.alarms.onAlarm.addListener(a=>{if(a.name==='desk-reminders'){friendDesk.tick().catch(console.error);remind().catch(console.error);allowed().then(on=>on&&automation.heartbeat()).catch(console.error);}});
// 3.8.6.3: yt-dlp không đọc được link BÀI VIẾT (/posts/, permalink.php, pfbid…) khi không đăng nhập
// ("Cannot parse data"). Đọc trang bài bằng phiên Facebook của chính profile này, lấy mã video,
// rồi gửi Media Bridge dạng watch/?v=<mã> (yt-dlp đọc được). Không tìm thấy thì giữ link gốc.
async function resolveVideoSource(sourceUrl,signal){
 let u;try{u=new URL(sourceUrl);}catch{return sourceUrl;}
 if(/^\/(?:reels?|videos)\/[\w.-]+|^\/[\w.-]+\/videos\/\d+|^\/watch\/?$/.test(u.pathname))return sourceUrl;
 try{
  const r=await fetch('https://www.facebook.com'+u.pathname+u.search,{credentials:'include',signal:signal||AbortSignal.timeout(30000)});
  if(!r.ok)return sourceUrl;
  const html=(await r.text()).slice(0,6*1024*1024);
  const score=new Map();const add=(id,w)=>score.set(id,(score.get(id)||0)+w);
  for(const m of html.matchAll(/"video_id":"(\d{6,25})"/g))add(m[1],3);
  for(const m of html.matchAll(/"videoId":"(\d{6,25})"/g))add(m[1],3);
  for(const m of html.matchAll(/\\?\/(?:videos|reel)\\?\/(\d{6,25})/g))add(m[1],1);
  for(const m of html.matchAll(/watch\\?\/\?v=(\d{6,25})/g))add(m[1],1);
  const ranked=[...score].sort((a,b)=>b[1]-a[1]);
  // Trang bài có thể kèm video gợi ý: chỉ nhận khi một mã áp đảo (gấp đôi mã đứng thứ hai).
  if(!ranked.length||(ranked[1]&&ranked[0][1]<2*ranked[1][1]))return sourceUrl;
  return 'https://www.facebook.com/watch/?v='+ranked[0][0];
 }catch{return sourceUrl;}
}
async function mediaFile(m,index,{signal,owner='manual'}={}){
 let url;try{url=mediaFetchUrl(m?.url);}catch(e){throw Error('Tệp '+(index+1)+': '+e.message);}if(!url)throw Error('Media không có liên kết HTTPS hợp lệ.');
 let r;
 if(m.manifest){
  if(m.manifest.schema!=='desk.media/1'||!['video','reel'].includes(m.manifest.kind))throw Error('Media JSON không hợp lệ.');
  const manifest={...m.manifest,sourceUrl:await resolveVideoSource(m.manifest.sourceUrl,signal)};
  // 3.8.7: vẫn là link BÀI VIẾT (bài nhiều media, không tìm được mã video duy nhất): dừng trước khi gọi Media Bridge.
  if(/\/posts\/|\/permalink\.php|\/story\.php|\/share\/p\//.test(new URL(manifest.sourceUrl).pathname+'/'))throw Error('Tệp '+(index+1)+': Media nguồn ghi link BÀI VIẾT thay vì link của chính video, nên không dựng được MP4. Quét lại bài bằng Post Research mới (ghi link riêng của từng video) rồi đọc lại nguồn.');
  /* [3.6.2-video] begin */await guardVideoSize(manifest,{signal});/* [3.6.2-video] end */
  try{for(let attempt=0;attempt<300;attempt++){
   r=await fetch('http://127.0.0.1:47833/prepare',{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json'},body:JSON.stringify({schema:manifest.schema,kind:manifest.kind,sourceUrl:manifest.sourceUrl}),signal:signal||AbortSignal.timeout(900000)});
   if(r.status!==409)break;await r.text();await new Promise(resolve=>setTimeout(resolve,1000));if(signal?.aborted)throw Error('Đã dừng dựng MP4.');
  }}catch(error){if(signal?.aborted)throw Error('Đã dừng dựng MP4.');throw Error('Chưa kết nối được Media Bridge. Chạy Start-Media.ps1 trong thư mục FB Desk và ghép Extension ID. '+error.message);}
  if(!r?.ok)throw Error('Dựng MP4: '+(r?await r.text():'Bộ xử lý đang bận.'));
 }else r=await fetch(url,{credentials:url.startsWith('data:')?'omit':'include',signal:signal||AbortSignal.timeout(60000)});
 if(!r.ok)throw Error('Không tải được media '+(index+1)+': HTTP '+r.status);
 const header=r.headers.get('content-type')||'';
 if(/text\/|application\/(?:json|xhtml)/i.test(header))throw Error('Media '+(index+1)+' là trang web hoặc sai loại tệp. Cần link tải trực tiếp '+m.type+', không phải trang xem video.');
 const limitMB=m.type==='video'?MEDIA_LIMIT_MB:IMAGE_LIMIT_MB;
 if(Number(r.headers.get('content-length'))>limitMB*1024*1024)throw Error('Tệp vượt '+limitMB+' MB.');
 const reader=r.body.getReader();let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limitMB*1024*1024){await reader.cancel();throw Error('Tệp vượt '+limitMB+' MB.');}chunks.push(value);}
 const bytes=new Uint8Array(Math.min(size,4096));let offset=0;for(const c of chunks){const part=c.subarray(0,bytes.length-offset);bytes.set(part,offset);offset+=part.length;if(offset===bytes.length)break;}
 if(!size)throw Error('Media '+(index+1)+' là tệp rỗng.');
 const type=mediaType(header,bytes,m.type),extension=({'video/quicktime':'mov','image/jpeg':'jpg'})[type]||type.split('/')[1];
 return storeTransfer(new Blob(chunks,{type}),{type,name:'media-'+(index+1)+'.'+extension},owner);
}
async function handle(msg,sender){
 if(msg.type==='friends-comment'||msg.type==='friends-guard'&&msg.commentKey)throw Error('3.8.4 không gửi bình luận tự động. Dùng hàng chờ duyệt.');
 if(msg.type?.startsWith('audience-'))return audiences.handle(msg,sender);
 if(msg.type?.startsWith('review-'))return reviewComments(msg,sender);
 if(msg.type?.startsWith('cross-'))throw Error('3.8.4 dùng hàng chờ duyệt; không chạy điều phối comment chéo tự động.');
 if(msg.type?.startsWith('autosave-')){
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Chỉ cấu hình tự lưu từ FB Desk.');
  if(msg.type==='autosave-context'){const title=String(msg.title||'').slice(0,200);const old=(await chrome.storage.local.get('deskAutosaveContext')).deskAutosaveContext;if(old?.title!==title)await chrome.storage.local.set({deskAutosaveContext:{title}});return true;}
  if(msg.type==='autosave-flush'){await chrome.storage.local.set({deskAutosaveDirty:crypto.randomUUID()});await csvAutosave.flush();await csvAutosave.flush();const saved=await chrome.storage.local.get(['deskAutosaveStatus','deskAutosaveDirty']);return {...saved.deskAutosaveStatus,pending:Boolean(saved.deskAutosaveDirty)};}
  if(msg.type==='autosave-download')return exportProgressV3(await db());
  if(msg.type==='autosave-folder'||msg.type==='autosave-location'){const result=await chrome.runtime.sendNativeMessage('com.facebookdesk.media',{action:msg.type==='autosave-folder'?'autosave-open':'autosave-info'});if(!result?.ok)throw Error(result?.error||'Không mở được thư mục tự lưu.');return result;}
  throw Error('Tác vụ tự lưu không hợp lệ.');
 }
 if(msg.type==='media-start-video'){
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Chỉ khởi động video từ bảng điều khiển.');
  let response;
  try{response=await chrome.runtime.sendNativeMessage('com.facebookdesk.media',{action:'start'});}
  catch(error){throw Error('Chrome chưa mở được bộ nối Windows. Chạy cập nhật tại chỗ trên máy đang dùng để đăng ký hoặc sửa bộ nối cho ID '+chrome.runtime.id+'. Chi tiết: '+error.message);}
  if(!response?.ok)throw Error(response?.error||'Bộ nối video chưa phản hồi.');
  return response;
 }

 if(msg.type?.startsWith('comment-'))return comments.handle(msg,sender);
 if(msg.type?.startsWith('persona-')){if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Chỉ cấu hình nhân vật từ bảng điều khiển.');return personas(msg);}
 // [3.6.2-video] begin: nút 'Kiểm tra dung lượng video' trên bảng điều khiển
 if(msg.type==='video-probe-all'){if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Sai trang kiểm tra.');return probeAllVideos((await db()).posts);}
 // [3.6.2-video] end
 if(msg.type==='media-bridge-status'){
  if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Sai trang kiểm tra.');
  try{const r=await fetch('http://127.0.0.1:47833/health',{credentials:'omit',signal:AbortSignal.timeout(3000)});if(!r.ok)throw Error('Extension ID chưa được ghép.');const result=await r.json();return 'Đã kết nối Python · '+result.schema+' · MP4 tối đa '+result.maxMB+' MB.';}catch(e){throw Error('Bấm Start Video để mở bộ xử lý chạy ngầm. Nếu chưa cài bộ nối, chạy Install-Start-Video.cmd một lần. '+e.message);}
 }
 if(msg.type==='import-progress-csv')return lock(async()=>{
  if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Chỉ nhập CSV từ bảng điều khiển.');
  const parsed=readProgressFile(msg.csv),rows=parsed.rows,d=await db();
  await verifyCSVIntegrity(parsed);
  if(!rows.length)throw Error('CSV không có dòng lịch sử.');
  if(parsed.posts.length)d.sources=d.sources.filter(s=>s.url?.trim());
  if(d.bot?.jobs.some(j=>['running','verifying'].includes(j.state)))throw Error('Dừng bot và chờ lượt đang xử lý kết thúc trước khi nhập.');
  for(const p of parsed.posts){const existing=d.posts.find(old=>old.id===p.id);if(!existing){cleanCaption(p);fillMissingContent(p);p.timing=parseTime(p.time);d.posts.push(p);}else{if(Array.isArray(p.commentDepths)&&JSON.stringify(existing.comments||[])===JSON.stringify(p.comments||[])&&JSON.stringify(existing.commentDepths||[])!==JSON.stringify(p.commentDepths))existing.commentDepths=p.commentDepths;if(!String(existing.text||'').trim()&&p.text.trim()){existing.text=p.text;existing.blocks=structuredClone(p.blocks);}if(!existing.sourceCaption&&typeof p.sourceCaption==='string'){existing.sourceCaption=p.sourceCaption;existing.sourceCaptionState=p.sourceCaptionState;}if(!String(existing.text||'').trim()&&p.sourceCaptionState==='no_caption'){existing.sourceCaptionState='no_caption';existing.captionState='no_caption';existing.captionEvidence=p.captionEvidence;}}if(p.sourceUrl&&!d.sources.some(s=>s.url===p.sourceUrl))d.sources.push({id:crypto.randomUUID(),url:p.sourceUrl,note:''});}
  const combined=combineProgressRows(d.csvProgressRows||[],rows);
  const result=restoreCSVProgress(d,combined);result.captionRepairs=parsed.repairedCaptions||0;d.csvProgressRows=combined;
  for(const p of d.posts.filter(p=>p.csvProgress&&p.state==='success')){
   for(const log of d.logs.filter(l=>l.postId===p.id&&['unknown','partial'].includes(l.status))){log.originalStatus=log.status;log.status='success';log.message='Đã xác nhận đã đăng theo CSV người dùng nhập. '+(log.message||'');}
   if(!d.logs.some(l=>l.postId===p.id&&l.csvRestored)){
    event(d,p,'success','Khôi phục từ CSV: '+p.csvProgress.status+'. Tự xác nhận đã đăng theo quy tắc nhập CSV; không đăng lại.',p.postUrl||'');d.logs[0].csvRestored=true;
   }
  }
  event(d,null,'csv_import',`Đã khôi phục CSV: ${result.published} bài đã đăng, ${result.remaining} bài còn lại, ${result.issues.length} mục cần kiểm tra.`);
  d.lastCSVImport={at:new Date().toISOString(),...result};await write(d);return result;
 });
 if(msg.type==='export-progress-v2'||msg.type==='export-progress-v3'){
  if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Sai trang xuất.');
  const d=await db();if(d.bot?.jobs.some(j=>['running','verifying'].includes(j.state)))throw Error('Dừng hàng chờ và chờ lượt đang gửi kết thúc trước khi xuất CSV, để bản sao không bỏ sót bài vừa đăng.');
  return msg.type==='export-progress-v2'?exportProgressV2(d,msg.includeKey?await key():''):exportProgressV3(d,msg.includeKey?await key():'');
 }
 if(msg.type==='apply-import-profile'){
  if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Sai trang cấu hình.');
  const api=String(msg.apiKey||'').trim(),uid=String(msg.uid||'').trim();if(api&&(api.length>500||/\s/.test(api)))throw Error('API key không hợp lệ.');
  const before=await db();if(before.bot?.jobs.some(j=>['running','verifying'].includes(j.state)))throw Error('Dừng lượt đang xử lý trước khi đổi cấu hình.');
  const actor=uid?await linkAccount(uid):null;
  return lock(async()=>{const d=await db();if(d.bot?.jobs.some(j=>!['success','failed','cancelled'].includes(j.state)&&actor&&j.actor?.url!==actor.url))throw Error('Hàng chờ hiện tại thuộc tài khoản khác. Hủy hàng chờ cũ trước khi đổi UID.');
   if(actor){d.bot=d.bot||{enabled:false,jobs:[]};d.bot.actor=actor;}
   if(['manual','web','team'].includes(msg.mode))d.settings.mode=msg.mode;
   if(typeof msg.model==='string')d.settings.model=msg.model.slice(0,200);
   d.settings.apiProtocol=msg.apiProtocol||'gemini';d.settings.apiBaseUrl=apiConfig({apiProtocol:d.settings.apiProtocol,apiBaseUrl:msg.apiBaseUrl||''}).base;d.settings.apiJsonMode=Boolean(msg.apiJsonMode);if(api)await saveAPIKey(api,d.settings,false);await write(d);return {actor,keyConfigured:Boolean(await key())};});
 }
 if(msg.type==='bind-progress-csv')return lock(async()=>{
  if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Chỉ đối chiếu từ bảng điều khiển.');
  const d=await db(),name=progressKey(msg.title);
  if(!d.csvProgressRows?.some(r=>progressKey(r.title)===name&&['đã đăng','cần đối soát','đã đăng, thiếu bước','success','unknown','partial'].includes(progressKey(r.status)))||!d.posts.some(p=>p.id===msg.postId))throw Error('Không tìm thấy xác nhận đã đăng trong CSV hoặc bài được chọn.');
  d.csvProgressBindings={...d.csvProgressBindings,[name]:msg.postId};
  const result=restoreCSVProgress(d,d.csvProgressRows,{publishedOnly:true});
  d.lastCSVImport={at:new Date().toISOString(),...result};
  const post=d.posts.find(p=>p.id===msg.postId);event(d,post,'success','Người dùng chọn bài tương ứng với CSV: '+msg.title+'. Không đăng lại.',post.postUrl||'');
  await write(d);return result;
 });
 if(msg.type==='team-config'||msg.type==='team-usage'){
  if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Sai trang điều khiển.');
  if(msg.type==='team-usage')return teamCall('usage');
  const origin=gatewayOrigin(msg.origin),old=(await chrome.storage.local.get('deskGateway')).deskGateway;
  const token=String(msg.token||'').trim()||(old?.origin===origin?old.token:'');
  if(!token||!await chrome.permissions.contains({origins:[origin+'/*']}))throw Error('Thiếu mã máy hoặc quyền kết nối gateway.');
  await chrome.storage.local.set({deskGateway:{origin,token}});return true;
 }
 if(msg.type==='link-account'&&sender.url===chrome.runtime.getURL('dashboard.html'))return {actor:await linkAccount(msg.value)};
 if(msg.type==='header-account'&&sender.url===chrome.runtime.getURL('dashboard.html')){
  try{return {actor:await detectAccount(msg.probe===true,true)};}
  catch(e){return {actor:null,reason:e.message};}
 }
 if(msg.type==='desk-restriction'||msg.type==='desk-toggle'){
  const fromPage=msg.type==='desk-restriction'&&sender.tab?.id&&sender.url?.startsWith('https://www.facebook.com/');
  if(!fromPage&&!(msg.type==='desk-toggle'&&sender.url===chrome.runtime.getURL('dashboard.html')))throw Error('Sai nguồn.');
  if(fromPage||msg.enabled!==true)await automation.pause();
  return lock(async()=>{
   const state={enabled:!fromPage&&msg.enabled===true,reason:fromPage?String(msg.reason).slice(0,450):'Đã dừng theo yêu cầu',at:Date.now()};
   if(state.enabled)state.reason='';
   if(fromPage){
    const history=(await chrome.storage.local.get('deskRestrictionHistory')).deskRestrictionHistory||[];
    await chrome.storage.local.set({[RUN_KEY]:state,deskRestrictionHistory:[{at:state.at,reason:state.reason},...history].slice(0,50)});
   }else await chrome.storage.local.set({[RUN_KEY]:state});
   if(!state.enabled){
    const tabs=await chrome.storage.session.get(null);
    const jobs=(await db()).bot?.jobs||[];for(const key of Object.keys(tabs))if(key.startsWith('desk-owned-tab:')&&!jobs.some(j=>j.facebookTabId===Number(key.slice('desk-owned-tab:'.length))))await closeWorkTab(Number(key.slice('desk-owned-tab:'.length)));
   }
   return state;
  });
 }
 const controlled=msg.type.startsWith('bot-')||msg.type.startsWith('runner-')||msg.type.startsWith('friends-')||['prepare','apply-source-update'].includes(msg.type);
 const bookkeeping=['bot-clicked','bot-receipt','runner-finish','runner-touch','friends-state','friends-names','friends-sync','friends-save-sheet','friends-stop','bot-stop','bot-cancel'];
 if(controlled&&!bookkeeping.includes(msg.type)&&!(await allowed())){
  if(msg.type==='runner-claim')return null;
  throw Error('Tự động hóa đang tạm dừng. Xem trạng thái dưới logo.');
 }
 if(['bot-permit','friends-permit','friends-photo','comment-final-permit'].includes(msg.type)||(msg.type==='friends-guard'&&msg.paced)){
  const slot=await actionSlot();if(slot?.waitMs){if(msg.type==='bot-permit')await automation.handle({...msg,type:'bot-waiting-submit',waitMs:slot.waitMs},sender);return slot;}
 }

 if(msg.type==='desk-tab-proof'&&sender.tab?.id&&sender.url?.startsWith('https://www.facebook.com/'))return identifyWorkTab(sender.tab.id);
 if(msg.type==='posting-clean-children'&&sender.url===chrome.runtime.getURL('runner.html')&&Number.isInteger(msg.root))return finishPostingChildren(msg.root);
 if(msg.type?.startsWith('friends-'))return friendDesk.handle(msg,sender);
 if(['bot-plan','bot-enqueue','bot-card-schedule','bot-start','prepare'].includes(msg.type)){
  const d=await db(),unresolved=(d.lastCSVImport?.entries||[]).filter(e=>e.published&&!e.matched);
  if(unresolved.length)throw Error('Còn '+unresolved.length+' bài CSV xác nhận đã đăng nhưng chưa ghép được. Mở Báo cáo lịch sử, chọn bài tương ứng trước khi tiếp tục để tránh đăng trùng.');
 }
 if(msg.type==='runner-claim'){const {deskBotSummary:s}=await chrome.storage.local.get('deskBotSummary');if(s&&(!s.enabled||s.active||s.nextDue===null||s.nextDue>Date.now()))return null;}
 if(msg.type?.startsWith('bot-')||msg.type?.startsWith('runner-'))return automation.handle(msg,sender);
 if(['ai','post-update','schedule','cancel-schedule','confirm-post','prepare','delete-post'].includes(msg.type)){const current=await db();if(current.bot?.jobs.some(j=>j.postId===msg.id&&!['success','failed','cancelled'].includes(j.state)))throw Error('Bài đã vào hàng chờ bot hoặc cần đối soát. Hủy lượt chưa chạy hoặc đối soát trước khi sửa/xóa/thao tác thủ công.');}
 if(msg.type==='state'){const d=await db();return {...d,...(d.bot?{bot:{...d.bot,jobs:d.bot.jobs.map(publicJob)}}:{}),keyConfigured:!!(await key()),rememberKey:!!(await chrome.storage.local.get('apiKey')).apiKey};}
 if(msg.type==='settings')return lock(async()=>{
  const d=await db();if(!['manual','web','team'].includes(msg.settings.mode))throw Error('Chế độ AI không hợp lệ.');
  const settings={mode:msg.settings.mode,model:String(msg.settings.model||'').trim(),target:fbUrl(msg.settings.target),apiProtocol:msg.settings.apiProtocol||'gemini',apiBaseUrl:apiConfig(msg.settings).base,apiJsonMode:Boolean(msg.settings.apiJsonMode)};
  const supplied=String(msg.key||'').trim();if(supplied&&(supplied.length>4096||/\s/.test(supplied)))throw Error('API key không hợp lệ.');
  const value=supplied||await key(settings);
  if(settings.mode==='manual'&&!value)throw Error('Địa chỉ API đã đổi. Hãy nhập key tương ứng; key cũ không được gửi sang nhà cung cấp mới.');
  if(value)await saveAPIKey(value,settings,msg.remember);
  d.settings=settings;await write(d);return true;
 });
 if(msg.type==='remove-key'){await chrome.storage.session.remove(['apiKey','apiKeyBinding']);await chrome.storage.local.remove(['apiKey','apiKeyBinding']);return true;}
 if(msg.type==='models'||msg.type==='test-api'){
  const settings=msg.settings||{},apiKey=String(msg.key||'').trim()||await key(settings);
  return msg.type==='models'?listModels(apiKey,settings):testManual(apiKey,msg.model,settings);
 }
 if(msg.type==='connect-web')return connectWeb();
 if(msg.type==='sources')return lock(async()=>{if(!Array.isArray(msg.sources)||msg.sources.length>30)throw Error('Tối đa 30 nguồn.');const d=await db();d.sources=msg.sources.map(s=>({id:String(s.id),url:String(s.url).slice(0,2000),note:String(s.note||'').slice(0,10000)}));await write(d);return true;});
 if(msg.type==='fetch-doc'){
  const source=docsSource(msg.url);let r;try{r=await fetch(source.exportUrl,{credentials:'include',signal:AbortSignal.timeout(15000)});}catch{}if(!r?.ok)r=await fetch(`https://docs.google.com/document/d/${source.id}/mobilebasic`+(source.tab?'?tab='+encodeURIComponent(source.tab):''),{credentials:'include',signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error('Không đọc được Docs (HTTP '+r.status+'). Mở tài liệu trong Chrome Profile này và kiểm tra quyền xem.');
  const html=await r.text();if(html.length>10*1024*1024)throw Error('Tài liệu quá lớn (trên 10 MB HTML).');if(!/<(?:p|h[1-6])\b/i.test(html)||/accounts.google.com\/ServiceLogin/.test(r.url))throw Error('Google yêu cầu đăng nhập hoặc quyền xem. Mở nguồn Docs trước rồi đọc lại.');return {html,source};
 }
 if(msg.type==='merge')return lock(async()=>{const d=await db();if(!Array.isArray(msg.posts)||msg.posts.length>500)throw Error('Tối đa 500 bài mỗi lần đọc.');let added=0,mediaRecovered=0,mediaRefreshed=0,mediaBlocked=0;let replaced={removed:0,cancelled:0,kept:0};if(msg.replacePending&&msg.posts.length&&isNewSource(d,msg.posts))replaced=replacePendingPosts(d,msg.posts[0].sourceKey);for(const p of msg.posts){if(typeof p.id!=='string'||typeof p.text!=='string'||!Array.isArray(p.blocks)||!Array.isArray(p.media))throw Error('Dữ liệu bài không hợp lệ.');const old=d.posts.find(x=>x.id===p.id);if(old?.state==='success'){const {changes,uncertain}=await sourceChanges(old.original||old,p);old.mediaUncertain=uncertain;old.sourceUpdate=changes.length?{post:p,changes}:null;}else if(!old){d.posts.push({...p,state:'draft',original:structuredClone(p)});added++;}else{const outcome=refreshSourceMedia(d,old,p);if(outcome==='recovered')mediaRecovered++;if(outcome==='refreshed')mediaRefreshed++;if(outcome==='blocked'||outcome==='pending')mediaBlocked++;}}if(d.csvProgressRows?.length){const report=restoreCSVProgress(d,d.csvProgressRows,{publishedOnly:true,pause:false});d.lastCSVImport={at:new Date().toISOString(),...report};}await write(d);return {added,replaced,skipped:msg.posts.length-added,mediaRecovered,mediaRefreshed,mediaBlocked,sourceImages:msg.posts.reduce((n,p)=>n+(p.sourceImageCount??p.media.filter(m=>m.type==='image').length),0)};});
 if(msg.type==='apply-source-update')return lock(async()=>{
  const d=await db(),p=d.posts.find(x=>x.id===msg.id),u=p?.sourceUpdate;
  if(p?.state!=='success'||!u||!p.postUrl)throw Error('Không có cập nhật cho bài đã đăng.');
  const publishedFields=['text','location','feeling','withPeople','media','time'];
  const changed=u.changes.filter(k=>publishedFields.includes(k));
  if(changed.length&&!msg.manual){
   const actor=d.bot?.jobs.find(j=>j.postId===p.id&&j.state==='success')?.actor;
   if(changed.some(k=>k!=='text')||!actor)throw Error('Mở bài đã đăng để cập nhật trực tiếp, rồi xác nhận đã sửa.');
   const tab=await openWorkTab({url:fbUrl(p.postUrl),active:true},'edit:'+p.id);try{
   await waitFacebookTab(tab.id,id=>chrome.tabs.get(id),ms=>new Promise(r=>setTimeout(r,ms)));
   const res=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:facebookBot,args:['edit-existing-text',{actor,url:p.postUrl,before:p.text,text:u.post.text}]}))[0]?.result;
   if(!res?.ok)throw Error(res?.error||'Chưa xác minh được bản sửa trên Facebook. Kiểm tra bài đã đăng.');
   }finally{await closeWorkTab(tab.id);}
  }
  for(const k of u.changes)p[k]=u.post[k];
  p.original=structuredClone(u.post);p.sourceUpdate=null;
  event(d,p,'updated','Đã cập nhật bài cũ từ nguồn.',p.postUrl);await write(d);return true;
 });
 if(msg.type==='ai'){
  const d=await db();assertEditable(d,msg.id);const p=d.posts.find(p=>p.id===msg.id);if(!p)throw Error('Bài viết không tồn tại.');if(p.state==='success')throw Error('Không xử lý lại bài đã xác nhận đăng.');
  const source=d.sources.find(s=>{try{return docsSource(s.url).key===p.sourceKey;}catch{return false;}});
  try{const updated=await processAI(p,[source?.note,p.captionInstructions,'Xóa toàn bộ hashtag, giữ emoji. Chỉ chỉnh caption theo hướng dẫn, không thêm tiêu đề vào bài.'].filter(Boolean).join('\n'),d.settings,await key(d.settings));updated.aiSourceNote=source?.note||'';return await lock(async()=>{const latest=await db(),index=latest.posts.findIndex(x=>x.id===p.id);if(index<0)throw Error('Bài đã bị xóa.');assertEditable(latest,p.id);if(JSON.stringify(latest.posts[index])!==JSON.stringify(p))throw Error('Bài đã đổi trong lúc AI xử lý. Kết quả không ghi đè; hãy thử lại.');latest.posts[index]=updated;event(latest,p,'ai','AI đã xử lý nội dung. Bài đang ở bản nháp.');await write(latest);return true;});}catch(e){await lock(async()=>{const latest=await db();event(latest,p,'ai_error',e.message);await write(latest);});throw e;}
 }
 if(msg.type==='post-update')return lock(async()=>{const d=await db();assertEditable(d,msg.id);const p=d.posts.find(p=>p.id===msg.id);if(!p)throw Error('Không tìm thấy bài.');if(p.state==='success')throw Error('Bài đã xác nhận đăng không sửa tại đây.');for(const k of ['title','location','feeling','withPeople','time','captionInstructions'])if(typeof msg.values[k]==='string')p[k]=msg.values[k].slice(0,2000);if(typeof msg.values.text==='string'&&msg.values.text!==p.text){if(msg.values.text.length>20000)throw Error('Nội dung quá 20.000 ký tự.');setManualCaption(p,msg.values.text);}p.timing=parseTime(p.time);p.state='draft';p.schedule='';p.reminded=false;await write(d);return true;});
 if(msg.type==='schedule')return lock(async()=>{const d=await db();assertEditable(d,msg.id);const p=d.posts.find(p=>p.id===msg.id);if(!p||p.state==='success')throw Error('Bài không hợp lệ.');const timing=parseTime(p.time);if(timing.kind!=='future')throw Error('Chọn giờ tương lai có múi giờ hoặc dạng dd/mm/yyyy HH:mm.');p.schedule=timing.iso;p.reminded=false;p.state='scheduled';event(d,p,'scheduled','Đã hẹn nhắc đăng; Chrome cần đang chạy.');await write(d);return true;});
 if(msg.type==='cancel-schedule')return lock(async()=>{const d=await db();assertEditable(d,msg.id);const p=d.posts.find(p=>p.id===msg.id);if(p?.state==='scheduled'){p.state='draft';p.schedule='';p.reminded=false;event(d,p,'cancelled','Đã hủy lịch nhắc.');await write(d);}return true;});
 if(msg.type==='confirm-post')return lock(async()=>{const d=await db();assertEditable(d,msg.id);const p=d.posts.find(p=>p.id===msg.id);if(!p)throw Error('Không tìm thấy bài.');const url=fbUrl(msg.url);const u=new URL(url);if(u.pathname==='/'||!(/\/posts\/|\/permalink\/|\/videos\/|\/reel\/|\/share\//.test(u.pathname)||u.searchParams.has('story_fbid')||u.searchParams.has('fbid')))throw Error('Dán liên kết bài đăng cụ thể, không phải trang cá nhân.');if(p.state==='success')throw Error('Bài đã được xác nhận trước đó.');p.state='success';p.postUrl=url;event(d,p,'success','Người dùng xác nhận đã đăng; chưa xác minh tự động.',url);await write(d);return true;});
 if(msg.type==='prepare'){
  const d=await db();assertEditable(d,msg.id);const p=d.posts.find(p=>p.id===msg.id);if(!p||p.state==='success')throw Error('Bài không hợp lệ hoặc đã đăng.');if(p.mediaReadError||(p.sourceImageCount||0)>(p.media||[]).filter(m=>m.type==='image').length)throw Error('Ảnh đọc từ Docs chưa đầy đủ. Đọc lại nguồn trước khi đăng.');const tab=await chrome.tabs.get(msg.tabId);fbUrl(tab.url);
  if(p.captionNameFilter?.status==='blocked')throw Error(p.captionNameFilter.message);
  const transferOwner='manual:'+crypto.randomUUID();
  try{const files=[];let total=0;for(const [i,m] of p.media.entries()){const f=await mediaFile(m,i,{owner:transferOwner});total+=f.size;if(total>POST_LIMIT_MB*1024*1024)throw Error('Tổng media vượt '+POST_LIMIT_MB+' MB.');files.push(f);}
   for(const file of files){for(let index=0;index<file.chunks;index++){const part=await transferChunk(file.transferId,index,transferOwner);const staged=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:stageMediaChunk,args:[{file,index,base64:part.base64}]}))[0]?.result;if(!staged?.ok)throw Error(staged?.error||'Không chuyển được media.');}}
   const r=await chrome.scripting.executeScript({target:{tabId:tab.id},func:prepareFacebook,args:[{text:p.text,files}]});await releaseTransfers(transferOwner);if(!r[0]?.result?.ok)throw Error(r[0]?.result?.error||'Facebook không phản hồi.');
   await lock(async()=>{const latest=await db(),q=latest.posts.find(x=>x.id===p.id);if(q){q.state='prepared';event(latest,q,'prepared',r[0].result.message);await write(latest);}});await chrome.tabs.update(tab.id,{active:true});return r[0].result.message;
  }catch(e){await lock(async()=>{const latest=await db(),q=latest.posts.find(x=>x.id===p.id);if(q){q.state='error';event(latest,q,'error',e.message);await write(latest);}});throw e;}finally{await releaseTransfers(transferOwner).catch(()=>{});}
 }
 if(msg.type==='export'){const d=await db();return {version:3,sources:d.sources,posts:d.posts,logs:d.logs,...(d.bot?{automation:{actor:d.bot.actor,jobs:d.bot.jobs.map(publicJob)}}:{})};}
 if(msg.type==='delete-post')return lock(async()=>{const d=await db();assertEditable(d,msg.id);d.posts=d.posts.filter(p=>p.id!==msg.id);await write(d);return true;});
 throw Error('Yêu cầu không hợp lệ.');
}
chrome.runtime.onMessage.addListener((msg,sender,respond)=>{const fromUi=sender.url===chrome.runtime.getURL('dashboard.html');const fromRunner=sender.url===chrome.runtime.getURL('runner.html');const fromCommentRunner=sender.url===chrome.runtime.getURL('comment-runner.html');const fromAudienceRunner=sender.url===chrome.runtime.getURL('audience-runner.html');const fromFacebook=['audience-final-permit','desk-restriction','bot-clicked','bot-receipt','desk-tab-proof','bot-permit','bot-abort-before-click','bot-ui-choice','friends-guard','friends-progress','friends-permit','friends-comment','friends-photo'].includes(msg.type)&&sender.id===chrome.runtime.id&&sender.tab?.id&&sender.url?.startsWith('https://www.facebook.com/');if(!fromUi&&!fromRunner&&!fromCommentRunner&&!fromAudienceRunner&&!fromFacebook)return;handle(msg,sender).then(data=>respond({ok:true,data}),e=>respond({ok:false,error:e.name==='TimeoutError'?'Kết nối quá thời gian chờ. Kiểm tra mạng và thử lại.':e.message}));return true;});
init().catch(console.error);
chrome.storage.local.get('deskV2').then(({deskV2})=>deskV2&&chrome.storage.local.set({deskBotSummary:botSummary(deskV2)})).catch(console.error);
void audiences.ensure().catch(console.error);






chrome.alarms.clear('desk-comment-runtime').catch(console.error);
comments.ensureRunner().catch(console.error);
