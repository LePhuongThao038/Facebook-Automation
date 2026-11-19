// Large files stay in extension IndexedDB; messages carry at most 1 MiB.
export const MEDIA_LIMIT_MB=200, IMAGE_LIMIT_MB=25, POST_LIMIT_MB=240, CHUNK_BYTES=1024*1024;
const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('desk-media-transfer',1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function transaction(mode,fn){const db=await open();try{return await new Promise((resolve,reject)=>{const tx=db.transaction('files',mode),store=tx.objectStore('files');let value;tx.oncomplete=()=>resolve(value);tx.onerror=tx.onabort=()=>reject(tx.error||Error('Không lưu được tệp tạm.'));fn(store,v=>value=v);});}finally{db.close();}}
export async function storeTransfer(blob,meta,owner){const id=crypto.randomUUID();await transaction('readwrite',(store)=>{store.put({id,blob,owner,at:Date.now()});const cursor=store.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(!c)return;if(c.value.at<Date.now()-3600000)c.delete();c.continue();};});return {...meta,transferId:id,chunks:Math.ceil(blob.size/CHUNK_BYTES),size:blob.size};}
export async function transferChunk(id,index,owner){
 if(!Number.isInteger(index)||index<0)throw Error('Chỉ số phần media không hợp lệ.');
 const record=await transaction('readonly',(store,set)=>{const r=store.get(id);r.onsuccess=()=>set(r.result);});
 if(!record||record.owner!==owner||record.at<Date.now()-3600000)throw Error('Tệp tạm hết hạn hoặc sai lượt chạy.');
 const start=index*CHUNK_BYTES;if(start>=record.blob.size)throw Error('Phần media vượt kích thước tệp.');
 const bytes=new Uint8Array(await record.blob.slice(start,start+CHUNK_BYTES).arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {base64:btoa(binary),size:bytes.length};
}
export async function releaseTransfers(owner){await transaction('readwrite',store=>{const r=store.openCursor();r.onsuccess=()=>{const c=r.result;if(!c)return;if(c.value.owner===owner)c.delete();c.continue();};});}
export function stageMediaChunk(payload){
 try{
  if(payload.jobId&&(document.documentElement.dataset.facebookDeskJob!==payload.jobId||document.documentElement.dataset.facebookDeskToken!==payload.token))throw Error('Lượt tải media đã dừng hoặc đổi.');
  const files=globalThis.__deskStagedFiles??=new Map();for(const [key,value] of files)if(value.at<Date.now()-900000)files.delete(key);
  if(payload.clear){for(const id of payload.ids||[])files.delete(id);return {ok:true};}
  const f=payload.file;if(!f||!f.transferId||!Number.isInteger(f.chunks)||f.chunks<1||f.size>240*1024*1024)throw Error('Tệp chia phần không hợp lệ.');
  if(payload.index===0)files.set(f.transferId,{parts:[],size:0,next:0,at:Date.now(),expected:f.size});
  const record=files.get(f.transferId);if(!record||record.next!==payload.index||payload.index>=f.chunks)throw Error('Sai thứ tự phần media.');
  const bytes=Uint8Array.from(atob(payload.base64),c=>c.charCodeAt(0));if(bytes.length>1024*1024||record.size+bytes.length>f.size)throw Error('Kích thước phần media sai.');
  record.parts.push(bytes);record.size+=bytes.length;record.next++;record.at=Date.now();
  if(record.next===f.chunks&&record.size!==f.size)throw Error('Chưa nhận đủ tệp media.');
  return {ok:true,size:record.size};
 }catch(error){return {ok:false,error:error.message};}
}
