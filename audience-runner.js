import {taskSlot} from './run-control.js';
import {openWorkTab,closeWorkTab} from './work-tabs.js';
import {waitFacebookTab} from './tab-ready.js';
import {facebookAudience} from './facebook-audience.js';
const status=document.getElementById('status'),sleep=ms=>new Promise(r=>setTimeout(r,ms));let busy=false,scanTab,cycleSession;
async function rpc(type,data={}){const r=await chrome.runtime.sendMessage({type,...data});if(!r?.ok)throw Error(r?.error||'Không nhận được phản hồi.');return r.data;}
async function loop(){if(busy)return;busy=true;try{await taskSlot(async()=>{
 const next=await rpc('audience-next');if(!next){if(scanTab){await closeWorkTab(scanTab).catch(()=>{});scanTab=null;}return;}cycleSession=next.sessionId;let tab;
 if(next.discover){
  if(scanTab)tab=await chrome.tabs.get(scanTab).catch(()=>null);if(!tab){tab=await openWorkTab({url:next.actor.url,active:false},'audience-scan',false);scanTab=tab.id;await waitFacebookTab(tab.id,id=>chrome.tabs.get(id),sleep);}
  await rpc('audience-bind-tab',{tabId:tab.id,sessionId:cycleSession});const [result]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:facebookAudience,args:['discover',{actorUid:next.actor.uid,token:'scan-'+next.actor.uid,scroll:true}]});if(!result?.result?.ok)throw Error(result?.result?.error||'Không quét được bài.');await rpc('audience-discovered',{urls:result.result.urls,terminal:result.result.terminal===true,sessionId:cycleSession});status.textContent='Đang quét các bài được Facebook tải trên profile.';await sleep(2000);return;
 }
 const {job,actor}=next;let result;
 try{tab=await openWorkTab({url:job.url,active:false},'audience:'+job.id,false);await rpc('audience-bind-tab',{tabId:tab.id,sessionId:cycleSession});await waitFacebookTab(tab.id,id=>chrome.tabs.get(id),sleep);const [read]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:facebookAudience,args:['public',{jobId:job.id,token:job.token,actorUid:actor.uid,url:job.url}]});result=read?.result||{ok:false,error:'Facebook chưa trả kết quả.'};}
 catch(error){result={ok:false,error:error.message};}
 finally{if(tab)await closeWorkTab(tab.id);}
 await rpc('audience-finished',{jobId:job.id,token:job.token,result,sessionId:cycleSession});status.textContent=job.url+' · '+(result.ok?'Đã xác nhận Công khai':result.error);
 });}catch(error){status.textContent=error.message;await rpc('audience-stop',{sessionId:cycleSession}).catch(()=>{});}finally{busy=false;}}
setInterval(loop,1000);void loop();
