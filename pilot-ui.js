import {makeSnapshot,restoreSnapshot,migrationKeys} from './migration.js';
import {assertFixedRoster} from './cross-role-lock.js';
import {gatewayOrigin} from './team-api.js';
const el=id=>document.getElementById(id);
async function call(type,data={}){
 const res=await chrome.runtime.sendMessage({type,...data});
 if(!res?.ok)throw Error(res?.error||'Không thể kết nối.');return res.data;
}
export async function saveTeam(){
 const origin=gatewayOrigin(el('team-origin').value.trim());
 if(!await chrome.permissions.request({origins:[origin+'/*']}))throw Error('Chưa cấp quyền gateway.');
 await call('team-config',{origin,token:el('team-token').value});
 el('team-token').value='';
}
el('settings-open').addEventListener('click',async()=>{
 const g=(await chrome.storage.local.get('deskGateway')).deskGateway;
 el('team-origin').value=g?.origin||'';el('team-token').value='';el('team-result').textContent='';
});
el('team-check').onclick=async()=>{
 try{
  await saveTeam();const r=await call('team-usage');
  const total=r.usage.reduce((sum,x)=>sum+x.estimated_usd,0);
  el('team-result').textContent=r.device+' · '+r.model+' · tháng hiện tại (UTC): '+r.usage.reduce((sum,x)=>sum+x.calls,0)+' lượt · ước tính '+total.toFixed(6)+' USD';
 }catch(e){el('team-result').textContent=e.message;}
};
el('pilot-export').onclick=async()=>{
 try{
  const raw=await chrome.storage.local.get([...migrationKeys,'deskRunControl']);
  if(raw.deskRunControl?.enabled)throw Error('Tạm dừng toàn bộ trước khi xuất bản sao.');
  const backup=makeSnapshot(raw),url=URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='FacebookDesk-private-'+Date.now()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
  el('pilot-result').textContent='Đã xuất bản sao riêng. Không tải file này lên Store.';
 }catch(e){el('pilot-result').textContent=e.message;}
};
el('pilot-import').onchange=async e=>{
 try{
  const f=e.target.files[0];if(!f)return;
  const data=restoreSnapshot(JSON.parse(await f.text()));
  const previous=await chrome.storage.local.get(['deskPersonas','deskCrossMappings']);if(previous.deskPersonas&&Object.keys(previous.deskCrossMappings||{}).length){if(!data.deskPersonas)throw Error('Bản sao thiếu danh bạ đang khóa vai.');assertFixedRoster(previous.deskPersonas,data.deskPersonas,previous.deskCrossMappings);data.deskCrossMappings={...(data.deskCrossMappings||{}),...previous.deskCrossMappings};}
  await navigator.locks.request('facebook-desk-task',{ifAvailable:true},async slot=>{
   if(!slot)throw Error('Đang có tác vụ. Hãy tạm dừng trước.');
   const old=await chrome.storage.local.get(['deskV2','friendDesk1','deskRunControl']);
   if(old.deskRunControl?.enabled||old.deskV2?.posts?.length||old.deskV2?.logs?.length||old.deskV2?.bot?.jobs?.length||old.friendDesk1?.rows?.length)throw Error('Chỉ nhập vào bản cài trống đang tạm dừng.');
   await chrome.storage.local.set(data);
  });
  el('pilot-result').textContent='Đã nhập '+data.deskV2.posts.length+' bài, '+data.deskV2.logs.length+' dòng lịch sử. Mở lại giao diện để kiểm tra.';
 }catch(err){el('pilot-result').textContent=err.message;}finally{e.target.value='';}
};
