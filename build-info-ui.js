const button=document.getElementById('build-info');
button?.addEventListener('click',()=>{
 const manifest=chrome.runtime.getManifest();
 const matches=manifest.version_name?.startsWith('3.8.5 RC11');
 const dialog=document.createElement('dialog');
 const title=document.createElement('h2');title.textContent='Thông tin bản đang chạy';
 const body=document.createElement('p');body.style.whiteSpace='pre-line';
 body.textContent='Bản Chrome đang nạp: '+(manifest.version_name||manifest.version)+'\nID tiện ích: '+chrome.runtime.id+'\nBản giao diện: 3.8.5 RC11\n'+(matches?'Chrome đã nạp bản RC11. Đối chiếu ID này với ID cũ để xác nhận cập nhật tại chỗ.':'Giao diện mới nhưng Chrome chưa nạp manifest RC11. Chờ tác vụ đang chạy kết thúc rồi bấm ↻ tại chrome://extensions, sau đó mở lại FB Desk.')+'\nViệc kiểm tra này không sửa tiến độ hoặc cài đặt.';
 const close=document.createElement('button');close.type='button';close.textContent='Đóng';close.addEventListener('click',()=>dialog.close());
 dialog.append(title,body,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
});
