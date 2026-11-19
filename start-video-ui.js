const button=document.getElementById('media-start-video');
const result=document.getElementById('media-bridge-result');
document.getElementById('media-start-id').value=chrome.runtime.id;
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function health(){
 const response=await fetch('http://127.0.0.1:47833/health',{credentials:'omit',signal:AbortSignal.timeout(2000)});
 if(!response.ok)throw Error('Media Bridge trả HTTP '+response.status+(response.status===403?' · ID chưa được ghép.':'.'));
 const data=await response.json();
 if(data.schema!=='desk.media/1')throw Error('Cổng 47833 đang chạy chương trình khác.');
 return data;
}
button.addEventListener('click',async()=>{
 button.disabled=true;
 try{
  // Always pair this profile before reusing a running bridge.
  result.textContent='Đang mở Media Bridge chạy ngầm…';
  const response=await chrome.runtime.sendMessage({type:'media-start-video'});
  if(!response?.ok)throw Error(response?.error||'Extension chưa phản hồi.');
  const start=Date.now();let lastError='';
  while(Date.now()-start<180000){
   try{const data=await health();result.textContent=`Video sẵn sàng · chạy ngầm · MP4 tối đa ${data.maxMB} MB. Có thể đóng phần cài đặt.`;return;}catch(error){lastError=error.message;}
   result.textContent=`Đang chuẩn bị video · ${Math.floor((Date.now()-start)/1000)} giây. Lần đầu có thể cần cài thư viện Python.`;
   await sleep(1000);
  }
  throw Error('Chưa kết nối sau 3 phút. '+lastError+' Xem %LOCALAPPDATA%\\FacebookDeskMedia\\start-video.log.');
 }catch(error){result.textContent=error.message;}finally{button.disabled=false;}
});
