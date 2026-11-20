// 3.8.7: phiên bản lấy từ manifest Chrome đang nạp, không viết cứng (bản cũ ghi "3.8.5 RC11" ở tiêu đề,
// nhãn và hộp kiểm tra, nên người vận hành chạy 3.8.7 vẫn thấy chữ 3.8.5).
const loaded=(()=>{try{const m=chrome.runtime.getManifest();return {name:m.version_name||m.version,version:m.version};}catch{return {name:'?',version:'?'};}})();
export const deskVersion=loaded.version;
for(const label of document.querySelectorAll('.version'))label.textContent=loaded.name;
// Tiêu đề tab cũng là tên tệp CSV tự lưu (autosave-ui), nên chỉ đặt khi chưa nhận diện nick; không chèn số phiên bản.
if(!/· FB Desk/.test(document.title))document.title='FB Desk';

// Tab giao diện mở từ bản trước khi bấm ↻: manifest hiện tại khác bản lúc mở tab, hoặc ngữ cảnh extension đã mất.
function currentVersion(){try{const m=chrome.runtime.getManifest();return m.version_name||m.version;}catch{return null;}}
function staleNotice(){
 const now=currentVersion();if(now===loaded.name)return;
 if(document.getElementById('stale-build'))return;
 const bar=document.createElement('div');bar.id='stale-build';bar.setAttribute('role','alert');
 bar.style.cssText='position:sticky;top:0;z-index:50;padding:10px 14px;background:#fde8e8;color:#7a1d1d;border-bottom:1px solid #f3b4b4;font-weight:600';
 bar.textContent='Tab này đang chạy giao diện '+loaded.name+(now?', còn Chrome đã nạp '+now:', còn extension đã được tải lại')+'. Mở lại tab để dùng đúng bản. ';
 const reload=document.createElement('button');reload.type='button';reload.textContent='Mở lại tab';reload.addEventListener('click',()=>location.reload());
 bar.append(reload);document.body.prepend(bar);
}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')staleNotice();});
addEventListener('focus',staleNotice);

const button=document.getElementById('build-info');
button?.addEventListener('click',()=>{
 const now=currentVersion();
 const dialog=document.createElement('dialog');
 const title=document.createElement('h2');title.textContent='Thông tin bản đang chạy';
 const body=document.createElement('p');body.style.whiteSpace='pre-line';
 body.textContent='Bản Chrome đang nạp: '+(now||'(extension đã được tải lại)')+'\nBản giao diện của tab này: '+loaded.name+'\nID tiện ích: '+chrome.runtime.id+'\n'+(now===loaded.name?'Giao diện và bản Chrome đang nạp trùng nhau. Đối chiếu ID này với ID cũ để chắc là đã cập nhật tại chỗ (cùng thư mục).':'Tab này mở từ bản trước. Mở lại tab FB Desk.')+'\nViệc kiểm tra này không sửa tiến độ hoặc cài đặt.';
 const close=document.createElement('button');close.type='button';close.textContent='Đóng';close.addEventListener('click',()=>dialog.close());
 dialog.append(title,body,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
});
