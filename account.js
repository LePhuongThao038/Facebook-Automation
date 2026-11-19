import {openWorkTab,closeWorkTab} from './work-tabs.js';
import {waitFacebookTab} from './tab-ready.js';
import {facebookBot} from './facebook-bot.js';

const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let pendingSelf;

async function readOwnProfile(url='https://www.facebook.com/me/',action='own-profile'){
 const tab=await openWorkTab({url,active:false},'identify');
 try{
  await waitFacebookTab(tab.id,id=>chrome.tabs.get(id),sleep);
  const [read]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:facebookBot,args:[action,{}]});
  if(!read?.result?.ok)throw Error(read?.result?.error||'Không đọc được trang cá nhân.');
  return read.result.actor;
 }finally{await closeWorkTab(tab.id);}
}

function profileUrl(value){
 const raw=String(value||'').trim();
 if(/^\d+$/.test(raw))return 'https://www.facebook.com/profile.php?id='+raw;
 let u;try{u=new URL(raw);}catch{}
 if(u?.protocol==='https:'&&['www.facebook.com','facebook.com','m.facebook.com'].includes(u.hostname)&&!u.port&&!u.username&&!u.password){
  if(u.pathname==='/profile.php'&&/^\d+$/.test(u.searchParams.get('id')||''))return 'https://www.facebook.com/profile.php?id='+u.searchParams.get('id');
  if(/^\/(?:[\w.]+|people\/[^/]+\/\d+)\/?$/.test(u.pathname))return 'https://www.facebook.com'+u.pathname.replace(/\/$/,'');
 }
 throw Error('Nhập UID hoặc link HTTPS tới trang cá nhân Facebook.');
}
async function verifyLinked(url,preferOpen=false){
 let diagnostic='';
 if(preferOpen){
  const tabs=await chrome.tabs.query({url:'https://www.facebook.com/*'});
  for(const t of tabs.sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))){
   try{
    if(t.discarded||profileUrl(t.url)!==url)continue;
    const [r]=await chrome.scripting.executeScript({target:{tabId:t.id},func:facebookBot,args:['profile-tab',{}]});
    if(r.result?.ok&&profileUrl(r.result.actor.url)===url)return r.result.actor;
    diagnostic=r.result?.error||'Không đọc được tab đang mở.';
   }catch{}
  }
 }
 // /me/ is resolved by the signed-in Facebook session, independently of the edit button.
 const tab=await openWorkTab({url:'https://www.facebook.com/me/',active:false},'identify');
 try{
  const settled=await waitFacebookTab(tab.id,id=>chrome.tabs.get(id),sleep);
  let redirected;try{redirected=profileUrl(settled.url);}catch{}
  if(redirected===url && !/\/me$/i.test(url)){
   const [r]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:facebookBot,args:['own-profile',{}]});
   if(profileUrl((await chrome.tabs.get(tab.id)).url)!==url)throw Error('Tab đã chuyển trang trong lúc xác minh.');
   if(r.result?.ok&&r.result.actor.url===url)return r.result.actor;
   if(r.result?.error?.startsWith('Facebook chưa hiển thị tên')&&/profile\.php\?id=\d+$/.test(url))return {name:'UID '+new URL(url).searchParams.get('id'),url};
  }
  if(redirected&&/profile\.php\?id=\d+$/.test(url)&&/profile\.php\?id=\d+$/.test(redirected)&&redirected!==url)
   throw Error('Facebook /me/ chuyển đến UID khác. Kiểm tra lại nick đang đăng nhập.');
 }finally{await closeWorkTab(tab.id);}
 try{return await readOwnProfile(url,'verify-profile');}
 catch(e){throw Error('3.4.4 · '+(diagnostic?diagnostic+' · ':'')+'Không khớp link /me/. '+e.message);}
}
export async function linkAccount(value){
 const url=profileUrl(value),actor=await verifyLinked(url,true);
 if(profileUrl(actor.url)!==url)throw Error('Facebook chuyển sang một trang khác. Dùng link cuối cùng trên thanh địa chỉ.');
 await chrome.storage.local.set({deskLinkedActor:actor});return actor;
}
export async function detectAccount(allowOwnProfile=true,display=false){
 const linked=(await chrome.storage.local.get('deskLinkedActor')).deskLinkedActor;
 if(linked&&allowOwnProfile){
  const actor=await verifyLinked(profileUrl(linked.url));
  if(actor.url!==linked.url)throw Error('Tài khoản Facebook đã thay đổi. Hãy liên kết lại.');
  return actor;
 }
 const tabs=await chrome.tabs.query({url:'https://www.facebook.com/*'});
 if(display){
  for(const t of tabs.filter(t=>t.status==='complete'&&!t.discarded&&t.url&&new URL(t.url).pathname!=='/').sort((a,b)=>Number(b.active)-Number(a.active)).slice(0,4)){
   try{const [r]=await chrome.scripting.executeScript({target:{tabId:t.id},func:facebookBot,args:['profile-tab',{}]});
    if(r.result?.ok&&(!linked||linked.url===r.result.actor.url))return r.result.actor;
   }catch{}
  }
 }
 const homes=tabs.filter(t=>t.url&&new URL(t.url).pathname==='/'&&!t.discarded&&t.status==='complete');
 for(const tab of homes.sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0)).slice(0,3)){
  try{
   const [read]=await chrome.scripting.executeScript({target:{tabId:tab.id},func:facebookBot,args:['identity',{}]});
   if(read?.result?.ok&&(!linked||read.result.actor.url===linked.url))return read.result.actor;
  }catch{}
 }
 if(!allowOwnProfile)throw Error('Bấm ↻ để kiểm tra tài khoản Facebook của Profile này.');
 if(!pendingSelf)pendingSelf=readOwnProfile().finally(()=>{pendingSelf=null;});
 return pendingSelf;
}
