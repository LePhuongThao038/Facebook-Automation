import {imageSourceUrl} from './image-source.js';
export function mediaFetchUrl(value){
 if(typeof value==='string'&&value.trim().startsWith('data:')){const image=imageSourceUrl(value);if(!image)throw Error('Ảnh nhúng không hợp lệ, sai loại hoặc vượt 25 MB.');return image;}
 let u;try{u=new URL(typeof value==='string'?value.trim():'');}catch{throw Error('Link ảnh/video trống hoặc sai định dạng. Kiểm tra lại media của bài trong Docs.');}if(u.protocol!=='https:'||u.username||u.password)throw Error('Media cần liên kết HTTPS.');
 if(u.hostname==='drive.google.com'){
  const id=u.pathname.match(/^\/file\/d\/([\w-]+)/)?.[1]||u.searchParams.get('id');
  if(!id||!/^[-\w]+$/.test(id))throw Error('Link Drive cần trỏ tới một tệp cụ thể.');
  return 'https://drive.usercontent.google.com/download?id='+encodeURIComponent(id)+'&export=download';
 }
 return u.href;
}
export function mediaType(header,bytes,expected){
 const declared=String(header||'').split(';')[0].trim().toLowerCase();
 if(declared.startsWith(expected+'/'))return declared;
 if(declared&&!['application/octet-stream','binary/octet-stream'].includes(declared))throw Error('Media là trang web hoặc sai loại tệp. Cần link tệp tải trực tiếp.');
 const ascii=(a,b)=>String.fromCharCode(...bytes.subarray(a,b));
 if(expected==='video'){
  if(ascii(4,8)==='ftyp')return ascii(8,12)==='qt  '?'video/quicktime':'video/mp4';
  if(bytes[0]===0x1a&&bytes[1]===0x45&&bytes[2]===0xdf&&bytes[3]===0xa3&&ascii(0,Math.min(bytes.length,4096)).includes('webm'))return 'video/webm';
 }
 if(expected==='image'){
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return 'image/jpeg';
  if(bytes[0]===0x89&&ascii(1,8)==='PNG\r\n\x1a\n')return 'image/png';
  if(/^GIF8[79]a$/.test(ascii(0,6)))return 'image/gif';
  if(ascii(0,4)==='RIFF'&&ascii(8,12)==='WEBP')return 'image/webp';
 }
 throw Error('Không nhận diện được tệp '+expected+'. Cần tệp media thật, không phải trang xem/tải xuống.');
}
export function mediaOrigins(posts){return [...new Set(posts.flatMap(p=>(p.media||[]).flatMap(m=>{if(m.manifest)return [];if(String(m.url).startsWith('data:')){mediaFetchUrl(m.url);return [];}const original=new URL(m.url),resolved=new URL(mediaFetchUrl(m.url));return [original.origin+'/*',resolved.origin+'/*'];})))];}
