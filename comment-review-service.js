import {REVIEW_KEY,emptyReview,importReviewPlans,changeReview,exportReview,postAddress,reviewIssues} from './comment-review-model.js';
export function commentReviewService(){
 let bundledMappings;
 const read=async()=>{const raw=await chrome.storage.local.get([REVIEW_KEY,'deskPersonas','deskCrossMappings','deskV2']);let mappings=raw.deskCrossMappings||{};if(!Object.keys(mappings).length){bundledMappings||=fetch(chrome.runtime.getURL('CROSS-COMMENT-FIXED-ROLES.json')).then(r=>{if(!r.ok)throw Error('Không đọc được bảng vai cố định đi kèm.');return r.json();});mappings=(await bundledMappings).bindings||{};}return {queue:raw[REVIEW_KEY]||emptyReview(),registry:raw.deskPersonas,posts:raw.deskV2?.posts||[],mappings};};
 function docsURL(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='docs.google.com'&&!u.username&&!u.password&&/^\/document\/d\/[\w-]+(?:\/|$)/.test(u.pathname)?u.href:'';}catch{return '';}}
 return async(msg,sender)=>{
  if(sender.id!==chrome.runtime.id||sender.url!==chrome.runtime.getURL('dashboard.html'))throw Error('Chỉ thao tác hàng chờ từ bảng điều khiển FB Desk.');
  if(msg.type==='review-state'){const v=await read();return {queue:exportReview(v.queue),checks:Object.fromEntries(v.queue.items.map(i=>[i.key,i.checks||{}])),issues:Object.fromEntries(v.queue.items.map(i=>[i.key,reviewIssues(i,v.queue.items,v.registry,v.mappings)]))};}
  if(msg.type==='review-export')return exportReview((await read()).queue);
  if(msg.type==='review-open'){
   const v=await read(),item=v.queue.items.find(i=>i.key===msg.key);if(!item)throw Error('Không có lượt tương ứng.');
   const url=msg.target==='docs'?docsURL(item.docsUrl):msg.target==='parent'?postAddress(v.queue.items.find(i=>i.key===item.parentKey)?.receiptUrl)?.url:postAddress(item.postUrl)?.url;
   if(!url)throw Error('Chưa có link hợp lệ để mở.');await chrome.tabs.create({url,active:true});return {opened:true};
  }
  if(msg.type==='review-copy'){
   const v=await read(),item=v.queue.items.find(i=>i.key===msg.key);if(!item)throw Error('Không có lượt tương ứng.');const issues=reviewIssues(item,v.queue.items,v.registry,v.mappings);if(issues.length)throw Error(issues[0]);return {text:item.text};
  }
  return navigator.locks.request('desk-comment-review',async()=>{
   const v=await read();if(msg.revision!==v.queue.revision)throw Error('Hàng chờ đã đổi ở cửa sổ khác. Bấm Tải lại trước khi thao tác.');
   let result,next;
   if(msg.type==='review-import'||msg.type==='review-load-saved'){
    const input=msg.type==='review-load-saved'?(await chrome.storage.local.get('deskCrossDraft')).deskCrossDraft:msg.input;
    if(!input)throw Error('Chưa có bản nháp cũ trong profile này. Nhập file JSON đã xuất trước đây.');
    if(JSON.stringify(input).length>4*1024*1024)throw Error('File kế hoạch tối đa 4 MB.');
    const imported=await importReviewPlans(v.queue,input,v);next=imported.queue;result={added:imported.added,existing:imported.existing,updated:imported.updated};
   }else if(msg.type==='review-change'){next=await changeReview(v.queue,msg.key,msg.action,msg.data||{},v);result={saved:true};}
   else throw Error('Tác vụ duyệt không hợp lệ.');
   await chrome.storage.local.set({[REVIEW_KEY]:next});return {...result,revision:next.revision};
  });
 };
}
