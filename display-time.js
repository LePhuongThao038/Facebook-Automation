export function vietnamTime(value){
 const date=new Date(value);if(!value||Number.isNaN(date.getTime()))return 'Chưa có giờ hợp lệ';
 return date.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'})+' (giờ Việt Nam)';
}
export function logMessage(log){
 const text=String(log.message||'');
 return log.status==='queued'?text.replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g,vietnamTime):text;
}
