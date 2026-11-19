import {validateRegistry,readiness,personaContext,accountUID,personaFingerprint} from './persona-model.js';
import {ROLE_SHEET_ID} from './sheet-role-policy.js';
const stable=value=>typeof value==='string'&&/^[\w.-]{1,100}$/.test(value);
export function commentPostURL(value){try{const u=new URL(value);if(u.protocol!=='https:'||!['www.facebook.com','facebook.com'].includes(u.hostname)||u.username||u.password)return '';const specific=/\/(?:posts|videos|reel)\/[\w.-]+/.test(u.pathname)||/^\/share\/[prv]\/[^/]+\/?$/.test(u.pathname)||(u.pathname==='/permalink.php'&&u.searchParams.has('story_fbid')&&u.searchParams.has('id'));return specific?u.href:'';}catch{return '';}}
async function hash(text){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));return [...new Uint8Array(bytes)].map(n=>n.toString(16).padStart(2,'0')).join('');}
export async function compileCommentPlan(input,registry,post){
 const r=validateRegistry(registry),registryFingerprint=await personaFingerprint(r);
 if(input?.schema!=='desk.comment-script/1'||!stable(input.id)||input.postId!==post?.id||!Array.isArray(input.steps)||!input.steps.length||input.steps.length>200)throw Error('Kịch bản cần mã ổn định, đúng mã bài và từ 1 đến 200 lượt.');
 const author=r.profiles.find(p=>p.id===input.authorId);if(!author||!readiness(author).ready)throw Error('Chủ bài chưa có hồ sơ đầy đủ/UID hoặc đang tạm dừng.');
 const url=commentPostURL(post.postUrl||'');if(post.postUrl&&!url)throw Error('Link phải là bài Facebook cụ thể, không phải trang cá nhân.');
 if(post.authorUid&&post.authorUid!==author.uid)throw Error('UID tác giả bài đăng khác nhân vật chủ bài đã chọn.');
 const published=post.state==='success'&&Boolean(url),authorVerified=published&&post.authorUid===author.uid;
 const gate=!published?'waiting_post':!authorVerified?'waiting_author_verification':'planned';
 const seen=new Map(),jobs=[];let offset=0,previous='';
 for(const step of input.steps){
  if(!stable(step.id)||seen.has(step.id))throw Error('Mã lượt trống, sai định dạng hoặc trùng.');
  if(typeof step.text!=='string'||!step.text.trim()||step.text.length>8000)throw Error('Mỗi lượt cần nguyên văn nội dung từ 1 đến 8.000 ký tự.');
  if(step.parentId&&!seen.has(step.parentId))throw Error('Reply phải trỏ đến một lượt trước nó; không được tạo vòng hoặc bỏ lượt cha.');
  if(!Number.isInteger(step.delaySeconds)||step.delaySeconds<60||step.delaySeconds>86400)throw Error('Độ trễ mỗi lượt từ 60 đến 86.400 giây.');
  const recipient=step.parentId?seen.get(step.parentId).actorId:author.id;
  const selfComment=step.actorId===author.id&&recipient===author.id;
  const context=selfComment?{schema:'desk.persona-context/1',registryId:r.registryId,revision:r.revision,speaker:structuredClone(author),target:{id:author.id,uid:author.uid,alias:author.alias,name:author.name},relationship:{from:author.id,to:author.id,role:'author',self:'mình',other:'mọi người',notes:'Tác giả viết comment trực tiếp dưới bài của mình; không giả làm người khác.'},topic:'Lời thoại tác giả đã có trong Docs.',capabilities:{previewOnly:true,canSendComment:false}}:personaContext(r,step.actorId,recipient,'Trao đổi theo kịch bản có sẵn; giữ nguyên văn bản.');
  offset+=step.delaySeconds;
  const dependencies=[...new Set([previous,step.parentId].filter(Boolean))];
  const id=[r.registryId,input.id,post.id,step.id].map(encodeURIComponent).join(':');
  jobs.push({id,stepId:step.id,postId:post.id,postUrl:url,actorId:step.actorId,actorUid:context.speaker.uid,recipientId:recipient,recipientUid:context.target.uid,kind:step.parentId?'reply':'comment',parentStepId:step.parentId||'',dependsOnStepIds:dependencies,text:step.text,textSha256:await hash(step.text),delayAfterPreviousSeconds:step.delaySeconds,earliestOffsetSeconds:offset,state:gate,personaRevision:r.revision,personaFingerprint:registryFingerprint,context,execution:{attempt:0,sentAt:null,receiptUrl:null,uncertain:false}});
  jobs.at(-1).requirePublic=author.source?.spreadsheetId===ROLE_SHEET_ID;
  seen.set(step.id,step);previous=step.id;
 }
 return {schema:'desk.comment-plan/1',id:input.id,sourceScript:structuredClone(input),registryId:r.registryId,registryRevision:r.revision,registryFingerprint,post:{id:post.id,url,authorId:author.id,authorUid:author.uid,authorVerified,published},state:gate,jobs,capabilities:{agentRequired:false,canSendComment:false,mode:'design-preview'},runtimeRequirements:['Máy bật, không sleep; Chrome và mạng còn hoạt động','Xác minh lại UID và fingerprint danh bạ trước mỗi lượt','Kho job và receipt dùng chung giữa các Chrome Profile','Chỉ reply sau receipt của lượt cha; giãn cách tính từ hoàn tất thật','Ghi trạng thái sending trước thao tác; không tự gửi lại khi kết quả chưa rõ']};
}
export function commentPostSnapshot(state,postId){
 const p=state.posts?.find(p=>p.id===postId);if(!p)throw Error('Không tìm thấy bài đã nhập.');
 const job=(state.bot?.jobs||[]).filter(j=>j.postId===postId&&j.state==='success').at(-1);
 return {id:p.id,state:p.state,postUrl:p.postUrl||job?.postUrl||'',authorUid:job?accountUID(job.actor?.url):''};
}
