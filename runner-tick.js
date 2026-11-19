// 3.8.7: Chrome hãm setInterval của tab nền xuống 1 lần/phút ("intensive throttling"), nên tab
// "Bot đang chạy" (luôn nằm sau tab Facebook) chỉ hỏi việc mỗi phút. Timer trong Worker không bị hãm.
setInterval(()=>postMessage('tick'),2000);
