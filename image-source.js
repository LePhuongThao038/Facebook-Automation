// Only raster image data from Docs may bypass HTTPS. Video still requires HTTPS.
export function imageSourceUrl(value){
 const text=typeof value==='string'?value.trim():'';
 if(!text.startsWith('data:')){try{const u=new URL(text);return u.protocol==='https:'&&!u.username&&!u.password?u.href:'';}catch{return '';}}
 const match=text.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,([A-Za-z0-9+/]+={0,2})$/i);
 if(!match||match[2].length%4||match[2].length>Math.ceil(25*1024*1024/3)*4)return '';
 let head;try{head=atob(match[2].slice(0,Math.min(match[2].length,32)));}catch{return '';}
 const valid={'image/jpeg':head.startsWith('\xff\xd8\xff'),'image/png':head.startsWith('\x89PNG\r\n\x1a\n'),'image/gif':/^GIF8[79]a/.test(head),'image/webp':head.startsWith('RIFF')&&head.slice(8,12)==='WEBP'};
 return valid[match[1].toLowerCase()]?text:'';
}
