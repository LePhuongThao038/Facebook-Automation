export const REVIEW_KEY='deskManualPostReviewV1';
export function candidates(db,review){
 const active=new Set((db.bot?.jobs||[]).filter(j=>!['failed','cancelled'].includes(j.state)).map(j=>j.postId));
 return (db.posts||[]).filter(p=>['draft','prepared','error'].includes(p.state)&&!active.has(p.id)&&!review.records?.[p.id]&&((p.text||'').trim()||(p.media||[]).some(m=>['image','video'].includes(m.type))));
}
export function finish(review,id,status,now=Date.now(),note=''){
 if(review.records?.[id])throw Error('Bài này đã được ghi nhận ở cửa sổ khác.');
 if(!['confirmed','error'].includes(status))throw Error('Trạng thái không hợp lệ');
 return {...review,records:{...review.records,[id]:{status,at:now,note}},nextAt:status==='error'?now:now+(review.minutes||5)*60000};
}
