const prefix='desk-owned-tab:';
function safeDestination(raw){try{const u=new URL(raw);return u.origin==='https://www.facebook.com'||u.href==='about:blank';}catch{return false;}}
export async function openWorkTab(options,owner,posting=false){
 const tab=await chrome.tabs.create(options);
 try{await chrome.storage.session.set({[prefix+tab.id]:{owner,posting,created:Date.now(),proof:crypto.randomUUID()}});return tab;}
 catch(e){await chrome.tabs.remove(tab.id).catch(()=>{});throw e;}
}
export async function closeWorkTab(id){
 if(!Number.isInteger(id))return;
 const key=prefix+id;
 try{const rec=(await chrome.storage.session.get(key))[key];if(!rec)return;
  const tab=await chrome.tabs.get(id);
  if((!rec.root||safeDestination(tab.url)||safeDestination(tab.pendingUrl))&&(!tab.url||safeDestination(tab.url))&&(!tab.pendingUrl||safeDestination(tab.pendingUrl))&&!tab.pinned)await chrome.tabs.remove(id);
  await chrome.storage.session.remove(key);
  await chrome.storage.local?.remove?.('desk-proof:'+id);
 }catch{/* Retain the record so a later sweep can retry a failed removal. */}
}
export async function identifyWorkTab(id){
 const rec=(await chrome.storage.session.get(prefix+id))[prefix+id];
 if(!rec?.proof)return null;
 await chrome.storage.local.set({['desk-proof:'+id]:rec});
 return rec.proof;
}
let restored=false;
let checkedOldTabs=false;
async function findOldPostingTabs(jobs){
 if(checkedOldTabs||!chrome.tabs.query||!jobs.length)return;
 checkedOldTabs=true;
 const finished=new Set(jobs.filter(j=>['success','cancelled'].includes(j.state)).map(j=>j.id));
 if(!finished.size)return;
 for(const tab of await chrome.tabs.query({url:'https://www.facebook.com/*'})){
  if(tab.active||tab.pinned||(await chrome.storage.session.get(prefix+tab.id))[prefix+tab.id])continue;
  try{
   const [mark]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>document.documentElement.dataset.facebookDeskJob||''});
   if(!finished.has(mark?.result))continue;
   const current=await chrome.tabs.get(tab.id);
   if(!current.active&&!current.pinned&&current.url===tab.url)await chrome.tabs.remove(tab.id);
  }catch{}
 }
}
async function restoreWorkTabs(){
 if(restored||!chrome.storage.local?.getKeys)return;
 const keys=(await chrome.storage.local.getKeys()).filter(key=>key.startsWith('desk-proof:'));
 for(const key of keys){
  const id=Number(key.slice('desk-proof:'.length));
  if((await chrome.storage.session.get(prefix+id))[prefix+id])continue;
  try{
   const tab=await chrome.tabs.get(id);
   if(!safeDestination(tab.url)||tab.pinned)continue;
   const rec=(await chrome.storage.local.get(key))[key];
   const [found]=await chrome.scripting.executeScript({target:{tabId:id},func:()=>sessionStorage.getItem('facebookDeskTabProof')});
   if(rec?.proof&&found?.result===rec.proof)await chrome.storage.session.set({[prefix+id]:rec});
  }catch{}
 }
 restored=true;
}
export async function sweepWorkTabs(jobs){
 await restoreWorkTabs();
 await findOldPostingTabs(jobs);
 const records=await chrome.storage.session.get(null);
 let liveFriendTab;
 if(Object.values(records).some(rec=>rec?.owner==='friend-task')){
  const state=(await chrome.storage.local.get('friendDesk1')).friendDesk1;
  liveFriendTab=state?.active && state.rows.find(r=>r.token===state.active)?.tab;
 }
 for(const [key,rec] of Object.entries(records)){
  if(!key.startsWith(prefix)||Number(key.slice(prefix.length))===liveFriendTab)continue;
  const job=jobs.find(j=>j.id===rec.owner);
  if(job?.state==='queued'&&job.resumeFacebookTabId===Number(key.slice(prefix.length)))continue;
  if(job&&['running','verifying','unknown','partial'].includes(job.state))continue;
  if(job?.state==='failed'&&(job.submittedAt||job.clickDispatchedAt||job.receiptLinks?.length||job.postUrl))continue;
  if(job||Date.now()-rec.created>240000)await closeWorkTab(Number(key.slice(prefix.length)));
 }
 // Legacy posting tabs have no registry. Require both the persisted tab ID and the exact DOM job marker.
 for(const job of jobs.filter(j=>Number.isInteger(j.facebookTabId)&&['success','cancelled'].includes(j.state))){
  try{const tab=await chrome.tabs.get(job.facebookTabId);
   if(tab.active||tab.pinned||!safeDestination(tab.url))continue;
   const r=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>document.documentElement.dataset.facebookDeskJob||''});
   if(r[0]?.result===job.id)await chrome.tabs.remove(tab.id);
  }catch{}
 }
}

// Chrome reports the source frame even when the site opens a noopener window.
// Do not adopt tabs based on openerTabId, title, or a Facebook URL alone.
let childQueue=Promise.resolve();
function inOrder(fn){const r=childQueue.then(fn);childQueue=r.catch(()=>{});return r;}
async function forgetChildren(root){
 const all=await chrome.storage.session.get(null);
 for(const [key,rec] of Object.entries(all)){
  if(key.startsWith(prefix)&&rec?.root===root)await closeWorkTab(Number(key.slice(prefix.length)));
 }
}
export function finishPostingChildren(root){return inOrder(()=>forgetChildren(root));}
export function trackPostingChildren(){
 chrome.webNavigation.onCreatedNavigationTarget.addListener(e=>{
  if(e.sourceFrameId!==0||!safeDestination(e.url))return;
  void inOrder(async()=>{
   const key=prefix+e.sourceTabId,parent=(await chrome.storage.session.get(key))[key];
   if(!parent?.posting)return;
   const root=parent.root??e.sourceTabId;
   const guard=(await chrome.scripting.executeScript({target:{tabId:e.sourceTabId},func:()=>{
    const g=globalThis.__deskTabGesture;
    return g?{human:g.human,actionAt:g.actionAt}:null;
   }}))[0]?.result;
   if(!guard||guard.human||(!parent.root&&(!guard.actionAt||Math.abs(e.timeStamp-guard.actionAt)>15000)))return;
   const tab=await chrome.tabs.get(e.tabId);
   if(tab.pinned||(tab.url&&!safeDestination(tab.url))||(tab.pendingUrl&&!safeDestination(tab.pendingUrl)))return;
   await chrome.storage.session.set({[prefix+e.tabId]:{posting:true,root,owner:parent.owner,created:Date.now(),proof:crypto.randomUUID()}});
  }).catch(()=>{});
 });
 chrome.tabs.onRemoved.addListener(id=>{
  void inOrder(async()=>{
   const key=prefix+id,rec=(await chrome.storage.session.get(key))[key];
   // The runner may already have dropped the root record in its own context.
   if(!rec||!rec.root)await forgetChildren(id);
   if(rec)await chrome.storage.session.remove(key);
   await chrome.storage.local?.remove?.('desk-proof:'+id);
  }).catch(()=>{});
 });
}
