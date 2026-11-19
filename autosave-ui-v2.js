import {accountFileLabel} from './csv-autosave.js';
const $=id=>document.getElementById(id),status=$('autosave-status'),actionStatus=$('autosave-action-status'),location=$('autosave-location');
const fallbackPath='%LOCALAPPDATA%\\FacebookDesk\\Autosave';
status.style.overflowWrap='anywhere';let lastTitle='';
async function call(type){const result=await chrome.runtime.sendMessage({type});if(!result?.ok)throw Error(result?.error||'Không kết nối được chức năng này.');return result.data;}
const hostError=error=>/native|forbidden|host|registered|access|specified/i.test(error||'');
function setPath(value,isFile=false){if(value)location.textContent=isFile?value.replace(/[\\/][^\\/]+$/,''):value;}
async function context(){
 const {deskV2,deskPersonas}=await chrome.storage.local.get(['deskV2','deskPersonas']);
 const actor=deskV2?.bot?.actor;if(actor)document.title=(await accountFileLabel(actor,deskPersonas))+' · FB Desk';
 if(document.title!==lastTitle){lastTitle=document.title;await chrome.runtime.sendMessage({type:'autosave-context',title:document.title});}
}
function paint(value){
 if(!value){status.textContent='Tiến trình được lưu trong profile. Đang chuẩn bị bản CSV…';return;}
 if(value.ok){setPath(value.path,true);status.textContent='Đã tự lưu CSV · '+new Date(value.at).toLocaleTimeString('vi-VN')+' · '+value.path;}
 else status.textContent='Tiến trình vẫn lưu trong profile; CSV ngoài máy chưa ghi được. '+(hostError(value.error)?'Bộ nối lưu file chưa được ghép với ID tiện ích này. Bấm “Tải CSV dự phòng” để lấy bản sao ngay.':value.error||'');
}
function explainFolderError(){
 let dialog=$('autosave-help');if(dialog){dialog.showModal();return;}
 dialog=document.createElement('dialog');dialog.id='autosave-help';const title=document.createElement('h2');title.textContent='Chưa kết nối được bộ mở thư mục';
 const info=document.createElement('p');info.textContent='Thư mục CSV: '+(location.textContent||fallbackPath)+'. Nút này cần bộ nối Windows. Bạn có thể tải CSV dự phòng ngay; không cần tìm hay nhập lại tiến độ.';
 const command=document.createElement('textarea');command.readOnly=true;command.rows=4;command.style.width='100%';command.setAttribute('aria-label','Lệnh ghép bộ nối đã điền sẵn');
 command.value='powershell -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\Admin\\Documents\\Codex\\2026-11-15\\hi\\outputs\\Facebook-Desk-K-Global-3_8_5\\Install-Start-Video.ps1" -ExtensionIds "'+chrome.runtime.id+'"';
 const copy=document.createElement('button');copy.textContent='Sao chép lệnh sửa kết nối';copy.type='button';copy.onclick=async()=>{try{await navigator.clipboard.writeText(command.value);copy.textContent='Đã sao chép';}catch{command.focus();command.select();}};
 const close=document.createElement('button');close.textContent='Đóng';close.type='button';close.onclick=()=>dialog.close();dialog.append(title,info,command,copy,close);document.body.append(dialog);dialog.showModal();
}
function action(id,fn){const button=$(id);button.addEventListener('click',async()=>{button.disabled=true;try{await fn();}catch(e){actionStatus.textContent=e.message||'Chưa hoàn tất.';}finally{button.disabled=false;}});}
action('autosave-now',async()=>{actionStatus.textContent='Đang ghi CSV…';const value=await call('autosave-flush');paint(value);actionStatus.textContent=value?.ok?(value.pending?'Đã ghi một bản CSV; thay đổi mới đang chờ lưu tiếp.':'Đã ghi CSV thành công.'): 'Chưa ghi được CSV ra máy. Dùng “Tải CSV dự phòng” để lấy bản sao ngay.';});
action('autosave-folder',async()=>{
 actionStatus.textContent='Đang mở thư mục CSV…';
 try{const value=await call('autosave-folder');setPath(value.path);actionStatus.textContent='Đã yêu cầu Windows mở thư mục CSV: '+location.textContent;}
 catch{actionStatus.textContent='Chưa mở được thư mục vì bộ nối Windows chưa hoạt động. Thư mục và cách xử lý đã hiển thị bên dưới.';explainFolderError();}
});
action('autosave-copy-path',async()=>{await navigator.clipboard.writeText(location.textContent||fallbackPath);actionStatus.textContent='Đã sao chép đường dẫn thư mục CSV.';});
action('autosave-download',async()=>{
 actionStatus.textContent='Đang tạo bản CSV dự phòng…';const csv=await call('autosave-download');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download=await progressFilename();document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
 actionStatus.textContent='Đã gửi bản CSV tới trình tải xuống của Chrome. Bản dự phòng này không thay thế file tự lưu trong thư mục trên.';
});
chrome.storage.local.get('deskAutosaveStatus').then(value=>paint(value.deskAutosaveStatus));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.deskAutosaveStatus)paint(changes.deskAutosaveStatus.newValue);});
void call('autosave-location').then(value=>setPath(value.path)).catch(()=>{});
new MutationObserver(()=>void context().catch(()=>{})).observe($('account-name'),{childList:true,characterData:true,subtree:true});
window.addEventListener('pagehide',()=>{void chrome.runtime.sendMessage({type:'autosave-flush'}).catch(()=>{});});
void context().catch(()=>{});
export async function progressFilename(){
 const {deskV2,deskPersonas}=await chrome.storage.local.get(['deskV2','deskPersonas']);
 return (await accountFileLabel(deskV2?.bot?.actor,deskPersonas))+'.csv';
}
