import {accountFileLabel} from './csv-autosave.js';
const status=document.getElementById('autosave-status');
status.style.overflowWrap='anywhere';
let lastTitle='';
async function context(){
 const {deskV2,deskPersonas}=await chrome.storage.local.get(['deskV2','deskPersonas']);
 const actor=deskV2?.bot?.actor;if(actor)document.title=(await accountFileLabel(actor,deskPersonas))+' · FB Desk';
 if(document.title!==lastTitle){lastTitle=document.title;await chrome.runtime.sendMessage({type:'autosave-context',title:document.title});}
}
function paint(value){if(!value){status.textContent='Tiến trình được tự lưu trong profile. Đang chuẩn bị bản CSV…';return;}status.textContent=value.ok?'Đã tự lưu CSV · '+new Date(value.at).toLocaleTimeString('vi-VN')+' · '+value.path:'Tiến trình đã lưu trong profile; bản CSV chưa ghi được: '+value.error;}
chrome.storage.local.get('deskAutosaveStatus').then(value=>paint(value.deskAutosaveStatus));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.deskAutosaveStatus)paint(changes.deskAutosaveStatus.newValue);});
document.getElementById('autosave-now').addEventListener('click',()=>chrome.runtime.sendMessage({type:'autosave-flush'}));
document.getElementById('autosave-folder').addEventListener('click',async()=>{const result=await chrome.runtime.sendMessage({type:'autosave-folder'});if(!result?.ok)status.textContent=result?.error||'Chưa mở được thư mục.';});
new MutationObserver(()=>void context()).observe(document.getElementById('account-name'),{childList:true,characterData:true,subtree:true});
window.addEventListener('pagehide',()=>{void chrome.runtime.sendMessage({type:'autosave-flush'}).catch(()=>{});});
void context();
export async function progressFilename(){
 const {deskV2,deskPersonas}=await chrome.storage.local.get(['deskV2','deskPersonas']);
 return (await accountFileLabel(deskV2?.bot?.actor,deskPersonas))+'.csv';
}
