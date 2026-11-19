import {exportProgressV3} from './progress-v3.js';
export function safeCSVName(label){return String(label||'Facebook Desk').normalize('NFKC').replace(/[\x00-\x1f<>:"/\\|?*]/g,'_').replace(/[ .]+$/,'').slice(0,90)||'Facebook Desk';}

let directory;
export async function accountFileLabel(actor,personas){
 const raw=String(actor?.name||'').trim();
 let uid=actor?.uid||raw.match(/^UID\s+(\d+)$/i)?.[1]||'';
 try{uid=new URL(actor.url).searchParams.get('id')||uid;}catch{}
 let name=raw&&!/^(?:UID\s*)?\d+$/i.test(raw)?raw:'';
 if(!name&&uid){
  name=personas?.profiles?.find(p=>String(p.uid)===String(uid))?.name;
  if(!name){
   directory??=fetch(chrome.runtime.getURL('DANH-BA-TU-SHEET.json')).then(r=>r.json()).then(d=>d.profiles).catch(()=>{directory=null;return [];});
   name=(await directory).find(p=>String(p.uid)===String(uid))?.name;
  }
 }
 return safeCSVName((name||'Chưa xác định tên')+(uid?' · UID '+uid:''));
}

export async function nativeSaveCSV(csv,name,profile){
 const port=chrome.runtime.connectNative('com.facebookdesk.media');let pending,closed=false;
 port.onMessage.addListener(result=>{if(pending){const {resolve,reject}=pending;pending=null;result?.ok?resolve(result):reject(Error(result?.error||'Không lưu được CSV.'));}});
 port.onDisconnect.addListener(()=>{closed=true;const error=chrome.runtime.lastError?.message||'Bộ nối tự lưu đã đóng.';if(pending){pending.reject(Error(error));pending=null;}});
 function send(value){return new Promise((resolve,reject)=>{if(closed)return reject(Error('Bộ nối tự lưu đã đóng.'));const timeout=setTimeout(()=>{if(pending){pending=null;reject(Error('Quá thời gian ghi CSV.'));port.disconnect();}},30000);pending={resolve:value=>{clearTimeout(timeout);resolve(value);},reject:error=>{clearTimeout(timeout);reject(error);}};try{port.postMessage(value);}catch(error){pending.reject(error);pending=null;}});}
 try{
  await send({action:'csv-begin',name:safeCSVName(name),profile,chars:csv.length});let chunks=0;
  for(let offset=0;offset<csv.length;offset+=32768)await send({action:'csv-chunk',index:chunks++,text:csv.slice(offset,offset+32768)});
  return await send({action:'csv-commit',chunks});
 }finally{port.disconnect();}
}
export function createCSVAutosave(){
 let timer,inFlight=null;
 const schedule=(delay=3000)=>{if(!timer)timer=setTimeout(()=>{timer=null;void flush();},delay);};
 async function flush(){
  if(inFlight)return inFlight;
  inFlight=performFlush();try{return await inFlight;}finally{inFlight=null;}
 }
 async function performFlush(){
  try{
   const saved=await chrome.storage.local.get(['deskV2','deskAutosaveDirty','deskAutosaveContext','deskAutosaveProfile','deskPersonas']);if(!saved.deskV2||!saved.deskAutosaveDirty)return;
   const revision=saved.deskAutosaveDirty,profile=saved.deskAutosaveProfile||crypto.randomUUID();if(!saved.deskAutosaveProfile)await chrome.storage.local.set({deskAutosaveProfile:profile});
   const actor=saved.deskV2.bot?.actor;const label=await accountFileLabel(actor,saved.deskPersonas);
   const csv=await exportProgressV3(saved.deskV2);const result=await nativeSaveCSV(csv,label,profile);
   await chrome.storage.local.set({deskAutosaveStatus:{ok:true,at:new Date().toISOString(),path:result.path,label}});
   const latest=await chrome.storage.local.get('deskAutosaveDirty');if(latest.deskAutosaveDirty===revision)await chrome.storage.local.remove('deskAutosaveDirty');else schedule(15000);
  }catch(error){await chrome.storage.local.set({deskAutosaveStatus:{ok:false,error:error.message,at:new Date().toISOString()}});}
 }
 const progressKey=d=>JSON.stringify({posts:(d?.posts||[]).map(p=>[p.id,p.state,p.text,p.postUrl,p.sourceKey,p.sourceUrl,p.sourceCaption,p.captionPartial,p.time,p.location,p.feeling,p.withPeople,(p.media||[]).map(m=>[m.id,m.type,String(m.url||'').length,String(m.url||'').slice(0,200)]),p.comments]),jobs:(d?.bot?.jobs||[]).map(j=>[j.id,j.postId,j.state,j.dueAt,j.submittedAt,j.postUrl,j.error]),actor:d?.bot?.actor,settings:d?.settings});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.deskAutosaveContext||(changes.deskV2&&progressKey(changes.deskV2.oldValue)!==progressKey(changes.deskV2.newValue)))){void chrome.storage.local.set({deskAutosaveDirty:crypto.randomUUID()}).then(()=>schedule());}});
 chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='desk-csv-autosave')void flush();});
 void chrome.alarms.create('desk-csv-autosave',{periodInMinutes:1});
 void chrome.storage.local.set({deskAutosaveDirty:crypto.randomUUID()}).then(()=>schedule());
 return {flush};
}
