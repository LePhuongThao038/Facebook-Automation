import {accountUID} from './persona-model.js';
import {canonicalPost as commentPostURL} from './automation-model.js';
import {allowed} from './run-control.js';
const KEY='deskAudienceHistory';
export function audienceService({identify}){
 let serial=Promise.resolve();const lock=fn=>{const next=serial.then(fn);serial=next.catch(()=>{});return next;};
 const read=async()=>((await chrome.storage.local.get(KEY))[KEY]||{enabled:false,jobs:[],scan:{enabled:false,done:false},runnerTabId:null});
 const write=state=>chrome.storage.local.set({[KEY]:state});
 async function ensure(){const state=await read();if(!state.enabled)return;try{if((await chrome.tabs.get(state.runnerTabId)).url===chrome.runtime.getURL('audience-runner.html'))return;}catch{}const tab=await chrome.tabs.create({url:chrome.runtime.getURL('audience-runner.html'),active:false});await lock(async()=>{const latest=await read();latest.runnerTabId=tab.id;await write(latest);});}
 async function stop(){const state=await lock(async()=>{const s=await read();s.enabled=false;await write(s);return s;});if(state.activeTabId)await chrome.scripting.executeScript({target:{tabId:state.activeTabId},func:()=>{delete document.documentElement.dataset.facebookDeskAudienceToken;}}).catch(()=>{});return true;}
 return {ensure,stop,async handle(msg,sender){
  const ui=sender.id===chrome.runtime.id&&sender.url===chrome.runtime.getURL('dashboard.html');let s=await read();const worker=sender.url===chrome.runtime.getURL('audience-runner.html')&&sender.tab?.id===s.runnerTabId;
  if(msg.type==='audience-final-permit'){const j=s.jobs.find(j=>j.id===msg.jobId);if(sender.id!==chrome.runtime.id||!sender.url?.startsWith('https://www.facebook.com/')||!s.enabled||!await allowed()||!j||j.state!=='running'||j.token!==msg.token||s.activeTabId!==sender.tab?.id)throw Error('Lượt đổi đối tượng đã dừng.');return true;}
  if(!ui&&!worker)throw Error('Sai trang điều khiển quyền tiếp cận.');
  if(msg.type==='audience-state'){return {enabled:s.enabled,jobs:s.jobs,scan:s.scan,actor:s.actor};}
  if(msg.type==='audience-stop'){if(worker&&msg.sessionId&&msg.sessionId!==s.sessionId)return false;return stop();}
  if(msg.type==='audience-start'){
   if(!ui||!await allowed())throw Error('Bật công tắc tự động hóa của FB Desk trước khi chạy.');const actor=await identify(true),uid=accountUID(actor.url);if(!uid)throw Error('Chưa xác minh UID profile.');
   await lock(async()=>{s=await read();if(s.enabled)throw Error('Lượt đổi đối tượng đang chạy. Dừng trước khi bắt đầu lại.');if(s.actor&&s.actor.uid!==uid&&s.jobs.some(j=>j.state==='pending'||j.state==='running'))throw Error('Còn lượt đổi đối tượng của UID khác.');s.actor={...actor,uid};const d=(await chrome.storage.local.get('deskV2')).deskV2;
    for(const j of s.jobs)if(j.state==='running'||j.state==='error'){j.state='pending';j.token='';}
    for(const p of d?.posts||[]){const posted=(d.bot?.jobs||[]).find(j=>j.postId===p.id&&j.state==='success'&&accountUID(j.actor?.url)===uid);const url=commentPostURL(p.postUrl||posted?.postUrl);if((p.state==='success'||posted)&&url&&!s.jobs.some(j=>commentPostURL(j.url)===url))s.jobs.push({id:crypto.randomUUID(),url,state:'pending'});}
    s.enabled=true;s.completedAt=0;s.sessionId=crypto.randomUUID();s.scan=msg.scanProfile?(s.scan.passes&&!s.scan.done?{...s.scan,enabled:true,empty:0,replayRemaining:s.scan.passes}:{enabled:true,done:false,coverage:'in-progress',empty:0,passes:0,replayRemaining:0}):{...s.scan,enabled:false,coverage:'known-posts-only'};s.activeTabId=null;await write(s);
   });await ensure();return true;
  }
  if(!worker)throw Error('Chỉ worker được thực hiện lượt đổi đối tượng.');
  if(msg.type==='audience-next'){if(!s.enabled||!await allowed())return null;const actor=await identify(true);if(accountUID(actor.url)!==s.actor.uid){await stop();throw Error('Tài khoản hiện tại đã đổi UID.');}}
  if(['audience-bind-tab','audience-discovered','audience-finished'].includes(msg.type)&&msg.sessionId!==s.sessionId)throw Error('Phiên đổi đối tượng đã thay đổi.');
  if(msg.type==='audience-next')return lock(async()=>{s=await read();if(!s.enabled||!await allowed())return null;const j=s.jobs.find(j=>j.state==='pending');if(j){j.state='running';j.token=crypto.randomUUID();await write(s);return {actor:s.actor,job:j,sessionId:s.sessionId};}if(s.scan.enabled&&!s.scan.done)return {actor:s.actor,discover:true,sessionId:s.sessionId};s.enabled=false;s.completedAt=Date.now();await write(s);return null;});
  if(msg.type==='audience-bind-tab')return lock(async()=>{s=await read();if(!s.enabled||!await allowed())throw Error('Đã dừng.');const tab=await chrome.tabs.get(msg.tabId);if(!/^https:\/\/www\.facebook\.com\//.test(tab.url||''))throw Error('Sai tab Facebook.');s.activeTabId=msg.tabId;await write(s);return true;});
  if(msg.type==='audience-discovered')return lock(async()=>{s=await read();if(!s.enabled||!await allowed())throw Error('Đã dừng.');let added=0;for(const raw of msg.urls||[]){const url=commentPostURL(raw);if(url&&!s.jobs.some(j=>j.url===url)){s.jobs.push({id:crypto.randomUUID(),url,state:'pending'});added++;}}if(s.scan.replayRemaining>0){s.scan.replayRemaining--;s.scan.empty=0;}else{s.scan.passes++;s.scan.empty=added?0:(s.scan.empty||0)+1;}if(msg.terminal===true){s.scan.done=true;s.scan.coverage='timeline-end';}else if(s.scan.empty>=8||s.scan.passes>=500){s.scan.done=true;s.scan.coverage='loaded-history-only';}await write(s);return added;});
  if(msg.type==='audience-finished')return lock(async()=>{s=await read();const j=s.jobs.find(j=>j.id===msg.jobId);if(!j||j.token!==msg.token)throw Error('Lượt đã thay đổi.');j.state=['public','already_public'].includes(msg.result.state)?msg.result.state:!s.enabled?'pending':'error';j.error=msg.result.error||'';if(/kiểm tra tài khoản|hạn chế|checkpoint|restricted/i.test(j.error))s.enabled=false;j.checkedAt=new Date().toISOString();s.activeTabId=null;await write(s);return true;});
  throw Error('Tác vụ quyền tiếp cận không hợp lệ.');
 }};
}
