// Local review records only. This module has no browser, network or send capability.
export const REVIEW_KEY='deskCommentReview';
export const REVIEW_SCHEMA='desk.comment-review/1';
export const REVIEW_CHECKS=['actor','target','source','role'];
const uid=v=>typeof v==='string'&&/^\d{5,25}$/.test(v);
const str=(v,max=8000)=>typeof v==='string'?v.slice(0,max):'';
export const emptyReview=()=>({schema:REVIEW_SCHEMA,revision:0,items:[]});
export function postAddress(raw){
 try{const u=new URL(raw);if(u.protocol!=='https:'||!['facebook.com','www.facebook.com'].includes(u.hostname)||u.port||u.username||u.password)return null;
  const path=u.pathname.replace(/\/$/,'');let key='';
  if(path==='/permalink.php'&&/^[\w.-]+$/.test(u.searchParams.get('story_fbid')||'')&&uid(u.searchParams.get('id')))key='story:'+u.searchParams.get('story_fbid')+':'+u.searchParams.get('id');
  else if(/^\/(?:[\w.-]+\/)?(?:posts|videos)\/[\w.-]+$/.test(path)||/^\/reel\/[\w.-]+$/.test(path))key=path;
  if(!key)return null;
  const clean=new URL('https://www.facebook.com'+(path==='/permalink.php'?path:path+'/'));
  for(const name of ['story_fbid','id','comment_id','reply_comment_id'])if(u.searchParams.has(name))clean.searchParams.set(name,u.searchParams.get(name));
  return {url:clean.href,key,commentId:u.searchParams.get('comment_id')||'',replyId:u.searchParams.get('reply_comment_id')||'',authorUid:u.searchParams.get('id')||''};
 }catch{return null;}
}
export function receiptAddress(raw,item,parent){
 const r=postAddress(raw),p=postAddress(item.postUrl);
 if(!r||!p||r.key!==p.key||!/^\d+$/.test(r.replyId||r.commentId))throw Error('Link kết quả phải có mã comment và thuộc đúng bài đích.');
 if(item.parentKey){const pr=postAddress(parent?.receiptUrl);if(!pr||!r.replyId||r.commentId!==(pr.replyId||pr.commentId))throw Error('Link reply phải trỏ đúng comment cha đã ghi nhận.');}
 else if(r.replyId)throw Error('Đây là link reply, không phải comment trực tiếp của lượt này.');
 return r.url;
}
const norm=v=>v.normalize('NFC').replace(/\s+/g,' ').trim();
async function hash(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(value)));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
const sourceShape=i=>[i.key,i.actorId,i.actorUid,i.authorId,i.authorUid,i.role,i.slot,i.kind,i.parentKey,i.text,i.docsUrl,i.postId];
export async function checkStoredItem(item){
 if(!item||!str(item.key,600)||!uid(item.actorUid)||!uid(item.authorUid)||typeof item.text!=='string'||!item.text.trim()||item.text.length>8000||!['comment','reply'].includes(item.kind)||Boolean(item.parentKey)!==(item.kind==='reply'))throw Error('Lượt thiếu UID, nội dung hoặc loại comment/reply hợp lệ.');
 if(item.postUrl&&!postAddress(item.postUrl))throw Error('Dùng permalink bài cụ thể; không dùng link chia sẻ rút gọn hoặc trang cá nhân.');
 if(await hash(sourceShape(item))!==item.sourceHash)throw Error('Dữ liệu gốc của lượt đã thay đổi hoặc bản sao lưu không hợp lệ.');
 return item;
}
export function identityIssues(item,registry,mappings={}){
 const people=registry?.profiles||[],actor=people.find(p=>p.id===item.actorId),author=people.find(p=>p.id===item.authorId),issues=[];
 if(!actor||actor.uid!==item.actorUid||actor.enabled===false)issues.push('UID người thực hiện không còn khớp danh bạ hoặc đã tạm dừng.');
 if(!author||author.uid!==item.authorUid||author.enabled===false)issues.push('UID chủ bài không còn khớp danh bạ hoặc đã tạm dừng.');
 const normalizedSlot=String(item.slot||'').normalize('NFC').replace(/\s+/g,' ').trim().toLocaleLowerCase('vi');
 const roleKey=item.authorId+':'+(normalizedSlot.startsWith('vai:')?normalizedSlot:'vai:'+normalizedSlot);
 if(normalizedSlot&&mappings[roleKey]&&mappings[roleKey]!==item.actorId)issues.push('Phân vai đã lưu khác với người thực hiện.');
 return issues;
}
export function reviewIssues(item,items,registry,mappings={}){
 const issues=identityIssues(item,registry,mappings),address=postAddress(item.postUrl);
 if(!address)issues.push('Chưa có permalink bài đích đầy đủ.');
 else if(address.authorUid&&address.authorUid!==item.authorUid)issues.push('UID trong permalink không khớp chủ bài.');
 if(address&&items.some(other=>other.key!==item.key&&other.status!=='skipped'&&other.actorUid===item.actorUid&&other.kind===item.kind&&other.parentKey===item.parentKey&&postAddress(other.postUrl)?.key===address.key&&norm(other.text)===norm(item.text)))issues.push('Có lượt khác cùng tài khoản, bài, vị trí và nội dung. Kiểm tra trùng và bỏ qua lượt dư.');
 if(!item.docsUrl)issues.push('Chưa có link Docs nguồn để đối chiếu.');
 if(!item.role)issues.push('Lượt chưa có nhãn vai để đối chiếu.');
 if(item.parentKey){const parent=items.find(i=>i.key===item.parentKey);if(!parent||parent.status!=='manually_recorded'||!parent.receiptUrl)issues.push('Reply chờ link của đúng comment cha do bạn xác nhận.');else if(postAddress(parent.postUrl)?.key!==address?.key)issues.push('Comment cha thuộc bài khác.');}
 for(const field of REVIEW_CHECKS)if(item.checks?.[field]!==true)issues.push('Chưa duyệt: '+({actor:'tài khoản',target:'bài đích',source:'nội dung Docs',role:'vai và comment cha'}[field]));
 if(['manually_recorded','uncertain','skipped'].includes(item.status))issues.push('Lượt đã được ghi nhận, bỏ qua hoặc chưa rõ kết quả. Không chuẩn bị lại.');
 return issues;
}
export async function importReviewPlans(current,input,{registry,posts=[],mappings={},now=new Date().toISOString()}={}){
 if(current?.schema!==REVIEW_SCHEMA||!Array.isArray(current.items))throw Error('Kho duyệt không hợp lệ.');
 const isBackup=input?.schema===REVIEW_SCHEMA;
 const plans=input?.schema==='desk.cross-bundle/1'?input.plans:Array.isArray(input?.plans)?input.plans:input?.schema==='desk.comment-plan/1'?[input]:[];
 let incoming=[];
 if(isBackup){if(!Array.isArray(input.items)||input.items.length>2000)throw Error('Bản sao lưu quá lớn hoặc thiếu lượt.');for(const raw of input.items){await checkStoredItem(raw);const item={};for(const k of ['key','planId','stepId','actorId','actorUid','actorName','authorId','authorUid','authorName','postId','postUrl','docsUrl','caption','role','slot','kind','parentKey','text','sourceHash'])item[k]=raw[k]||'';item.checks={};item.status=['manually_recorded','uncertain','skipped'].includes(raw.status)?raw.status:'draft';item.receiptUrl=item.status==='manually_recorded'?str(raw.receiptUrl,2000):'';item.createdAt=now;item.updatedAt=now;item.history=[{event:'restored_from_backup',at:now}];incoming.push(item);}}
 else {
  if(!plans.length||plans.length>500)throw Error('Chọn JSON kế hoạch comment hoặc bản sao lưu hàng chờ duyệt.');
  for(const plan of plans){
   if(plan?.schema!=='desk.comment-plan/1'||!Array.isArray(plan.jobs)||!plan.jobs.length||plan.jobs.length>200)throw Error('Kế hoạch không đúng định dạng hoặc không có lượt.');
   const keys=new Map(plan.jobs.map(j=>[j.stepId,str(j.id,600)]));if(keys.size!==plan.jobs.length||[...keys.values()].some(k=>!k)||new Set(keys.values()).size!==plan.jobs.length)throw Error('Mã lượt bị trống hoặc trùng trong kế hoạch.');
   const seen=new Set();
   for(const job of plan.jobs){
    if(job.postId!==plan.post?.id)throw Error('Lượt và kế hoạch không cùng mã bài.');
    if(job.parentStepId&&!seen.has(job.parentStepId))throw Error('Reply phải trỏ comment cha đứng trước trong cùng kế hoạch.');
    const actor=registry?.profiles?.find(p=>p.id===job.actorId),author=registry?.profiles?.find(p=>p.id===plan.post?.authorId),post=posts.find(p=>p.id===job.postId),step=plan.sourceScript?.steps?.find(s=>s.id===job.stepId);
    if(step&&(step.text!==job.text||step.actorId!==job.actorId||(step.parentId||'')!==(job.parentStepId||'')))throw Error('Nội dung, người nói hoặc comment cha khác kịch bản nguồn.');
    const item={key:keys.get(job.stepId),planId:str(plan.id,120),stepId:str(job.stepId,120),actorId:str(job.actorId,120),actorUid:job.actorUid,actorName:str(actor?.alias||actor?.name||job.context?.speaker?.alias,120),authorId:str(plan.post?.authorId,120),authorUid:plan.post?.authorUid,authorName:str(author?.alias||author?.name,120),postId:str(job.postId,600),postUrl:str(job.postUrl||plan.post?.url,2000),docsUrl:str(author?.source?.docsUrl||post?.sourceUrl,2000),caption:str(post?.text||'',20000),role:str(step?.sourceSlot||job.context?.relationship?.role,120),slot:str(step?.sourceSlot,120),kind:job.kind,parentKey:job.parentStepId?keys.get(job.parentStepId):'',text:job.text,checks:{},status:'draft',receiptUrl:'',createdAt:now,updatedAt:now,history:[{event:'imported',at:now}]};
    item.sourceHash=await hash(sourceShape(item));await checkStoredItem(item);const issues=identityIssues(item,registry,mappings);if(issues.length)throw Error(issues.join(' '));incoming.push(item);seen.add(job.stepId);
   }
  }
 }
 if(incoming.length>2000||current.items.length+incoming.length>4000)throw Error('Kho duyệt tối đa 2.000 lượt. Xuất bản sao lưu trước.');
 const next=structuredClone(current),byKey=new Map(next.items.map(i=>[i.key,i]));let added=0,existing=0,updated=0;
 for(const item of incoming){const old=byKey.get(item.key);if(old){if(old.sourceHash!==item.sourceHash)throw Error('Mã lượt đã tồn tại với dữ liệu khác. Không ghi đè lịch sử.');
   if(isBackup&&item.status==='manually_recorded'){
    if(old.status==='manually_recorded'&&old.receiptUrl!==item.receiptUrl)throw Error('Lượt đã có một link kết quả khác. Đối chiếu trước khi nhập.');
    if(old.status!=='manually_recorded'){old.status='manually_recorded';old.receiptUrl=item.receiptUrl;old.checks={};old.updatedAt=now;old.history=[...(old.history||[]).slice(-99),{event:'imported_manual_receipt',at:now}];updated++;}
   }else if(isBackup&&item.status==='uncertain'&&old.status==='draft'){old.status='uncertain';old.checks={};old.updatedAt=now;old.history=[...(old.history||[]).slice(-99),{event:'imported_uncertain_result',at:now}];updated++;}
   existing++;continue;}if(next.items.length>=2000)throw Error('Kho duyệt tối đa 2.000 lượt.');next.items.push(item);byKey.set(item.key,item);added++;}
 for(const item of next.items)if(item.status==='manually_recorded')item.receiptUrl=receiptAddress(item.receiptUrl,item,next.items.find(i=>i.key===item.parentKey));
 const receipts=new Set();for(const item of next.items)if(item.receiptUrl){if(receipts.has(item.receiptUrl))throw Error('Hai lượt dùng chung một link kết quả.');receipts.add(item.receiptUrl);}
 // Do not silently let a second plan duplicate an identical root comment.
 const duplicates=new Map();for(const i of next.items){if(i.parentKey||!i.postUrl||i.status==='skipped')continue;const k=[i.actorUid,postAddress(i.postUrl)?.key,norm(i.text)].join('|');if(duplicates.has(k)&&duplicates.get(k)!==i.key)throw Error('Hai lượt khác mã có cùng người, bài và nội dung. Kiểm tra trùng trước khi nhập.');duplicates.set(k,i.key);}
 next.revision++;return {queue:next,added,existing,updated};
}
export async function changeReview(current,key,action,data,{registry,mappings={},now=new Date().toISOString()}={}){
 const next=structuredClone(current),item=next.items.find(i=>i.key===key);if(!item)throw Error('Không tìm thấy lượt duyệt.');await checkStoredItem(item);
 if(action==='checks'){if(['manually_recorded','skipped'].includes(item.status))throw Error('Không đổi xác nhận của lượt đã kết thúc.');item.checks=Object.fromEntries(REVIEW_CHECKS.map(k=>[k,data[k]===true]));}
 else if(action==='target'){if(item.status!=='draft')throw Error('Chỉ sửa link khi lượt còn chờ duyệt.');const p=postAddress(data.url);if(!p||p.commentId||p.replyId)throw Error('Dán permalink bài, không dán link comment hoặc link chia sẻ.');if(p.authorUid&&p.authorUid!==item.authorUid)throw Error('UID trong permalink khác chủ bài.');if(item.postUrl&&postAddress(item.postUrl)?.key!==p.key)throw Error('Bài đích đã có không được chuyển sang bài khác.');item.postUrl=p.url;item.checks={};}
 else if(action==='receipt'){const issues=reviewIssues(item.status==='uncertain'?{...item,status:'draft'}:item,next.items,registry,mappings);if(issues.length)throw Error(issues[0]);item.receiptUrl=receiptAddress(data.url,item,next.items.find(i=>i.key===item.parentKey));if(next.items.some(i=>i.key!==key&&i.receiptUrl===item.receiptUrl))throw Error('Link kết quả này đã được ghi cho lượt khác.');item.status='manually_recorded';}
 else if(action==='uncertain'){if(item.status==='manually_recorded'||item.status==='skipped')throw Error('Lượt đã được ghi nhận hoặc bỏ qua.');item.status='uncertain';item.checks={};}
 else if(action==='reopen'){if(item.status!=='uncertain'||data.confirmedNotSent!==true)throw Error('Chỉ mở lại lượt chưa rõ sau khi bạn kiểm tra chắc chắn chưa gửi.');item.status='draft';item.checks={};}
 else if(action==='skip'){if(item.status==='manually_recorded')throw Error('Không bỏ qua lượt đã có kết quả.');item.status='skipped';item.checks={};}
 else throw Error('Thao tác hàng chờ không hợp lệ.');
 item.updatedAt=now;item.history=[...(item.history||[]).slice(-99),{event:action,at:now}];next.revision++;return next;
}
export function exportReview(queue){return {schema:REVIEW_SCHEMA,revision:queue.revision,items:queue.items.map(item=>{const safe={};for(const key of ['key','planId','stepId','actorId','actorUid','actorName','authorId','authorUid','authorName','postId','postUrl','docsUrl','caption','role','slot','kind','parentKey','text','sourceHash','status','receiptUrl','createdAt','updatedAt'])safe[key]=item[key];return safe;})};}
