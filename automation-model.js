import {parseTime,fbUrl} from './scenario.js';
export const terminalStates=['success','failed','partial','unknown','cancelled'];
export function normalizedProfile(value){const u=new URL(fbUrl(value));const id=u.searchParams.get('id');return u.pathname==='/profile.php'&&id?'id:'+id:u.pathname.replace(/\/+$/,'').toLowerCase();}
export function canonicalPost(value){try{const u=new URL(value,'https://www.facebook.com');if(!['www.facebook.com','facebook.com'].includes(u.hostname)||u.protocol!=='https:')return '';u.hostname='www.facebook.com';const story=u.searchParams.get('story_fbid'),id=u.searchParams.get('id');if(story&&id)return `https://www.facebook.com/permalink.php?story_fbid=${encodeURIComponent(story)}&id=${encodeURIComponent(id)}`;if(/\/(?:posts|videos|reel)\/[\w.-]+/.test(u.pathname))return u.origin+u.pathname.replace(/\/+$/,'');if(/^\/(?:photo.php|photo\/?|permalink.php)$/.test(u.pathname)&&u.searchParams.get('fbid'))return u.origin+'/photo.php?fbid='+encodeURIComponent(u.searchParams.get('fbid'));return '';}catch{return '';}}
export function peopleList(value){return String(value||'').split(/[;\n]+/).map(s=>s.trim()).filter(Boolean);}
export function mediaOnlyPost(post){
 return !String(post.text||'').trim() && Boolean(post.media?.some(m=>m.type==='image'||m.type==='video'));
}
export function captionIssue(post){
 if(mediaOnlyPost(post))return '';
 // 3.8.7: Post Research đánh dấu caption nghi là lời trả lời bình luận. Sửa caption trên dashboard (bỏ cờ) thì được đăng.
 if(post.captionPartial&&/nghi-tra-loi-binh-luan/.test(post.captionEvidence||''))return 'Caption nghi là lời trả lời bình luận (mở đầu bằng tên người bình luận). Mở bài gốc kiểm tra, sửa caption rồi lưu.';
 // 3.8.7-cap: không chặn caption rút gọn nữa. Runner lấy caption đầy đủ từ bài gốc trước khi đăng
 // (runner.js recoverFullCaption); không lấy được thì đăng đoạn đã có, bỏ dấu "…".
 if(post.captionState==='unreadable')return 'Chưa lấy được caption nguồn.';
 return '';
}
export function hasSubmission(record){
 return Boolean(record.submittedAt||record.clickDispatchedAt||record.receiptLinks?.length||record.postUrl||
  [record.state,record.csvOriginalStatus,record.csvPreviousStatus].some(state=>['success','partial','unknown','verifying'].includes(state)));
}
export function resetCandidate(post,jobs){
 return ['draft','prepared','error','failed'].includes(post.state)&&!hasSubmission(post)&&
  !jobs.some(job=>job.postId===post.id&&(hasSubmission(job)||!['failed','cancelled'].includes(job.state)));
}
export function resetCopy(post){
 if(!post.captionPartial||!post.media?.length)return post;
 return {...post,text:'',blocks:[],captionPartial:false};
}
export function createJob(post,settings,actor,existing,now=Date.now()){
 if(post.captionNameFilter?.status==='blocked')throw Error(post.captionNameFilter.message);
 if(!actor?.url||!actor?.name)throw Error('Liên kết tài khoản đăng trong khung Bot trước.');
 if(post.mediaReadError||(post.sourceImageCount||0)>(post.media||[]).filter(m=>m.type==='image').length)throw Error('Ảnh đọc từ Docs chưa đầy đủ. Đọc lại nguồn trước khi đăng.');
 const issue=captionIssue(post);if(issue)throw Error(issue);
 if(post.missingVideo)throw Error('Nguồn có mục video/Reels nhưng thiếu tệp. Thêm link tệp vào Docs rồi cập nhật nguồn; không đăng bài thiếu video.');
 if(!(post.text||'').trim()&&!post.media?.length)throw Error('Bài trống: cần có nội dung, ảnh hoặc video.');
 if(hasSubmission(post)||existing.some(j=>j.postId===post.id&&(hasSubmission(j)||!['failed','cancelled'].includes(j.state))))throw Error('Bài đã đăng hoặc đã có lượt chạy. Kiểm tra hàng chờ trước khi thêm lại.');
 const time=parseTime(post.time);if(time.kind==='invalid')throw Error('Thời gian không rõ: '+post.time);
 const tags=peopleList(post.withPeople);if(tags.length>20)throw Error('Tối đa 20 người mỗi bài. Tách mỗi người bằng dấu ; hoặc xuống dòng.');
 const target=fbUrl(settings.target||actor.url);
 return {id:crypto.randomUUID(),token:crypto.randomUUID(),postId:post.id,post:structuredClone(post),expectedMedia:post.media.map(m=>m.type),target,audience:'default',actor:structuredClone(actor),tags,state:'queued',stage:'queued',dueAt:time.kind==='future'?time.iso:new Date(now).toISOString(),requestedTime:time.iso,backdate:time.kind==='past',createdAt:new Date(now).toISOString(),attempt:1,evidence:[],postUrl:'',submittedAt:null};
}
export function dueJob(jobs,now=Date.now()){return jobs.filter(j=>j.state==='queued'&&Date.parse(j.dueAt)<=now).sort((a,b)=>Date.parse(a.dueAt)-Date.parse(b.dueAt))[0]||null;}
export function botDefaults(){return {enabled:false,actor:null,runnerTabId:null,jobs:[],lastFinishedAt:0};}
export function publicJob(j){const {token,...safe}=j;return safe;}
