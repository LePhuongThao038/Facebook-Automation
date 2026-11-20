// 3.8.7-story: mô hình dữ liệu của vùng ĐĂNG STORY. Tách khỏi bài viết thường: tin nằm ở d.stories (không ở d.posts),
// lượt chạy có kind:'story' và đích là trang tạo tin của Facebook. Hàng chờ, giãn cách bấm và kiểm tra nick
// dùng chung với bài viết để hai loại không bấm chồng lên nhau.
export const STORY_CREATE_URL='https://www.facebook.com/stories/create';
export const STORY_IMAGE_MB=25, STORY_VIDEO_MB=200, STORY_TEXT_MAX=2000;
const IMAGE=/^image\/(?:jpeg|png|webp|gif|heic|heif)$/i, VIDEO=/^video\/(?:mp4|quicktime|webm|x-m4v)$/i;
export function storyMediaType(type){return IMAGE.test(type||'')?'image':VIDEO.test(type||'')?'video':'';}
// Link Facebook của video/Reel -> Media JSON (Media Bridge dựng MP4); link HTTPS tới ảnh -> ảnh.
export function storyFromLink(value){
 let u;try{u=new URL(String(value||'').trim());}catch{throw Error('Link không hợp lệ.');}
 if(u.protocol!=='https:')throw Error('Chỉ nhận link https.');
 if(/(^|\.)facebook\.com$/.test(u.hostname)){
  const reel=/\/reels?\/\d+/.test(u.pathname),video=/\/videos\/(?:pcb\.\d+\/)?\d+/.test(u.pathname)||(/^\/watch\/?$/.test(u.pathname)&&u.searchParams.has('v'));
  if(!reel&&!video)throw Error('Link Facebook phải là link riêng của video hoặc Reel (/reel/…, /videos/…, /watch/?v=…), không phải link bài viết.');
  return {kind:'video',media:[{type:'video',manifest:{schema:'desk.media/1',kind:reel?'reel':'video',sourceUrl:u.href}}],name:u.pathname};
 }
 return {kind:'image',media:[{type:'image',url:u.href}],name:u.pathname.split('/').pop()||u.hostname};
}
export function validStory(s){
 if(!s||typeof s!=='object')throw Error('Tin không hợp lệ.');
 if(s.kind==='text'){const t=String(s.text||'').trim();if(!t)throw Error('Tin chữ cần có nội dung.');if(t.length>STORY_TEXT_MAX)throw Error('Tin chữ tối đa '+STORY_TEXT_MAX+' ký tự.');if(s.media?.length)throw Error('Tin chữ không kèm media.');return true;}
 if(!['image','video'].includes(s.kind))throw Error('Loại tin không hợp lệ.');
 if(!Array.isArray(s.media)||s.media.length!==1)throw Error('Mỗi tin chỉ có đúng 1 ảnh hoặc 1 video.');
 const m=s.media[0];if(m.type!==s.kind)throw Error('Loại media không khớp loại tin.');
 if(!m.storyFileId&&!m.url&&!m.manifest)throw Error('Tin thiếu tệp hoặc link.');
 return true;
}
export function storyTitle(s){const base=s.kind==='text'?String(s.text||'').replace(/\s+/g,' ').trim().slice(0,60):(s.name||(s.kind==='video'?'Video':'Ảnh'));return 'Story · '+base;}
// Lượt chạy của một tin. Không dùng createJob của bài viết (caption/địa điểm/gắn thẻ/đổi ngày không áp dụng cho Story).
export function createStoryJob(s,actor,existing,{dueAt,scheduleMode,minGapMs=0,dryRun=false},now=Date.now()){
 validStory(s);
 if(!actor?.url||!actor?.name)throw Error('Liên kết tài khoản trước (nút Liên kết tài khoản).');
 const uid=(()=>{try{return new URL(actor.url).searchParams.get('id')||String(actor.uid||'');}catch{return '';}})();
 if(!/^\d+$/.test(uid))throw Error('Nick liên kết chưa có UID. Bấm "Liên kết tài khoản" lại (tự lấy UID) rồi xếp Story.');
 if(existing.some(j=>j.postId===s.id&&!['failed','cancelled'].includes(j.state)&&!(dryRun&&j.dryRun&&j.state==='cancelled')))throw Error('Tin này đã đăng hoặc đang có lượt chạy.');
 const post={id:s.id,title:storyTitle(s),text:s.kind==='text'?String(s.text).trim():'',media:structuredClone(s.media||[]),storyKind:s.kind};
 return {id:crypto.randomUUID(),token:crypto.randomUUID(),kind:'story',postId:s.id,post,expectedMedia:post.media.map(m=>m.type),target:STORY_CREATE_URL,audience:'default',actor:structuredClone(actor),tags:[],state:'queued',stage:'queued',dueAt:new Date(dueAt??now).toISOString(),requestedTime:null,backdate:false,createdAt:new Date(now).toISOString(),attempt:1,evidence:[],postUrl:'',submittedAt:null,scheduleMode:scheduleMode||'manual',minGapMs,cardScheduled:true,dryRun:Boolean(dryRun)};
}
