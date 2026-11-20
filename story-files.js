// 3.8.7-story: tệp ảnh/video người dùng chọn cho Story được giữ trong IndexedDB riêng của extension
// (không ở chrome.storage, vì video có thể tới 200 MB). Dashboard ghi, background đọc khi tới lượt đăng.
// Tệp bị xóa khi người dùng xóa tin khỏi danh sách Story.
const DB='desk-story-files';
const open=()=>new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>r.result.createObjectStore('files',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function tx(mode,fn){const db=await open();try{return await new Promise((resolve,reject)=>{const t=db.transaction('files',mode),store=t.objectStore('files');let value;t.oncomplete=()=>resolve(value);t.onerror=t.onabort=()=>reject(t.error||Error('Không lưu được tệp Story.'));fn(store,v=>value=v);});}finally{db.close();}}
export async function putStoryFile(file){
 if(!(file instanceof Blob)||!file.size)throw Error('Tệp rỗng.');
 const id=crypto.randomUUID();
 await tx('readwrite',store=>store.put({id,blob:file,name:String(file.name||'story').slice(0,120),type:file.type||'',size:file.size,at:Date.now()}));
 return {id,name:String(file.name||'story').slice(0,120),type:file.type||'',size:file.size};
}
export async function getStoryFile(id){return tx('readonly',(store,set)=>{const r=store.get(String(id||''));r.onsuccess=()=>set(r.result||null);});}
export async function deleteStoryFile(id){if(id)await tx('readwrite',store=>store.delete(String(id)));}
