import {filterCaptionName} from './caption-name-filter.js';
import {detectAccount} from './account.js';
import {taskSlot} from './run-control.js';
import {sweepWorkTabs,openWorkTab,closeWorkTab} from './work-tabs.js';
import {findPublished} from './published-link.js';
import {resetCandidate,resetCopy,botDefaults,createJob,dueJob,canonicalPost,publicJob,terminalStates} from './automation-model.js';
import {facebookBot} from './facebook-bot.js';
import {fbUrl,docsSource} from './scenario.js';
import {planningInput,needsScheduleAI,directPlan,validatePlan,assignSlots,canClaim,advanceDefaultQueue,DEFAULT_INTERVAL_MINUTES,DEFAULT_GAP_MS} from './posting-plan.js';
export function createAutomation({db,write,lock,event,mediaFile,mediaChunk,mediaRelease,planAI,chooseAI}){
 const transfers=new Map();
 async function pause(){
  const interrupted=await lock(async()=>{const d=await db(),b=bot(d);b.enabled=false;b.pauseReason='Đã dừng. Bài chưa gửi được giữ trong hàng chờ.';const interrupted=[];
   for(const j of b.jobs.filter(j=>['running','verifying'].includes(j.state))){interrupted.push({tabId:j.facebookTabId,id:j.id,token:j.token});j.pauseRequestedAt=new Date().toISOString();if(j.submittedAt)continue;transfers.get(j.id)?.abort();j.resumeFacebookTabId=j.facebookTabId;j.resumeDraftText=j.post.text;j.token=crypto.randomUUID();j.state='queued';j.stage='paused';j.runnerTabId=null;const p=d.posts.find(p=>p.id===j.postId);if(p)p.state='queued';}
   await write(d);return interrupted;});
  await Promise.allSettled(interrupted.filter(j=>Number.isInteger(j.tabId)).map(j=>chrome.scripting.executeScript({target:{tabId:j.tabId},func:(id,token)=>{if(document.documentElement.dataset.facebookDeskJob===id&&document.documentElement.dataset.facebookDeskToken===token){delete document.documentElement.dataset.facebookDeskJob;delete document.documentElement.dataset.facebookDeskToken;}},args:[j.id,j.token]})));
  return true;
 }
 const bot=d=>d.bot||(d.bot=botDefaults());
 const job=(d,id)=>{const j=bot(d).jobs.find(j=>j.id===id);if(!j)throw Error('Không tìm thấy lượt chạy.');return j;};
 const active=j=>!terminalStates.includes(j.state)&&j.state!=='queued';
 const runnable=(b,j)=>b.enabled && (!b.cardsOnly || j.cardScheduled);
 function useThreeMinuteSchedule(b,now=Date.now()){
  if(b.threeMinuteSchedule)return false;
  b.threeMinuteSchedule=true;
  b.intervalMinutes=DEFAULT_INTERVAL_MINUTES;
  const queued=b.jobs.filter(j=>j.state==='queued'&&j.scheduleMode==='default')
   .sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt));
  if(queued.length){
   const first=Math.max(now,Date.parse(queued[0].dueAt)||now);
   queued.forEach((j,index)=>{
    j.dueAt=new Date(first+index*DEFAULT_GAP_MS).toISOString();
    j.minGapMs=DEFAULT_GAP_MS;
   });
  }
  return true;
 }
 const detectActor=detectAccount;
 let creatingRunner;
 async function ensureRunner(){if(!creatingRunner)creatingRunner=checkRunner().finally(()=>{creatingRunner=null;});return creatingRunner;}
 async function checkRunner(){
  const d=await db(),b=bot(d);
  if(!b.enabled||!b.jobs.some(j=>runnable(b,j)&&j.state==='queued')){
   if(b.runnerTabId&&!b.jobs.some(active)){
    const old=b.runnerTabId;
    await lock(async()=>{const fresh=await db(),state=bot(fresh);
     if(state.runnerTabId!==old||state.jobs.some(active)||state.jobs.some(j=>runnable(state,j)&&j.state==='queued'))return;
     try{const t=await chrome.tabs.get(old);if(t.url===chrome.runtime.getURL('runner.html'))await chrome.tabs.remove(old);}catch{}
     state.runnerTabId=null;await write(fresh);
    });
   }
   return;
  }
  if(b.runnerTabId)try{const t=await chrome.tabs.get(b.runnerTabId);if(t.url===chrome.runtime.getURL('runner.html')){if(t.autoDiscardable)await chrome.tabs.update(t.id,{autoDiscardable:false});return;}}catch{}
  const t=await chrome.tabs.create({url:chrome.runtime.getURL('runner.html'),active:false});await chrome.tabs.update(t.id,{autoDiscardable:false});await lock(async()=>{const latest=await db();bot(latest).runnerTabId=t.id;await write(latest);});
 }
 let lookupBusy=false;
 async function recover(jobId){
  if(lookupBusy){if(jobId)throw Error('Bot đang tìm link cho lượt khác.');return;}
  lookupBusy=true;
  try {
   const d=await db();
   const pending=j=>j.submittedAt && ['unknown','partial'].includes(j.state) && !j.postUrl;
   const short=j=>String(j.post.text||'').normalize('NFKC').replace(/[\s\u200b-\u200f\u034f\ufe0e\ufe0f]/gu,'').length<12;
   const due=bot(d).jobs.filter(j=>pending(j)&&(jobId||!short(j)||j.receiptLinks?.length===1)&&(jobId?j.id===jobId:(!j.lookupAt||Date.now()>=(j.nextLookup||0))))
    .sort((a,b)=>(a.lookupAt||0)-(b.lookupAt||0)).slice(0,jobId?1:3);
   let lookupTab;
   try{for(const j of due){
    let proof,reason;
    try{
     if(j.receiptLinks?.length===1)proof={url:j.receiptLinks[0],textMatch:true,authorMatch:true,source:'Thông báo Xem bài viết'};
     else{
      if(short(j))throw Error('Bài ngắn hoặc chỉ có media: chưa có link từ thông báo Facebook. Không tự đăng lại.');
      if(!lookupTab)lookupTab=await openWorkTab({url:fbUrl(j.actor.url),active:true},'lookup:'+j.id,true);
      proof=await findPublished(j,lookupTab.id);
     }
    }catch(e){reason=e.message;}
   await lock(async()=>{
    const fresh=await db(),current=job(fresh,j.id);
    if(!pending(current))return;
    current.lookupAt=Date.now();
    if(!proof){current.lookupAttempts=(current.lookupAttempts||0)+1;current.nextLookup=Date.now()+Math.min(3,current.lookupAttempts)*60000;current.error=reason;await write(fresh);return;}
    if(bot(fresh).jobs.some(other=>other.id!==current.id && other.postUrl===proof.url && other.postId!==current.postId)){
     current.error='Link này đã thuộc bài khác.';current.nextLookup=Date.now()+3*60000;await write(fresh);return;
    }
    const state=current.backdate?'partial':'success';
    current.state=state;current.postUrl=proof.url;current.verification={...current.verification,...proof,state};
    current.error=current.backdate?'Đã tìm thấy bài. Cần kiểm tra ngày đăng.':'';
    const post=fresh.posts.find(p=>p.id===j.postId);
    if(post){post.state=state;post.postUrl=proof.url;}
    event(fresh,current.post,state,current.error||'Đã tự tìm thấy bài trên trang cá nhân.',proof.url);
    await write(fresh);
   });
   }}finally{if(lookupTab)await closeWorkTab(lookupTab.id);}
  }finally{lookupBusy=false;}
 }
 function recordOutcome(d,j,state,message,now=Date.now()){
  const b=bot(d),p=d.posts.find(post=>post.id===j.postId);
  j.state=state;j.error=message;j.finishedAt=new Date(now).toISOString();
  if(p){p.state=state==='failed'?'error':state;if(j.postUrl)p.postUrl=j.postUrl;}
  if(state==='failed'&&b.enabled&&runnable(b,j))advanceDefaultQueue(b.jobs.filter(candidate=>runnable(b,candidate)),now);
  event(d,j.post,state,message,j.postUrl);
 }
 async function heartbeat(){
  await lock(async()=>{
   const d=await db(),b=bot(d),now=Date.now();
   let changed=false;
   for(const j of b.jobs){
    if(j.state==='queued'&&(j.attempt||1)>1&&j.lastFailure&&!j.submittedAt){
     j.stage='finished';
     recordOutcome(d,j,'failed',j.lastFailure,now);
     changed=true;
    }else if(active(j)&&now-Date.parse(j.heartbeatAt||j.startedAt)>180000){
     j.stage='interrupted';
     recordOutcome(d,j,j.submittedAt?'unknown':'failed',j.submittedAt?'Mất liên lạc sau bước đăng. Kiểm tra Facebook.':'Lượt chạy bị gián đoạn trước khi đăng.',now);
     changed=true;
    }
   }
   if(useThreeMinuteSchedule(b,now))changed=true;
   if(changed)await write(d);
  });
  await ensureRunner();
  await sweepWorkTabs(bot(await db()).jobs);
  await taskSlot(()=>recover());
 }
 async function handle(msg,sender){
  const isRunner=sender.url===chrome.runtime.getURL('runner.html');
  if(msg.type==='bot-ui-choice'){
   const d=await db(),j=job(d,msg.jobId);
   if(!bot(d).enabled||j.token!==msg.token||j.facebookTabId!==sender.tab?.id||j.state!=='running')throw Error('Phiên chọn mục đã kết thúc.');
   if(!['actor','location','composer'].includes(msg.kind)||!Array.isArray(msg.options)||!msg.options.length||msg.options.length>30)throw Error('Danh sách lựa chọn không hợp lệ.');
   const target=msg.kind==='location'?j.post.location:j.actor;
   return chooseAI(msg.kind,target,msg.options.map(x=>String(x).slice(0,400)),d.settings);
  }
  if(msg.type==='bot-find-link'){const ran=await taskSlot(async()=>{await recover(msg.jobId);return true;});if(!ran)throw Error('Một lượt Facebook khác đang chạy.');return true;}
  if(msg.type==='bot-plan'){
   const actor=await detectActor(),d=await db();const ids=msg.ids;if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw Error('Chọn từ 1 đến 100 bài khác nhau.');const posts=ids.map(id=>{const p=d.posts.find(p=>p.id===id);if(!p)throw Error('Bài không tồn tại.');return p;});const input=planningInput(posts,d.sources),signature=JSON.stringify({posts,input,settings:d.settings});
   const items=needsScheduleAI(input)?await planAI(input,d.settings):validatePlan(input,{items:directPlan(input),error:''});
   return lock(async()=>{const latest=await db(),b=bot(latest);const latestPosts=ids.map(id=>latest.posts.find(p=>p.id===id));if(latestPosts.some(p=>!p)||JSON.stringify({posts:latestPosts,input:planningInput(latestPosts,latest.sources,Date.parse(input.now)),settings:latest.settings})!==signature)throw Error('Nguồn/bài đã đổi trong lúc lập lịch. Hãy thử lại.');if(b.jobs.some(j=>!terminalStates.includes(j.state)&&j.actor.url!==actor.url))throw Error('Nick đang đăng nhập khác nick của hàng chờ cũ. Hủy hàng chờ cũ trước.');b.actor=actor;b.plan={id:crypto.randomUUID(),ids,items,signature,createdAt:input.now,settings:d.settings};await write(latest);return {id:b.plan.id,actor,items};});
  }
  if(msg.type==='bot-bind'){
   const tab=await chrome.tabs.get(msg.tabId);fbUrl(tab.url);const r=(await chrome.scripting.executeScript({target:{tabId:tab.id},func:facebookBot,args:['identity',{}]}))[0]?.result;if(!r?.ok)throw Error(r?.error||'Không đọc được tài khoản.');
   return lock(async()=>{const d=await db();if(bot(d).jobs.some(j=>!terminalStates.includes(j.state)))throw Error('Dừng và hủy các bài trong hàng chờ trước khi đổi tài khoản.');bot(d).actor=r.actor;await write(d);return r.actor;});
  }
  if(msg.type==='bot-enqueue'){
   const result=await lock(async()=>{
    const d=await db(),b=bot(d),ids=msg.ids;if(!Array.isArray(ids)||!ids.length||ids.length>100)throw Error('Chọn từ 1 đến 100 bài.');const plan=b.plan;if(!plan||plan.id!==msg.planId||JSON.stringify(plan.ids)!==JSON.stringify(ids))throw Error('Cần quét timeline trước khi xếp lịch.');const posts=ids.map(id=>d.posts.find(p=>p.id===id));if(posts.some(p=>!p)||JSON.stringify({posts,input:planningInput(posts,d.sources,Date.parse(plan.createdAt)),settings:d.settings})!==plan.signature)throw Error('Nội dung đã đổi sau khi lập lịch. Quét lại timeline.');
    const auto=msg.intervalMinutes!==undefined;
    const minutes=auto?msg.intervalMinutes:DEFAULT_INTERVAL_MINUTES;
    const now=Date.now(),gap=minutes*60000;
    if(!Number.isSafeInteger(minutes)||minutes<1||!Number.isFinite(new Date(now+(ids.length+1)*gap).getTime()))throw Error('Tần suất phải là số phút nguyên dương hợp lệ.');
    useThreeMinuteSchedule(b,now);
    const replaced=new Map(b.jobs.filter(j=>auto && ids.includes(j.postId) && j.state==='queued' && !['manual','explicit'].includes(j.scheduleMode)).map(j=>[j.postId,j]));
    const keep=b.jobs.filter(j=>!replaced.has(j.postId)||j!==replaced.get(j.postId));
    const staged=[];
    for(const slot of assignSlots(plan.items,keep,now,gap)){
     const post=posts.find(p=>p.id===slot.id);
     if(msg.resetUnsent&&!resetCandidate(post,b.jobs))throw Error('Tiến độ đã đổi. Mở lại danh sách trước khi xếp lịch.');
     const copy={...(msg.resetUnsent?resetCopy(post):post),time:slot.mode==='explicit'?slot.time:''};
     const fresh=createJob(copy,{target:b.actor.url},b.actor,[...keep,...staged]);
     const previous=replaced.get(post.id);
     if(previous){fresh.id=previous.id;fresh.attempt=previous.attempt||1;fresh.lastFailure=previous.lastFailure;}
     Object.assign(fresh,{dueAt:slot.dueAt,minGapMs:slot.minGapMs,scheduleMode:slot.mode,planningTime:post.time||'',cardScheduled:auto});
     staged.push(fresh);
    }
    b.jobs=[...keep,...staged];b.plan=null;
    if(auto){b.enabled=true;b.cardsOnly=false;b.intervalMinutes=minutes;}
    for(const j of staged){
     const post=posts.find(p=>p.id===j.postId);post.state='queued';
     event(d,j.post,'queued',(j.scheduleMode==='default'?'Cách '+minutes+' phút':'Theo kịch bản')+': '+j.dueAt);
    }
    await write(d);return staged.map(publicJob);
   });
   if(msg.intervalMinutes!==undefined)await ensureRunner();
   return result;
  }
  if(msg.type==='bot-card-schedule'){
   const actor=await detectActor();
   const result=await lock(async()=>{
    const d=await db(), b=bot(d), post=d.posts.find(p=>p.id===msg.id);
    if(!post)throw Error('Không tìm thấy bài.');
    
    if(b.jobs.some(j=>!terminalStates.includes(j.state)&&j.actor.url!==actor.url))throw Error('Tài khoản hàng chờ khác tài khoản Facebook hiện tại.');
    const previous=b.jobs.find(j=>j.postId===post.id&&!['failed','cancelled'].includes(j.state));
    if(previous && previous.state!=='queued')throw Error('Bài đang xử lý hoặc đã đăng.');
    const now=Date.now(), instant=msg.mode==='now';
    const gap=instant?60000:0;
    const last=Math.max(0,...b.jobs.filter(j=>j!==previous && j.scheduleMode==='now' && ['queued','running','verifying'].includes(j.state)).map(j=>Date.parse(j.dueAt)),...b.jobs.map(j=>Date.parse(j.submittedAt)||0));
    const due=instant?Math.max(now,last+gap):Date.parse(msg.dueAt);
    if(!Number.isFinite(due)||(!instant&&due<=now))throw Error('Chọn ngày giờ trong tương lai.');
    const j=previous||createJob({...post,time:''},{target:actor.url},actor,b.jobs);
    Object.assign(j,{dueAt:new Date(due).toISOString(),backdate:false,requestedTime:null,minGapMs:gap,scheduleMode:instant?'now':'manual',cardScheduled:true});
    if(!previous)b.jobs.push(j);
    if(!b.enabled){b.cardsOnly=true;for(const other of b.jobs)if(other!==j)other.cardScheduled=false;}
    b.enabled=true;b.actor=actor;b.plan=null;post.state='queued';
    event(d,post,'queued','Đã lên lịch: '+j.dueAt);await write(d);return j.dueAt;
   });
   await ensureRunner();return result;
  }
  if(msg.type==='bot-start'){const currentActor=await detectActor();await lock(async()=>{const d=await db(),b=bot(d);if(!b.actor)b.actor=currentActor;if(b.jobs.some(j=>j.state==='queued'&&j.actor.url!==currentActor.url))throw Error('Nick hiện tại khác nick của hàng chờ. Hủy hàng chờ cũ rồi tạo lại.');b.pauseReason='';b.cardsOnly=false;b.enabled=true;await write(d);});await ensureRunner();return true;}
  if(msg.type==='bot-pause')return pause();
  if(msg.type==='bot-cancel')return lock(async()=>{const d=await db(),j=job(d,msg.jobId);if(j.state!=='queued')throw Error('Chỉ hủy được bài chưa chạy. Dùng Dừng bot cho bài đang xử lý.');j.state='cancelled';const p=d.posts.find(p=>p.id===j.postId);if(p)p.state='draft';event(d,j.post,'cancelled','Đã hủy lượt tự đăng.');await write(d);return true;});
  if(msg.type==='bot-reconcile')return lock(async()=>{const d=await db(),j=job(d,msg.jobId);if(!['partial','unknown'].includes(j.state)&&!(j.state==='verifying'&&j.submittedAt&&!j.backdate))throw Error('Lượt này không cần đối soát.');const url=canonicalPost(msg.url);if(!url)throw Error('Cần link bài đăng cụ thể.');j.postUrl=url;j.state='success';j.manualReconciliation=true;event(d,j.post,'success','Người dùng đối soát và xác nhận bài đã đăng đúng kịch bản.',url);const p=d.posts.find(p=>p.id===j.postId);if(p){p.state='success';p.postUrl=url;}await write(d);return true;});
  if(msg.type==='bot-receipt')return lock(async()=>{
   const d=await db(),j=job(d,msg.jobId);
   if(!j.submittedAt||sender.tab?.id!==j.facebookTabId||msg.token!==j.token||!Array.isArray(msg.links))return false;
   const actorId=new URL(j.actor.url).searchParams.get('id');
   const links=msg.links.map(canonicalPost).filter(link=>{
    if(!link||link.includes('/photo.php?')||j.prior?.includes(link))return false;
    const owner=new URL(link).searchParams.get('id');return !owner||!actorId||actorId===owner;
   });
   j.receiptLinks=[...new Set([...(j.receiptLinks||[]),...links])];await write(d);return true;
  });
  if(msg.type==='bot-waiting-submit')return lock(async()=>{const d=await db(),b=bot(d),j=job(d,msg.jobId);if(sender.tab?.id!==j.facebookTabId||msg.token!==j.token||!b.enabled||j.state!=='running'||j.submittedAt)throw Error('Lượt chờ đăng không còn hiệu lực.');const until=Date.now()+Math.max(0,Math.min(60000,Number(msg.waitMs)||0));if(j.stage!=='waiting-submit'||Math.abs((j.waitUntil||0)-until)>500){j.stage='waiting-submit';j.waitUntil=until;j.heartbeatAt=new Date().toISOString();await write(d);}return true;});
  if(msg.type==='bot-clicked')return lock(async()=>{const d=await db(),j=job(d,msg.jobId);if(sender.tab?.id!==j.facebookTabId||msg.token!==j.token||j.state!=='verifying'||!j.submittedAt)throw Error('Không xác nhận được lượt bấm.');if(!j.clickDispatchedAt){j.clickDispatchedAt=new Date().toISOString();j.stage='click-dispatched';await write(d);}return true;});
  if(msg.type==='bot-permit')return lock(async()=>{const d=await db(),b=bot(d),j=job(d,msg.jobId);if(sender.tab?.id!==j.facebookTabId||msg.token!==j.token||!b.enabled||j.state!=='running'||j.submittedAt)throw Error('Không cấp lượt đăng: sai tab, bot đã dừng hoặc đã dùng lượt.');const {deskPersonas}=await chrome.storage.local.get('deskPersonas');const checked=filterCaptionName(structuredClone(j.post),deskPersonas,d.sources,j.actor);if(checked.count)throw Error('Bộ lọc tên: caption vẫn còn tên tài khoản gốc; dừng trước khi đăng.');const expected=j.expectedMedia||j.post.media.map(m=>m.type),proof=msg.mediaProof;if(!proof||proof.jobId!==j.id||proof.token!==j.token||proof.count!==expected.length||proof.images!==expected.filter(t=>t==='image').length||proof.videos!==expected.filter(t=>t==='video').length||(expected.length&&(!j.mediaProofId||proof.proofId!==j.mediaProofId)))throw Error('Dừng an toàn: bộ điều khiển chưa xác nhận đủ media. Không đăng riêng caption.');if(!msg.audienceProof||msg.audienceProof.jobId!==j.id||msg.audienceProof.token!==j.token||!['default','public'].includes(msg.audienceProof.mode))throw Error('Chưa xác nhận chế độ đối tượng cho lượt đăng.');j.state='verifying';j.stage='submit-recorded';j.submittedAt=new Date().toISOString();j.heartbeatAt=j.submittedAt;await write(d);return true;});
  if(msg.type==='bot-abort-before-click')return lock(async()=>{const d=await db(),j=job(d,msg.jobId);if(sender.tab?.id!==j.facebookTabId||msg.token!==j.token||j.state!=='verifying'||j.clickDispatchedAt||j.receiptLinks?.length)throw Error('Không thể hủy lượt đã gửi.');j.state='running';j.submittedAt=null;j.stage='blocked-before-click';j.error=String(msg.reason||'Media biến mất trước khi bấm Đăng.').slice(0,1000);await write(d);return true;});
  if(msg.type.startsWith('runner-')&&!isRunner)throw Error('Chỉ trang chạy bot được gọi thao tác này.');
  if(msg.type==='runner-claim')return lock(async()=>{const d=await db(),b=bot(d);if(!b.enabled||b.jobs.some(active))return null;if(useThreeMinuteSchedule(b))await write(d);const j=b.jobs.filter(j=>j.state==='queued'&&!(j.attempt>1&&j.lastFailure)&&runnable(b,j)&&canClaim(j,b.jobs)).sort((a,b)=>Number(b.scheduleMode==='now')-Number(a.scheduleMode==='now')||Date.parse(a.dueAt)-Date.parse(b.dueAt))[0];if(!j)return null;const {deskPersonas}=await chrome.storage.local.get('deskPersonas');const latest=d.posts.find(p=>p.id===j.postId);if(latest?.captionNameFilter?.status==='blocked'){j.stage='finished';recordOutcome(d,j,'failed',latest.captionNameFilter.message);await write(d);return null;}try{j.post.captionNameFilter=filterCaptionName(j.post,deskPersonas,d.sources,j.actor);}catch(error){j.stage='finished';recordOutcome(d,j,'failed',error.message);await write(d);return null;}j.state='running';j.stage='opening';j.startedAt=new Date().toISOString();j.heartbeatAt=j.startedAt;j.runnerTabId=sender.tab?.id;await write(d);return structuredClone(j);});
  if(msg.type==='runner-touch'||msg.type==='runner-progress')return lock(async()=>{const d=await db(),b=bot(d),j=job(d,msg.jobId);if(msg.token!==j.token||j.runnerTabId!==sender.tab?.id||!active(j))throw Error('Lượt chạy không còn hiệu lực.');j.heartbeatAt=new Date().toISOString();if(msg.type==='runner-progress'){j.stage=String(msg.stage||'').slice(0,80);if(msg.facebookTabId){const t=await chrome.tabs.get(msg.facebookTabId);fbUrl(t.url);j.facebookTabId=msg.facebookTabId;}if(msg.evidence){j.evidence.push(msg.evidence);if(msg.evidence.type==='media'&&msg.evidence.count===(j.expectedMedia||j.post.media).length&&typeof msg.evidence.proofId==='string')j.mediaProofId=msg.evidence.proofId;}if(msg.prior)j.prior=msg.prior;}await write(d);return {enabled:b.enabled,submitted:!!j.submittedAt};});
  if(msg.type==='runner-media-chunk'||msg.type==='runner-media-release'){
   const d=await db(),j=job(d,msg.jobId);if(msg.token!==j.token||j.runnerTabId!==sender.tab?.id)throw Error('Bot đã dừng.');
   const owner=j.id+':'+j.token;if(msg.type==='runner-media-release')return mediaRelease(owner);
   if(!bot(d).enabled||j.state!=='running')throw Error('Bot đã dừng.');return mediaChunk(msg.transferId,msg.index,owner);
  }
  if(msg.type==='runner-media'){
   const d=await db(),j=job(d,msg.jobId);if(msg.token!==j.token||j.runnerTabId!==sender.tab?.id||!bot(d).enabled||j.state!=='running')throw Error('Bot đã dừng.');const m=j.post.media[msg.index];if(!m)throw Error('Media không tồn tại.');const controller=new AbortController();transfers.set(j.id,controller);const timer=setTimeout(()=>controller.abort(),900000);try{return await mediaFile(m,msg.index,{signal:controller.signal,owner:j.id+':'+j.token});}finally{clearTimeout(timer);if(transfers.get(j.id)===controller)transfers.delete(j.id);}
  }
  if(msg.type==='runner-finish')return lock(async()=>{const d=await db(),b=bot(d),j=job(d,msg.jobId);if(msg.token!==j.token||j.runnerTabId!==sender.tab?.id||!active(j))throw Error('Lượt chạy không còn hiệu lực.');let state=msg.result.state;
   // 3.8.6: lỗi xảy ra TRƯỚC khi bấm Đăng (chưa có submittedAt) được tự thử lại 1 lần với tab mới.
   if(state==='failed'&&!j.submittedAt&&!j.clickDispatchedAt&&!j.receiptLinks?.length&&!j.autoRetried&&b.enabled&&!/Dựng MP|Media Bridge|Media nguồn|vượt|thiếu tệp|caption|Bộ lọc tên|Sai tài khoản|khác nick|khác tài khoản|đăng nhập|kiểm tra tài khoản|Bot đã dừng/i.test(String(msg.result.message||''))){
    try{await mediaRelease?.(j.id+':'+j.token);}catch{}
    Object.assign(j,{state:'queued',stage:'retry',autoRetried:true,previousError:String(msg.result.message||'').slice(0,1000),token:crypto.randomUUID(),dueAt:new Date(Date.now()+90000).toISOString(),runnerTabId:null,facebookTabId:null,resumeFacebookTabId:null,resumeDraftText:null,mediaProofId:null,evidence:[],error:''});
    const p=d.posts.find(p=>p.id===j.postId);if(p)p.state='queued';
    event(d,j.post,'queued','Tự thử lại sau lỗi trước khi đăng: '+String(msg.result.message||'').slice(0,300));await write(d);return {state:'queued'};
   }const url=canonicalPost(msg.result.url);if(!terminalStates.includes(state))throw Error('Trạng thái không hợp lệ.');if(state==='success'&&(!j.submittedAt||!url||!msg.result.textMatch||!msg.result.authorMatch||(j.backdate&&!msg.result.dateVerified)))throw Error('Thiếu bằng chứng đăng thành công.');if(j.submittedAt&&['failed','cancelled'].includes(state))state='unknown';j.postUrl=url;j.verification=msg.result;j.stage='finished';b.lastFinishedAt=Date.now();recordOutcome(d,j,state,String(msg.result.message||'Bot đã đăng và xác minh link.'),b.lastFinishedAt);await write(d);return {state:j.state};});
  return undefined;
 }
 return {handle,heartbeat,ensureRunner,pause};
}

