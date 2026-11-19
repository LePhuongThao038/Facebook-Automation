import {checkConnections} from './connection-check.js';
const $=id=>document.getElementById(id),button=$('connections-check'),list=$('connections-list'),summary=$('connections-summary');let pending=null;
export function refreshConnections(){
 if(pending)return pending;
 pending=(async()=>{
  button.disabled=true;summary.textContent='Đang kiểm tra bộ nối CSV và Media Bridge…';
  try{
   const rows=await checkConnections({send:type=>chrome.runtime.sendMessage({type}),fetchHealth:()=>fetch('http://127.0.0.1:47833/health',{credentials:'omit',signal:AbortSignal.timeout(3000)})});
   list.replaceChildren();
   for(const row of rows){const item=document.createElement('li'),title=document.createElement('strong'),detail=document.createElement('span');item.className=row.ok?'connection-ok':'connection-error';title.textContent=(row.id==='csv'?'Lưu file CSV':'Bộ xử lý video')+' · '+(row.ok?'Đã kết nối':'Chưa kết nối');detail.textContent=row.detail+' '+row.note;item.append(title,detail);list.append(item);}
   const passed=rows.filter(r=>r.ok).length;summary.textContent=passed+'/2 kết nối trên máy đang trả lời. Đây chưa phải xác nhận đăng bài thành công.';
   return rows;
  }catch(error){summary.textContent='Chưa kiểm tra xong: '+error.message;return [];}
  finally{button.disabled=false;}
 })().finally(()=>pending=null);
 return pending;
}
button.addEventListener('click',()=>void refreshConnections());
document.addEventListener('desk-connections-changed',()=>void refreshConnections());
window.addEventListener('focus',()=>void refreshConnections());
void refreshConnections();
