import {vietnamTime} from './display-time.js';
let runEnabled=false;
const state={deskV2:{},friendDesk1:{},deskPersonas:{},deskComments:{}};
function cardStatus(panel,running,error){
 const button=document.querySelector('.desk-overview [data-panel="'+panel+'"]');
 button.dataset.status=running?'running':error?'error':'idle';
 button.title=running?'Đang xử lý':error?'Có lỗi cần kiểm tra':'Chưa có lượt đang chạy';
}
function render(){
 const desk=state.deskV2||{},friends=state.friendDesk1||{};
 const posts=desk.posts||[],latest=new Map();
 for(const job of desk.bot?.jobs||[])if(latest.get(job.postId)!=='success')latest.set(job.postId,job.state);
 const stages=posts.map(p=>p.state==='success'?'success':latest.get(p.id)||p.state);
 const count=(items,values)=>items.filter(value=>values.includes(value)).length;
 const active=count(stages,['running','verifying']);
 const pending=count(stages,['queued']);
 const postState=active?'Đang đăng':pending?(desk.bot?.enabled?'Đã xếp lịch':'Tạm dừng'):'Không có lượt đang chạy';
 document.querySelector('#summary-post').textContent=postState+' · '+count(stages,['success'])+' đã đăng · '+pending+' chờ · '+count(stages,['unknown','partial'])+' đối soát · '+count(stages,['error','failed'])+' lỗi';
 const rows=(friends.rows||[]).filter(r=>r.campaign===friends.campaign&&r.actor?.url===friends.actor?.url);
 const busy=active>0||Boolean(friends.active);
 const pet=document.querySelector('.desk-pet');
 pet.dataset.mode=runEnabled?(busy?'run':'ready'):'sleep';
 const sprite=document.getElementById('rex-sprite');
 const asset='rex-'+pet.dataset.mode+'.gif';
 if(sprite.getAttribute('src')!==asset)sprite.src=asset;
 cardStatus('scenario',runEnabled&&active>0,count(stages,['error','failed','ai_error','partial'])>0);
 cardStatus('friends',runEnabled&&Boolean(friends.active),Boolean(friends.syncError||friends.actorRetryAt||rows.some(r=>r.error)));
 cardStatus('comments',runEnabled&&Boolean(state.deskComments?.enabled),Boolean(state.deskComments?.last?.includes('uncertain')));
 document.querySelector('#pet-status').textContent=runEnabled?(busy?'Đang xử lý':'Đã bật · chờ lượt'):'Đang dừng';
 const queued=rows.filter(r=>r.state==='queued');
 const retryTimes=queued.map(r=>r.retryAt||0);
 const earliest=queued.length?Math.max(friends.actorRetryAt||0,friends.next||0,Math.min(...retryTimes)):0;
 const stage=friends.active||friends.scan||friends.actorRetryAt>Date.now()?friends.stage:friends.pausedByUser?'Đã dừng':friends.enabled?'Chờ đến lượt':queued.length?'Tạm dừng':rows.length?'Hoàn tất':'Chưa chạy';
 document.querySelector('#summary-friend').textContent=(stage||'Đang chạy')+' · '+(rows.length-queued.length)+'/'+rows.length+' đã xử lý · '+rows.filter(r=>r.sentAt&&['sent','accepted'].includes(r.state)).length+' đã gửi'+(friends.enabled&&earliest>Date.now()?' · Lượt tiếp '+vietnamTime(earliest):'');
 const withComments=posts.filter(p=>Array.isArray(p.comments)&&p.comments.length);
 document.querySelector('#summary-comment').textContent=withComments.reduce((sum,p)=>sum+p.comments.length,0)+' dòng kịch bản · '+withComments.length+' bài · Chưa có job gửi';
}
for(const button of document.querySelectorAll('.desk-overview [data-panel]'))button.onclick=()=>document.getElementById('tab-'+button.dataset.panel).click();
const keys=Object.keys(state);
const seen=new Set();
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area!=='local')return;
 for(const key of keys)if(changes[key]){seen.add(key);state[key]=changes[key].newValue;}
 if(keys.some(key=>changes[key]))render();
});
const initial=await chrome.storage.local.get(keys);
for(const key of keys)if(!seen.has(key))state[key]=initial[key];
render();

const runKey='deskRunControl';
const runButton=document.getElementById('run-toggle');
function showRunControl(state){
 runEnabled=state?.enabled===true;render();
 const text=runEnabled?'Tự động hóa đang bật · Giãn cách tương tác tối thiểu 1 phút':'Đã tạm dừng · '+(state?.reason||'Chờ bạn bật cho Chrome Profile này');
 document.getElementById('run-state').textContent=text;
 runButton.textContent=runEnabled?'Tạm dừng toàn bộ':'Bật lại tự động hóa';
 runButton.disabled=false;
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes[runKey])showRunControl(changes[runKey].newValue);});
showRunControl((await chrome.storage.local.get(runKey))[runKey]);
// 3.8.7: "Bật lại tự động hóa" cũng tự mở Media Bridge (như nút Start Video), chạy song song, không chặn việc bật.
// Bridge lỗi thì chỉ báo; bài ảnh/chữ vẫn đăng được, bài video sẽ chờ bridge như cũ.
const bridgeNote=document.getElementById('run-bridge');
const bridgeSay=text=>{if(bridgeNote)bridgeNote.textContent=text;const r=document.getElementById('media-bridge-result');if(r)r.textContent=text;};
async function bridgeHealth(){
 const response=await fetch('http://127.0.0.1:47833/health',{credentials:'omit',signal:AbortSignal.timeout(2000)});
 if(!response.ok)throw Error('Media Bridge trả HTTP '+response.status+(response.status===403?' · ID chưa được ghép.':'.'));
 const data=await response.json();
 if(data.schema!=='desk.media/1')throw Error('Cổng 47833 đang chạy chương trình khác.');
 return data;
}
let bridgeStarting=false;
async function startBridgeWithRun(){
 if(bridgeStarting)return;bridgeStarting=true;
 try{
  try{const data=await bridgeHealth();bridgeSay('Media Bridge đã chạy · MP4 tối đa '+data.maxMB+' MB.');return;}catch{}
  bridgeSay('Đang mở Media Bridge chạy ngầm…');
  const response=await chrome.runtime.sendMessage({type:'media-start-video'});
  if(!response?.ok)throw Error(response?.error||'Extension chưa phản hồi.');
  const start=Date.now();let lastError='';
  while(Date.now()-start<180000){
   try{const data=await bridgeHealth();bridgeSay('Media Bridge sẵn sàng · MP4 tối đa '+data.maxMB+' MB.');return;}catch(error){lastError=error.message;}
   bridgeSay('Đang mở Media Bridge · '+Math.floor((Date.now()-start)/1000)+' giây.');
   await new Promise(resolve=>setTimeout(resolve,1000));
  }
  throw Error('Chưa kết nối sau 3 phút. '+lastError);
 }catch(error){bridgeSay('Media Bridge chưa chạy: '+error.message+' Bài ảnh/chữ vẫn đăng; bài video chờ bridge.');}
 finally{bridgeStarting=false;}
}
runButton.onclick=async()=>{
 runButton.disabled=true;
 const turningOn=!runEnabled;
 try{
  const result=await chrome.runtime.sendMessage({type:'desk-toggle',enabled:turningOn});
  if(!result?.ok)throw Error(result?.error||'Không đổi được trạng thái.');
  showRunControl(result.data);
  if(turningOn&&result.data?.enabled===true)startBridgeWithRun();
 }catch(e){document.getElementById('run-state').textContent=e.message;runButton.disabled=false;}
};

const refreshAccount=document.querySelector('#account-refresh');
let accountRead=false;
let initialProbe=true;
async function readAccount(force=false){
 if(accountRead||document.hidden)return;
 accountRead=true;refreshAccount.disabled=true;
 try{
  const probe=force||initialProbe;initialProbe=false;
  const result=await chrome.runtime.sendMessage({type:'header-account',probe});
  const actor=result?.ok?result.data?.actor:null;
  if(!probe&&!actor&&refreshAccount.dataset.verified==='yes')return;
  refreshAccount.dataset.verified=actor?'yes':'no';
  const cached=state.friendDesk1?.actor||state.deskV2?.bot?.actor;
  const shown=actor||cached;
  document.querySelector('#account-label').textContent=actor?'Facebook · lần kiểm tra gần nhất':cached?'Nick đã lưu · chưa xác minh':'Tài khoản Facebook';
  document.querySelector('#account-name').textContent=shown?.name||'Chưa xác định';
  if(shown)void showActorName(shown);
  const detail=document.querySelector('#account-id');
  let handle='';try{const url=new URL(shown.url);handle=url.searchParams.get('id')||decodeURIComponent(url.pathname.slice(1));}catch{}
  detail.textContent=actor?(handle?'ID / '+handle:''):(result?.data?.reason||result?.error||'Bấm ↻ để kiểm tra lại.');
 }finally{accountRead=false;refreshAccount.disabled=false;}
}
// 3.8.7: nick chỉ có "UID …": hiện tên tra được (hồ sơ / danh bạ / tên tự đặt); bấm vào tên để đặt tên tại máy.
async function showActorName(actor){
 try{const {actorDisplayName}=await import('./csv-autosave.js');const {deskPersonas}=await chrome.storage.local.get('deskPersonas');
  const {name,uid}=await actorDisplayName(actor,deskPersonas);const el=document.querySelector('#account-name');
  if(name&&name!==actor.name)el.textContent=name;
  if(uid&&/^(?:UID\s*)?\d+$/i.test(String(actor.name||'').trim())){el.title='Bấm để đặt tên hiển thị cho UID '+uid+' (chỉ lưu trên máy này)';el.style.cursor='pointer';
   el.onclick=async()=>{const value=prompt('Tên hiển thị cho UID '+uid+' (dùng cho tab và tên CSV tự lưu; đăng bài vẫn theo UID):',name||'');if(value===null)return;
    const store=(await chrome.storage.local.get('deskActorNames')).deskActorNames||{};if(value.trim())store[uid]=value.trim().slice(0,80);else delete store[uid];
    await chrome.storage.local.set({deskActorNames:store});el.textContent=value.trim()||actor.name;};}
 }catch{}
}
const linkAccountButton=document.querySelector('#link-account');
linkAccountButton.onclick=async(event)=>{
 if(accountRead)return;
 // 3.8.7: bấm là tự mở trang của nick đang đăng nhập và lấy UID; giữ Shift khi bấm để tự dán link/UID.
 let value='';
 if(event?.shiftKey){value=prompt('Dán link trang cá nhân của bạn hoặc UID.');if(!value?.trim())return;}
 document.querySelector('#account-label').textContent='Đang mở trang cá nhân để lấy UID…';
 accountRead=true;refreshAccount.disabled=true;linkAccountButton.disabled=true;
 try{
  const r=await chrome.runtime.sendMessage({type:'link-account',value});
  if(!r?.ok||!r.data?.actor)throw Error(r?.error||'Không xác minh được tài khoản.');
  const actor=r.data.actor,url=new URL(actor.url);
  document.querySelector('#account-label').textContent='Facebook · đã xác minh liên kết';
  document.querySelector('#account-name').textContent=actor.name;
  document.querySelector('#account-id').textContent='ID / '+(url.searchParams.get('id')||url.pathname.slice(1));
  refreshAccount.dataset.verified='yes';
 }catch(e){alert(e.message);}finally{accountRead=false;refreshAccount.disabled=false;linkAccountButton.disabled=false;}
};
refreshAccount.onclick=()=>readAccount(true).catch(console.error);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)readAccount().catch(console.error);});
readAccount().catch(console.error);
setInterval(()=>readAccount().catch(console.error),30000);
