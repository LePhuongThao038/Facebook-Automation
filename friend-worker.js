import {detectAccount} from './account.js';
import {validateRegistry,readiness,accountUID} from './persona-model.js';
import {taskSlot} from './run-control.js';
import {openWorkTab,closeWorkTab} from './work-tabs.js';
import {facebookBot} from './facebook-bot.js';
import {waitFacebookTab} from './tab-ready.js';
import {friendPage} from './friend-page.js';
import {targetOf,rowsFor,todayVN,parseTargets,parseNamedTargets,sheetId,DEFAULT_SHEET} from './friend-model.js';
const SLOT='friendDesk1',sleep=ms=>new Promise(r=>setTimeout(r,ms));
let serial=Promise.resolve(),working=false,syncing=false;
function dailyLimit(plan,rows){
 if(plan.rate!=='auto')return plan.daily;
 const recent=rows.filter(r=>r.state!=='queued').slice(-20);
 if(recent.some(r=>['error','uncertain'].includes(r.state)))return 5;
 return recent.filter(r=>r.state==='accepted').length>=5?20:10;
}
const fresh=()=>({rows:[],config:{sheet:DEFAULT_SHEET},enabled:false,stage:'Sẵn sàng'});
const read=async()=>(await chrome.storage.local.get(SLOT))[SLOT]||fresh();
function change(fn){const job=serial.then(async()=>{const d=await read(),ret=await fn(d);await chrome.storage.local.set({[SLOT]:d});return ret;});serial=job.catch(()=>{});return job;}
function touch(r){r.at=new Date().toISOString();r.rev=crypto.randomUUID();}
function checkSettings(m){
 const count=Number(m.count),daily=m.daily==='auto'?10:Number(m.daily);
 if(!Number.isSafeInteger(count)||count<1||count>10000||!Number.isSafeInteger(daily)||daily<1||daily>1440||!['none','light','medium','deep'].includes(m.warm))throw Error('Số lượng phải từ 1–10000, tần suất từ 1–1440/ngày.');
 return {count,daily,warm:m.warm,rate:m.daily};
}
async function withTab(url,fn){
 const t=await openWorkTab({url,active:false},'friend-task');
 let timeout;
 try{
  await waitFacebookTab(t.id,id=>chrome.tabs.get(id),sleep);
  const expired=new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('Trang Facebook phản hồi quá lâu.')),1800000);});
  return await Promise.race([fn(t.id),expired]);
 }finally{clearTimeout(timeout);await closeWorkTab(t.id);}
}
async function inject(tabId,func,args){return (await chrome.scripting.executeScript({target:{tabId},func,args}))[0]?.result;}
const actorNow=detectAccount;
function deferRow(row,reason){
 row.attempts=(row.attempts||0)+1;
 row.retryAt=Date.now()+Math.min(60,2**Math.min(row.attempts-1,6))*60000;
 row.state='queued';row.error=reason;row.stage='Chờ tự thử lại';touch(row);
}
function activeRow(d){return d.rows.find(r=>r.token&&r.token===d.active);}
async function sourceTargets(source,limit){
 if(!source.trim())return [];
 const u=new URL(source.trim());
 if(u.protocol!=='https:')throw Error('Link nguồn phải dùng HTTPS.');
 if(['www.facebook.com','facebook.com'].includes(u.hostname)){
  if(!/\/friends(?:\/|$)/.test(u.pathname)&&u.searchParams.get('sk')!=='friends')throw Error('Dán link trang danh sách bạn bè hoặc nhập từng link profile ở ô thủ công.');
  u.hostname='www.facebook.com';return withTab(u.href,async id=>{const r=await inject(id,friendPage,['collect',{limit}]);return parseTargets((r?.urls||[]).join('\n'));});
 }
 if(u.hostname==='docs.google.com'&&u.pathname.startsWith('/spreadsheets/')){
  const gid=u.searchParams.get('gid')||new URLSearchParams(u.hash.slice(1)).get('gid')||'0';
  u.href='https://docs.google.com/spreadsheets/d/'+sheetId(u.href)+'/export?format=csv&gid='+encodeURIComponent(gid);
 }else if(u.hostname==='docs.google.com'&&/^\/document\/d\/[\w-]+/.test(u.pathname)){u.pathname=u.pathname.match(/^\/document\/d\/[\w-]+/)[0]+'/export';u.search='format=txt';}
 const response=await fetch(u.href,{credentials:u.hostname==='docs.google.com'?'include':'omit',signal:AbortSignal.timeout(20000)});
 if(!response.ok||/html/i.test(response.headers.get('content-type')||''))throw Error('Nguồn cần là danh sách TXT/CSV hoặc Google Sheet/Docs mà Profile được phép đọc.');
 const text=await response.text();if(text.length>2000000)throw Error('Nguồn quá lớn.');return parseNamedTargets(text);
}
async function sendSheet(config,body){
 const u=new URL(config.endpoint);
 if(u.origin!=='https://script.google.com'||!/^\/macros\/s\/[\w-]+\/exec$/.test(u.pathname))throw Error('Cần URL Web app /exec của Apps Script.');
 if(!config.key)throw Error('Cần nhập khóa kết nối từ Apps Script.');
 const res=await fetch(u.href,{method:'POST',credentials:'omit',body:JSON.stringify({...body,key:config.key,sheet:sheetId(config.sheet)}),signal:AbortSignal.timeout(25000)});
 if(!res.ok)throw Error('Google Sheets trả HTTP '+res.status);
 let result;try{result=await res.json();}catch{throw Error('Web app chưa cho phép truy cập hoặc cần triển khai lại.');}
 if(!result.ok)throw Error(result.error||'Ghi Sheet thất bại.');return result;
}
async function sync(){
 if(syncing)return;syncing=true;
 try{const d=await read();if(!d.config.endpoint||!d.config.key)return;
 const dirty=d.rows.filter(r=>!r.internalClones&&r.rev!==r.synced&&r.state!=='queued');if(!dirty.length)return;
 const actor=dirty[0].actor,items=dirty.filter(r=>r.actor.url===actor.url).slice(0,40);
 await sendSheet(d.config,{actor,rows:items.map(r=>({id:r.target.id,name:r.name||'',date:new Date(r.at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}),warm:r.warmLog||'',send:r.send||'',relation:r.response||'',detail:r.error||r.stage||''}))});
 await change(s=>{for(const r of items){const x=s.rows.find(y=>y.id===r.id);if(x)x.synced=r.rev;}s.syncError='';});
 }catch(e){await change(d=>d.syncError=e.message);}finally{syncing=false;}
}
export function makeFriends(commentAI){
 function tick(){return taskSlot(runTick);}
 async function runTick(){
 if(working)return;working=true;
 try{const s=await read(),old=activeRow(s);
 if(old){await change(d=>{const r=activeRow(d);if(!r)return;if(!d.scan&&r.state==='queued'&&!r.sentAt)deferRow(r,'Lượt trước bị gián đoạn.');
 else if(!d.scan&&r.state==='queued'){r.state='uncertain';r.error='Đã bắt đầu gửi trước khi gián đoạn. Cần quét phản hồi.';}touch(r);delete r.token;delete d.active;});}
 const d=await read();
 if(!d.enabled&&!d.scan){
  if(!d.pausedByUser&&d.plan&&d.actor&&/Không nhận diện được nick|Nick đăng nhập đã đổi|Tab Facebook chưa tải xong/i.test(d.stage)&&rowsFor(d,d.actor).some(r=>r.state==='queued')){
   await change(state=>{if(!state.pausedByUser)state.enabled=true;});
  }
  return;
 }
 if(Date.now()<(d.actorRetryAt||0))return;
 if(d.enabled&&!d.retryVersion){
  await change(state=>{
   if(!state.enabled)return;
   for(const row of rowsFor(state,state.actor)){
    if(row.campaign===state.campaign&&row.state==='error'&&!row.sentAt)deferRow(row,row.error||'Chưa gửi được.');
   }
   state.retryVersion=1;
  });
  if(d.rows.some(r=>r.campaign===d.campaign&&r.state==='error'&&!r.sentAt))return;
 }
 const prior=rowsFor(d,d.actor);
 const row=d.scan?prior.find(r=>d.scan.includes(r.id)):prior.find(r=>r.state==='queued'&&!(r.retryAt>Date.now()));
 if(!row&&!d.scan&&prior.some(r=>r.state==='queued'))return;
 if(!row){await change(s=>{if(s.scan)delete s.scan;else s.enabled=false;s.stage='Hoàn tất';});return;}
 if(!d.scan&&(Date.now()<(d.next||0)||prior.filter(r=>r.sentAt&&todayVN(r.sentAt)===todayVN(Date.now())).length>=dailyLimit(d.plan,prior)))return;
 const actor=await actorNow();if(actor.url!==d.actor.url)throw Error('Nick đăng nhập đã đổi. Hãy chuyển về '+d.actor.name+' rồi tiếp tục.');
 const token=crypto.randomUUID(),scanning=!!d.scan;
 const claimed=await change(s=>{if((!s.enabled&&!s.scan)||s.actor.url!==actor.url)return false;const r=s.rows.find(x=>x.id===row.id);s.actorFailures=0;delete s.actorRetryAt;delete r.retryAt;delete r.internalActionAt;r.error='';r.token=token;r.stage=scanning?'Đang quét phản hồi':'Đang mở trang cá nhân';s.active=token;s.stage=(scanning?'Quét ':'Mở ')+row.target.id;return true;});if(!claimed)return;
 try{
 const result=await withTab(row.target.url,async id=>{
 await change(s=>{const r=activeRow(s);if(!r||r.token!==token)throw Error('Đã dừng.');r.tab=id;});
 return inject(id,friendPage,[scanning&&!row.internalClones?'scan':'work',{target:row.target,warm:row.warm,token,acceptIncoming:row.internalClones===true}]);});
 if(!result||result.error)throw Error(result?.error||'Facebook không phản hồi.');
 await change(s=>{const r=activeRow(s);if(!r)return;
 r.name=result.name||r.name;r.warmLog=result.warm||r.warmLog;r.error='';
 switch(result.relation){
 case 'friends':r.state='accepted';r.response=(scanning||r.sentAt)?'Đã chấp nhận':'Đã là bạn';r.send=r.send||'Đã là bạn';break;
 case 'pending': case 'sent':r.state='sent';r.send='Đã gửi kết bạn';r.response='';break;
 case 'add':r.state='review';r.response='';r.send='Không còn thấy lời mời';r.error='Không đủ bằng chứng kết luận bị từ chối.';break;
 case 'rejected':r.state='rejected';r.response='Bị từ chối';break;
 case 'incoming':r.state='review';r.send='Có lời mời đến';break;
 default:r.state='uncertain';r.send='Chờ đối soát';}
 r.stage=r.send;touch(r);});
 }catch(e){await change(s=>{const r=activeRow(s);if(r){if(!scanning&&!r.sentAt){deferRow(r,e.message);}else{if(!scanning)r.state='uncertain';r.error=e.message;r.stage='Lỗi';}touch(r);}});}
 finally{await change(s=>{const r=activeRow(s);if(r){delete r.tab;delete r.token;}delete s.active;if(s.scan)s.scan=s.scan.filter(id=>id!==row.id);if(!scanning&&r?.state!=='queued')s.next=Date.now()+Math.ceil(86400000/dailyLimit(s.plan,rowsFor(s,s.actor)));
 if(!s.scan&&!rowsFor(s,s.actor).some(x=>x.state==='queued'))s.enabled=false;s.stage=s.pausedByUser&&!s.scan?'Đã dừng theo yêu cầu':s.enabled?'Chờ lượt kế tiếp':s.scan?'Đang quét':'Đã dừng hoặc hoàn tất';});}
 }catch(e){await change(d=>{if(!d.enabled&&!d.scan)return;
 d.actorFailures=(d.actorFailures||0)+1;
 d.actorRetryAt=Date.now()+Math.min(15,2**Math.min(4,d.actorFailures-1))*60000;
 d.stage='Chờ tự kiểm tra lại · '+e.message;});}finally{working=false;await sync();}
 }
 async function handle(m,sender){
 let poolUid='';
 if(['friends-pool-publish','friends-pool-status','friends-pool-poll'].includes(m.type)){
  const d=await read();
  if(m.type==='friends-pool-publish'){
   const result=await sendSheet(d.config,{pool:'publish',uids:m.uids});
   if(!result.plan)throw Error('Cập nhật SheetLog.gs trên Web app.');
   return result;
  }
  if(m.type==='friends-pool-status')return sendSheet(d.config,{pool:'status'});
  const {deskPersonaBinding:binding}=await chrome.storage.local.get('deskPersonaBinding');
  if(!binding?.uid||!d.config.key||d.pausedByUser)return;
  const {plan}=await sendSheet(d.config,{pool:'poll'});
  if(!plan?.uids.includes(binding.uid))return;
  const rows=d.rows.filter(r=>r.internalClones&&accountUID(r.actor.url)===binding.uid&&plan.uids.includes(r.target.id));
  if(d.poolId===plan.id||d.active||d.enabled||d.scan){
   const message='Đã là bạn '+rows.filter(r=>r.state==='accepted').length+' / '+(plan.uids.length-1)+' · đã gửi '+rows.filter(r=>r.state==='sent').length+' · đang chờ '+rows.filter(r=>r.state==='queued').length;
   const reportKey=[plan.id,binding.uid,message].join(':');
   if(reportKey!==d.poolReport){
    await sendSheet(d.config,{pool:'report',id:plan.id,uid:binding.uid,message});
    await change(state=>{state.poolReport=reportKey;});
   }
   return;
  }
  poolUid=binding.uid;
  m={type:'friends-start-clones',poolId:plan.id,uids:plan.uids};
 }
 const poolId=m.poolId;
 const internalStart=m.type==='friends-start-clones',internalScan=m.type==='friends-scan-clones';
 if(['friends-guard','friends-progress','friends-permit','friends-comment','friends-photo'].includes(m.type)){
 const check=d=>{const r=activeRow(d);if(!r||r.token!==m.token||r.tab!==sender.tab?.id||(!d.enabled&&!(d.scan&&r.internalClones))||(r.internalClones?r.internalActionAt:r.sentAt))throw Error('Lượt kết bạn đã dừng.');return r;};
 if(m.type==='friends-photo'){
  check(await read());const u=new URL(m.url);
  if(u.origin!=='https://www.facebook.com'||!/^\/photo(?:\.php|\/)?$/.test(u.pathname)||!/^\d+$/.test(u.searchParams.get('fbid')||''))throw Error('Sai liên kết ảnh.');
  return withTab(u.href,async id=>{
   check(await read());
   return inject(id,async expected=>{
    if(new URL(location.href).searchParams.get('fbid')!==expected)return false;
    const main=document.querySelector('[role=dialog]')||document.querySelector('[role=main],main');if(!main)return false;
    const bs=[...main.querySelectorAll('button,[role=button]')].filter(b=>b.getClientRects().length&&!b.closest('[aria-label*="Comment by"],[aria-label*="Bình luận của"]'));
    const label=b=>(b.getAttribute('aria-label')||b.innerText||'').trim();
    if(bs.some(b=>/^(unlike|bỏ thích)$/i.test(label(b))))return true;
    const fits=bs.filter(b=>/^(like|thích)$/i.test(label(b)));if(fits.length!==1)return false;const warning=globalThis.deskRestriction?.();if(warning)throw Error(warning);fits[0].click();await new Promise(resolve=>setTimeout(resolve,500));return fits[0].getAttribute('aria-pressed')==='true'||[...main.querySelectorAll('button,[role=button]')].some(b=>/^(unlike|bỏ thích)$/i.test(label(b)));
   },[u.searchParams.get('fbid')]);
  });
 }
 if(m.type==='friends-comment'){check(await read());return commentAI(String(m.text||'').slice(0,1800));}
 return change(d=>{const r=check(d);
 if(m.type==='friends-guard'&&m.commentKey){
  const key=String(m.commentKey).slice(0,1800);
  r.commentAttempts||=[];if(r.commentAttempts.includes(key))return false;
  r.commentAttempts.push(key);
 }
 if(m.type==='friends-permit'){r.sentAt=Date.now();if(r.internalClones)r.internalActionAt=r.sentAt;r.send='Đang xử lý kết bạn · chờ Facebook xác nhận';r.stage=d.stage='Đang xử lý kết bạn';}if(m.stage)r.stage=d.stage=m.stage;if(m.name)r.name=m.name;if(m.warm)r.warmLog=m.warm;touch(r);return true;});
 }
 if(sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Sai trang điều khiển.');
 if(m.type==='friends-names'){
  const d=await read();
  if(!d.campaign||d.namesCampaign===d.campaign||!d.rows.some(r=>r.campaign===d.campaign&&!r.name))return;
  const source=d.source||(await chrome.storage.local.get('friendForm')).friendForm?.source;
  if(!source?.startsWith('https://docs.google.com/spreadsheets/d/'))return;
  const names=new Map((await sourceTargets(source,10000)).filter(t=>t.name).map(t=>[t.id,t.name]));
  await change(s=>{if(s.campaign!==d.campaign)return;for(const r of s.rows)if(r.campaign===d.campaign&&!r.name&&names.has(r.target.id))r.name=names.get(r.target.id);s.namesCampaign=d.campaign;});
  return;
 }
 if(m.type==='friends-state'){const d=await read();const {key,...config}=d.config;return {...d,config,hasKey:!!key,rows:d.rows.map(({token,...r})=>({...r,inProgress:!!token&&token===d.active})),active:!!d.active};}
 if(m.type==='friends-save-sheet'){
 const config={sheet:m.sheet||DEFAULT_SHEET,endpoint:m.endpoint.trim(),key:m.key.trim()||(await read()).config.key};
 await sendSheet(config,{ping:true});await change(d=>{if(d.config.sheet!==config.sheet||d.config.endpoint!==config.endpoint)d.rows.forEach(r=>delete r.synced);d.config=config;d.syncError='';});await sync();return true;}
 if(m.type==='friends-sync'){await sync();return true;}
 if(m.type==='friends-stop'){await change(d=>{d.pausedByUser=true;d.enabled=false;delete d.scan;delete d.actorRetryAt;d.stage='Đã dừng theo yêu cầu';});return;}
 if(internalScan){const actor=await actorNow();await change(d=>{if(d.active||d.scan||d.enabled)throw Error('Dừng hàng chờ kết bạn trước khi kiểm tra lại quan hệ nội bộ.');d.actor=actor;d.scan=rowsFor(d,actor).filter(r=>r.internalClones&&r.state!=='queued').map(r=>r.id);});void tick();return;}
 if(m.type==='friends-resume'||m.type==='friends-scan'){const actor=await actorNow();await change(d=>{if(d.active||d.scan)throw Error('Đang có lượt xử lý.');if(m.type==='friends-resume'&&d.actor?.url!==actor.url)throw Error('Sai nick của hàng chờ.');if(m.type==='friends-scan'){if(d.enabled)throw Error('Dừng hàng chờ trước khi quét.');d.scan=rowsFor(d,actor).filter(r=>['sent','uncertain','review'].includes(r.state)).map(r=>r.id);d.actor=actor;}else{if(!d.plan)throw Error('Chưa có hàng chờ.');d.pausedByUser=false;delete d.actorRetryAt;d.enabled=true;}});void tick();return;}
 if(m.type==='friends-start-clones'){
  const registry=validateRegistry((await chrome.storage.local.get('deskPersonas')).deskPersonas),actor=await actorNow(),uid=accountUID(actor.url),current=registry.profiles.find(p=>p.uid===uid&&readiness(p).ready);
  if(!current)throw Error('UID hiện tại chưa khớp một clone đủ hồ sơ trong Sheet.');
  if(poolUid&&poolUid!==uid)throw Error('UID đăng nhập khác UID nhận việc.');
  const peers=m.uids?m.uids.filter(id=>id!==uid).map(uid=>({uid})):registry.profiles.filter(p=>p.id!==current.id&&readiness(p).ready);
  if(!peers.length)throw Error('Chưa có clone khác đủ UID để kết bạn nội bộ.');
  m={type:'friends-start',source:'',manual:peers.map(p=>p.uid).join('\n'),warm:'none',count:peers.length,daily:10,internalClones:true};
 }
 if(m.type==='friends-start'){
 const plan=checkSettings(m),manual=parseTargets(m.manual),source=await sourceTargets(m.source,plan.count),actor=await actorNow();
 if(poolUid&&accountUID(actor.url)!==poolUid)throw Error('Nick đăng nhập đã đổi.');
 const targets=[...new Map([...manual,...source].map(t=>[t.id,t])).values()].filter(t=>t.id!==targetOf(actor.url)?.id);
 await change(d=>{if(poolId&&(d.pausedByUser||d.poolId===poolId))return;
 if(d.active||d.scan||d.enabled)throw Error('Dừng lượt hiện tại trước khi lập danh sách mới.');
 const history=rowsFor(d,actor),seen=new Set(history.map(r=>r.target.id));const added=targets.filter(t=>!seen.has(t.id)).slice(0,plan.count);
 if(poolId&&!added.length){d.poolId=poolId;return;}
 if(!added.length)throw Error('Không có UID/link profile mới hợp lệ.');
 if(history.some(r=>r.state==='queued'))throw Error('Còn hàng chờ của nick này. Bấm Tiếp tục để hoàn tất.');
 if(poolId)d.poolId=poolId;
 d.pausedByUser=false;delete d.actorRetryAt;d.source=m.source;d.actor=actor;d.plan=plan;d.campaign=crypto.randomUUID();d.enabled=true;d.stage='Đã xếp '+added.length+' người';d.next=Math.max(0,...history.filter(r=>r.sentAt).map(r=>r.sentAt+86400000/dailyLimit(plan,history)));
 for(const target of added){const r={id:crypto.randomUUID(),campaign:d.campaign,actor,target,name:target.name||'',warm:plan.warm,internalClones:internalStart,state:'queued',stage:'Đang chờ'};touch(r);d.rows.push(r);}
 });void tick();return;}
 throw Error('Thao tác Tab 2 không hợp lệ.');
 }
 return {handle,tick};
}
