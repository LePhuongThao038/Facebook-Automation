import {DEFAULT_SHEET,targetOf} from './friend-model.js';
import {vietnamTime} from './display-time.js';
const $=s=>document.getElementById('fr-'+s);
const warm={none:'Gửi lời mời ngay.',light:'Like ảnh bìa và avatar, chọc nếu có.',medium:'Like 5 bài gần nhất và avatar.',deep:'Like 10 bài gần nhất và avatar. Bình luận do bạn duyệt và tự gửi ở hàng chờ thủ công.'};
async function rpc(type,data={}){const r=await chrome.runtime.sendMessage({type:'friends-'+type,...data});if(!r?.ok)throw Error(r?.error||'Không kết nối được Tab 2.');return r.data;}
function on(id,fn){$(id).onclick=async()=>{const b=$(id);b.disabled=true;try{$('feedback').textContent='';await fn();await refresh();}catch(e){$('feedback').textContent=e.message;}finally{b.disabled=false;}};}
const fields=['source','manual','count','count-num','daily','daily-num','warm'];
function controls(){for(const k of ['count','daily'])$(k+'-num').hidden=$(k).value!=='custom';$('warm-help').textContent=warm[$('warm').value];}
async function formInit(){
 const saved=(await chrome.storage.local.get('friendForm')).friendForm||{};
 for(const k of fields){if(saved[k]!=null)$(k).value=saved[k];$(k).onchange=()=>{controls();chrome.storage.local.set({friendForm:Object.fromEntries(fields.map(k=>[k,$(k).value]))});};}
 controls();
}
const pageSize=20;
let visibleCount=pageSize, campaignKey='', lastState;
const outcomes={queued:'Chờ đến lượt',sent:'Đã gửi kết bạn',accepted:'Đã là bạn',rejected:'Bị từ chối',review:'Cần kiểm tra',uncertain:'Chờ đối soát',error:'Lỗi'};
function drawProgress(d,batch){
 const key=JSON.stringify([d.actor?.url,d.campaign]);
 if(key!==campaignKey){campaignKey=key;visibleCount=pageSize;}
 lastState={d,batch};
 const body=$('targets'),fragment=document.createDocumentFragment();
 for(const r of batch.slice(0,visibleCount)){
  const tr=document.createElement('tr');
  if(r.inProgress)tr.className='fr-current';
  tr.insertCell().textContent=r.target.id;
  const cell=tr.insertCell(),profile=targetOf(r.target.url)||targetOf(r.target.id);
  const link=document.createElement('a');
  if(profile){link.href=profile.url;link.target='_blank';link.rel='noopener noreferrer';}
  link.textContent=r.name||r.target.name||'Mở trang cá nhân';cell.append(link);
  const pending=r.state==='queued';
  const detail=r.retryAt&&pending&&!d.pausedByUser?'Tự thử lại lúc '+vietnamTime(r.retryAt)+' · '+r.error:r.error || (r.inProgress?r.stage:pending?(d.enabled?'Chờ đến lượt':'Tạm dừng'):(r.response||outcomes[r.state]||r.stage));
  const warmText=r.warmLog||(r.warm==='none'?'Không cần':pending?(r.inProgress&&r.stage?.includes('Warm-up')?'Đang bắt đầu':'Chưa ghi nhận'):'Chưa ghi nhận');
  const invite=r.state==='uncertain'?'Chờ đối soát':r.send||(pending?'Chưa gửi':'Chưa ghi nhận');
  for(const value of [warmText,invite,detail])tr.insertCell().textContent=value||'—';
  fragment.append(tr);
 }
 body.replaceChildren(fragment);
 $('visible').textContent=batch.length?Math.min(visibleCount,batch.length)+' / '+batch.length+' nick':'Chưa có nick trong hàng chờ';
 const remaining=batch.length-visibleCount;
 $('more').hidden=remaining<=0;
 $('more').textContent='Xem thêm '+Math.min(pageSize,Math.max(0,remaining))+' nick';
}
$('more').onclick=()=>{if(lastState){visibleCount+=pageSize;drawProgress(lastState.d,lastState.batch);}};
let initialized=false;
async function refresh(){const d=await rpc('state');if(!initialized){$('sheet').value=d.config.sheet||DEFAULT_SHEET;$('endpoint').value=d.config.endpoint||'';initialized=true;}
 $('open').href=d.config.sheet||DEFAULT_SHEET;$('sync-state').textContent=(d.config.endpoint?'Đã kết nối':'Chưa kết nối · log đang lưu trong Chrome')+' · '+d.rows.filter(r=>r.rev!==r.synced&&r.state!=='queued').length+' dòng chờ đồng bộ'+(d.syncError?' · '+d.syncError:'');
 const rows=d.rows.filter(r=>!d.actor||r.actor.url===d.actor.url),batch=rows.filter(r=>!d.campaign||r.campaign===d.campaign),done=batch.filter(r=>r.state!=='queued').length;
 drawProgress(d,batch);
 $('progress').max=batch.length||1;$('progress').value=done;$('numbers').textContent=' '+done+'/'+batch.length+' đã xử lý';
 $('stage').textContent=d.stage+(d.actorRetryAt>Date.now()?' · '+vietnamTime(d.actorRetryAt):'')+(d.enabled&&d.next>Date.now()?' · Lượt tiếp: '+vietnamTime(d.next):'');
 if(d.actor)$('actor').textContent='Tài khoản: '+d.actor.name+' · '+d.actor.url;
 const table=$('log');table.replaceChildren();for(const r of [...rows].reverse().filter(r=>r.state!=='queued'||r.inProgress||r.name||r.warmLog)){
  const tr=document.createElement('tr');for(const value of [vietnamTime(r.at),r.target.id,r.name,r.warmLog,r.send,r.response,r.error||r.stage]){const td=document.createElement('td');td.textContent=value||'';tr.append(td);}table.append(tr);}
}
on('start',async()=>{const source=$('source').value.trim();if(source){const u=new URL(source);if(u.protocol!=='https:')throw Error('Cần link HTTPS.');if(!await chrome.permissions.request({origins:[u.origin+'/*']}))throw Error('Chưa cấp quyền đọc nguồn.');}
 await rpc('start',{source,manual:$('manual').value,warm:$('warm').value,count:$('count').value==='custom'?$('count-num').value:$('count').value,daily:$('daily').value==='custom'?$('daily-num').value:$('daily').value});});
for(const k of ['stop','resume','scan','sync'])on(k,()=>rpc(k));
on('connect',async()=>{await rpc('save-sheet',{sheet:$('sheet').value,endpoint:$('endpoint').value,key:$('key').value});$('key').value='';$('feedback').textContent='Đã kết nối.';});
on('code',async()=>{await navigator.clipboard.writeText(await (await fetch(chrome.runtime.getURL('SheetLog.gs'))).text());$('feedback').textContent='Đã sao chép mã.';});
formInit().catch(e=>$('feedback').textContent=e.message);
document.getElementById('tab-friends').addEventListener('click',()=>refresh().catch(e=>$('feedback').textContent=e.message));
let updateTimer;
chrome.storage.onChanged.addListener((changes,area)=>{
 if(area!=='local'||!changes.friendDesk1||document.getElementById('friends').hidden||updateTimer)return;
 updateTimer=setTimeout(()=>{updateTimer=null;refresh().catch(e=>$('feedback').textContent=e.message);},200);
});
setInterval(()=>{if(!document.getElementById('friends').hidden)refresh().catch(e=>$('feedback').textContent=e.message);},4000);

document.getElementById('tab-friends').addEventListener('click',()=>rpc('names').catch(()=>{}));
