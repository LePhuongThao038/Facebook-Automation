export function countdownText(dueAt,now=Date.now(),enabled=true){
 const delta=Date.parse(dueAt)-now;if(!Number.isFinite(delta))return 'Chưa có giờ đăng';
 const total=Math.max(0,Math.ceil(delta/1000)),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60),seconds=total%60;
 const clock=[hours,minutes,seconds].map(v=>String(v).padStart(2,'0')).join(':');
 return !enabled?'Tạm dừng · '+clock:delta<=0?'Đã tới giờ · chờ lượt xử lý':'Còn '+clock;
}
