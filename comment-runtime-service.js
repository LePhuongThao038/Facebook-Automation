// Compatibility barrier: legacy jobs and old runner tabs cannot send comments.
export function commentRuntimeService(){
 return {
  async ensureRunner(){
   await navigator.locks.request('desk-comment-config',async()=>{
    const c=(await chrome.storage.local.get('deskComments')).deskComments;
    if(c?.enabled)await chrome.storage.local.set({deskComments:{...c,enabled:false,_rev:(c._rev||0)+1,last:'3.8.4: hàng chờ duyệt thủ công; worker gửi tự động đã dừng.'}});
   });
  },
  async handle(){throw Error('Bản 3.8.4 chỉ dùng hàng chờ duyệt. Không có worker gửi comment tự động.');}
 };
}
