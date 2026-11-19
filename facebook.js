export async function prepareFacebook(payload){
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));const visible=el=>el.getClientRects().length>0;
 const dialog=()=>[...document.querySelectorAll('[role="dialog"]')].filter(visible).find(el=>/tạo bài viết|create post/i.test(el.innerText));
 let box=dialog();if(!box){const opener=[...document.querySelectorAll('[role="button"],button')].filter(visible).find(el=>/^(bạn đang nghĩ gì|what.s on your mind)/i.test((el.innerText||el.getAttribute('aria-label')||'').trim()));if(opener){opener.click();for(let i=0;i<20&&!dialog();i++)await sleep(300);}box=dialog();}
 if(!box)return {ok:false,error:'Mở hộp Tạo bài viết trên đúng tài khoản Facebook rồi thử lại.'};
 const editors=[...box.querySelectorAll('[contenteditable="true"][role="textbox"]')].filter(visible);if(editors.length!==1)return {ok:false,error:'Không xác định được ô soạn bài Facebook.'};
 const editor=editors[0];if(editor.innerText.trim())return {ok:false,error:'Ô soạn bài đã có nội dung. Extension không ghi đè; kiểm tra nội dung hiện có.'};
 if(payload.files.length){
  let input=box.querySelector('input[type="file"][accept*="image"],input[type="file"][accept*="video"]');
  if(!input){const add=[...box.querySelectorAll('[role="button"],button')].find(el=>/^(ảnh\/video|photo\/video|photos\/videos)$/i.test((el.getAttribute('aria-label')||el.innerText||'').trim()));if(add){add.click();await sleep(600);}input=box.querySelector('input[type="file"][accept*="image"],input[type="file"][accept*="video"]');}
  if(!input)return {ok:false,error:'Không tìm thấy chỗ tải ảnh/video. Thêm media thủ công; chưa chèn chữ.'};
  const dt=new DataTransfer();for(const f of payload.files){if(f.transferId){const record=globalThis.__deskStagedFiles?.get(f.transferId);if(!record||record.next!==f.chunks||record.size!==f.size)throw Error('Chưa chuyển đủ tệp '+f.name);dt.items.add(new File(record.parts,f.name,{type:f.type}));globalThis.__deskStagedFiles.delete(f.transferId);}else {const raw=atob(f.base64);dt.items.add(new File([Uint8Array.from(raw,c=>c.charCodeAt(0))],f.name,{type:f.type}));}}input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));await sleep(1000);
 }
 if(!payload.text?.trim()){if(!payload.files.length)return {ok:false,error:'Bài không có chữ và không có ảnh/video.'};return {ok:true,message:'Bài chỉ có ảnh/video: đã chuyển '+payload.files.length+' tệp vào ô tải lên. Kiểm tra media và thông số, rồi bấm Đăng trên Facebook.'};}
 editor.focus();const range=document.createRange();range.selectNodeContents(editor);const selection=getSelection();selection.removeAllRanges();selection.addRange(range);
 if(!document.execCommand('insertText',false,payload.text)||!editor.innerText.trim())return {ok:false,error:'Facebook chưa nhận chữ; media có thể đã tải. Kiểm tra tab trước khi thử lại.'};
 return {ok:true,message:'Đã điền chữ'+(payload.files.length?' và chuyển '+payload.files.length+' tệp vào ô tải lên':'')+'. Kiểm tra media và thông số, rồi bấm Đăng trên Facebook.'};
}
