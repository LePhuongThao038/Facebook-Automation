import {fbUrl} from './scenario.js';
export async function waitFacebookTab(tabId,getTab,sleep){
 for(let i=0;i<60;i++){
  const tab=await getTab(tabId);
  // New tabs can initially have no committed URL, even when status says complete.
  if(tab.status==='complete'&&!tab.pendingUrl&&tab.url&&tab.url!=='about:blank'){
   try{fbUrl(tab.url);}catch{throw Error('Tab đã chuyển ra ngoài Facebook. Mở lại Facebook trong Profile này rồi thử lại.');}
   await sleep(1200);
   const settled=await getTab(tabId);
   if(settled.status==='complete'&&!settled.pendingUrl&&settled.url===tab.url)return settled;
  }
  await sleep(500);
 }
 throw Error('Tab Facebook chưa tải xong hoặc chưa cung cấp địa chỉ sau 30 giây. Kiểm tra mạng và đăng nhập Facebook rồi thử lại.');
}
