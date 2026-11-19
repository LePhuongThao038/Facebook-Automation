// Refresh source media without erasing local caption edits or reopening published posts.
export function refreshSourceMedia(d,old,next){
 const jobs=(d.bot?.jobs||[]).filter(j=>j.postId===old.id);
 if(old.state==='success'||jobs.some(j=>j.state==='success'))return 'published';
 const incoming=(next.media||[]).filter(m=>m.type==='image').length,previous=(old.media||[]).filter(m=>m.type==='image').length;
 const expected=Math.max(next.sourceImageCount??incoming,(old.original?.media||[]).filter(m=>m.type==='image').length,old.mediaReadError?old.sourceImageCount||0:0);
 if(jobs.some(j=>['running','verifying','unknown','partial'].includes(j.state))){old.mediaRefreshPending=true;return 'pending';}
 if(next.mediaReadError||incoming<expected||incoming<previous){
  old.mediaReadError=true;old.mediaAudit={expectedImages:Math.max(expected,previous),parsedImages:incoming,storedImages:previous,reason:'Không tự xóa ảnh cũ khi lần đọc mới thiếu ảnh.'};
  if(d.bot){d.bot.enabled=false;d.bot.pauseReason='Đọc Docs thiếu ảnh. Đã giữ ảnh cũ và dừng hàng chờ.';}
  for(const j of jobs.filter(j=>j.state==='queued'))j.state='cancelled';
  old.state='error';return 'blocked';
 }
 const changed=JSON.stringify(old.media||[])!==JSON.stringify(next.media||[]);
 if(!changed){old.sourceImageCount=expected;old.mediaReadError=false;old.mediaRefreshPending=false;old.missingVideo=next.missingVideo;old.sourceKind=next.sourceKind;old.mediaAudit={expectedImages:expected,parsedImages:incoming,storedImages:incoming};return 'unchanged';}
 old.media=structuredClone(next.media);old.sourceImageCount=expected;old.mediaReadError=false;old.mediaRefreshPending=false;old.missingVideo=next.missingVideo;old.sourceKind=next.sourceKind;
 old.original={...(old.original||next),media:structuredClone(next.media),sourceImageCount:expected};
 old.mediaAudit={expectedImages:expected,parsedImages:incoming,storedImages:incoming};
 for(const j of jobs.filter(j=>j.state==='queued')){j.state='cancelled';j.stage='source-media-refreshed';}
 if(jobs.some(j=>j.stage==='source-media-refreshed')){old.state='draft';d.bot.enabled=false;d.bot.plan=null;d.bot.pauseReason='Ảnh nguồn đã cập nhật. Xếp lịch lại phần chưa đăng để dùng đúng tệp mới.';}
 return previous===0&&incoming>0?'recovered':'refreshed';
}
