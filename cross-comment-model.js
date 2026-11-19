import {validateRegistry,accountUID,readiness} from './persona-model.js';
const norm=s=>String(s||'').normalize('NFKC').replace(/[\u200b-\u200f\u034f]/g,'').replace(/\s+/g,' ').trim().toLocaleLowerCase('vi');
export const SHEET_ID='18xjHAiVYeS4w8IjpJFUJuZFcZOeRdhRgZ9B46BXSa3Q';
export const docId=url=>String(url||'').match(/docs\.google\.com\/document\/d\/([\w-]+)/)?.[1]||'';
export function sheetCSV(text){const rows=[];let row=[],value='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){value+='"';i++;}else quote=!quote;}else if(!quote&&(c===','||c==='\n'||c==='\r')){row.push(value);value='';if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;rows.push(row);row=[];}}else value+=c;}if(quote)throw Error('CSV Sheet chưa đóng dấu ngoặc kép.');if(value||row.length){row.push(value);rows.push(row);}return rows;}
export function registryFromSheet(values){
 const header=values.findIndex(r=>norm(r?.[1])==='acc gốc'&&norm(r?.[3])==='clone');if(header<0)throw Error('Sheet không đúng cột Acc gốc / Clone / Link acc clone / Link DOCS.');
 const profiles=[],missing=[];const selected=(r,first,names)=>names.filter((_,i)=>['1','true'].includes(norm(r[first+i])));
 for(let i=header+1;i<values.length;i++){const r=values[i]||[];if(!/^\d+$/.test(String(r[0]||''))||!r[1])continue;const index=String(r[0]).padStart(2,'0'),alias=String(r[3]||'').trim(),uid=accountUID(r[4]),concept={ageGroup:selected(r,7,['Sinh viên','Đi làm','Trung niên']),incomeGroup:selected(r,10,['Xin việc','Dân VP','Thu nhập cao']),socialClass:selected(r,13,['Lao động','Bình thường','VIP']),traitGroup:selected(r,16,['Ngây thơ','Hiểu biết','Cá tính mạnh','Ngốc/Ngã cây'])};
  const profile={id:'sheet-clone-'+index,alias:alias||'Chưa gán clone '+index,name:alias,uid,role:'custom',gender:norm(r[6])==='nam'?'male':norm(r[6])==='nữ'?'female':'unspecified',enabled:!!alias,personality:concept.traitGroup.join(' · ')||'Giữ nguyên lời thoại trong kịch bản; chưa đặt cá tính riêng.',status:[...concept.incomeGroup,...concept.socialClass].join(' · '),tone:'Giữ nguyên lời thoại Docs, không tự sinh nội dung.',self:'mình',other:'bạn',bio:'Nhân vật clone '+(alias||'chưa đặt tên')+'. Concept theo Sheet: '+Object.values(concept).flat().join(', ')+'.',memory:'',rules:'Không tự viết comment; không gán UID acc gốc cho clone. Vai theo cặp dựa trên nhóm tuổi đã thiết kế, không khẳng định quan hệ ngoài đời.',concept,source:{spreadsheetId:SHEET_ID,sheetName:'Nhân cahsc',row:i+1,originalName:String(r[1]).trim(),originalUrl:String(r[2]||''),docsUrl:String(r[5]||''),notes:'Dữ liệu Sheet chỉ đọc; quan hệ theo cohort là thiết kế để gán vai trong kịch bản.'}};
  profiles.push(profile);if(!alias||!uid)missing.push({row:i+1,cell:'E'+(i+1),alias,original:profile.source.originalName,reason:!alias?'Thiếu tên clone và UID':r[4]?'Link chưa có UID số':'Thiếu link/UID clone'});
 }
 const rank=p=>p.concept.ageGroup.length===1?['Sinh viên','Đi làm','Trung niên'].indexOf(p.concept.ageGroup[0]):-1;
 const relations=[];for(const a of profiles)for(const b of profiles){if(a.id===b.id||!a.name||!b.name||rank(a)<0||rank(b)<0)continue;const delta=rank(a)-rank(b),role=delta<0?(a.gender==='female'?'junior_female':'junior_male'):delta>0?(a.gender==='female'?'senior_female':'senior_male'):(a.gender==='female'?'female_friend':'male_friend');relations.push({from:a.id,to:b.id,role,self:delta<0?'em':delta>0?(a.gender==='female'?'chị':'anh'):'mình',other:delta<0?(b.gender==='female'?'chị':'anh'):delta>0?'em':'bạn',notes:'[Theo Sheet] Vai thiết kế từ nhóm tuổi, không suy sư phụ/họ hàng hoặc tuổi cụ thể.'});}
 return {registry:validateRegistry({schema:'desk.personas/1',registryId:'sheet-18xjHAiV-personas-v1',revision:0,profiles,relations}),missing};
}
const roles=new Map([['tác giả','author'],['đàn em nam','junior_male'],['đàn em nữ','junior_female'],['đàn em','junior'],['đàn anh','senior_male'],['đàn chị','senior_female'],['bạn nam','male_friend'],['bạn nữ','female_friend'],['sư phụ','mentor'],['người lớn tuổi','elder_relative'],['người thân bậc trên','elder_relative'],['khách hàng','customer']]);
export function parseCommentLines(lines){
 const parsed=[];for(let i=0;i<(lines||[]).length;i++){
  const raw=lines[i],line=String(typeof raw==='string'?raw:raw?.line||raw?.text||'').replace(/\u000b/g,'\n').trim();if(!line)continue;
  const match=line.match(/^([^:：\n]+)[:：]\s*([\s\S]*)$/);if(!match){if(parsed.length)parsed.at(-1).text+='\n'+line;continue;}
  const header=match[1].trim(),name=header.match(/^(.*?)\s*\((.*)\)\s*$/),tag=(name?.[1]||header).replace(/\s+\d+\s*$/,'').trim();
  const role=roles.get(norm(tag))||'',originalName=(name?.[2]||(!role?header:'')).trim();
  if(!role&&!originalName)continue;
  const text=match[2].replace(/^của tác giả(?:\s*\n|\s*$)/i,'').trim();
  parsed.push({id:'dong-'+(i+1),index:i,role,tag,slot:name?.[1]||header,originalName,text,partial:/(?:xem thêm|see more)\s*$/i.test(text),parentId:typeof raw==='object'?raw.parentId||'':'',parentOriginalName:typeof raw==='object'?raw.parentOriginalName||'':''});
 }
 return parsed;
}
export function commentsFromParagraphs(paragraphs){
 const result={};let number=0,comments=false,structured=false,legacyPart=0;
 for(const p of paragraphs){const text=String(p.text||'').trim();if(/^Phần 2\s*[–—-]\s*Bình luận$/i.test(text)){structured=true;comments=true;number=0;continue;}if(/^Phần\s+\d+/i.test(text)&&!structured){legacyPart++;if(legacyPart>1)break;}
  const heading=text.match(structured?/^Bình luận bài\s+(\d+)\s*$/i:/^Bài\s+(\d+)\s*$/i);if(heading){number=Number(heading[1]);comments=structured;result[number]??=[];continue;}
  if(!number)continue;if(!structured&&/^Comment\s*:/i.test(text)){comments=true;continue;}
  if(comments&&text)result[number].push(text);
 }
 return result;
}
export function selectResearchBlocks(blocks){
 const text=b=>(b.runs||[]).map(r=>r.text||'').join('').trim();
 const first=blocks.findIndex(b=>/^Phần 1\s*[–—-]\s*Bình luận theo nhóm$/i.test(text(b)));if(first<0)return blocks;
 const end=blocks.findIndex((b,i)=>i>first&&/^Phần 2\s*[–—-]/i.test(text(b)));return blocks.slice(first+1,end<0?undefined:end);
}
const hash=text=>{let n=2166136261;for(const c of text){n^=c.codePointAt(0);n=Math.imul(n,16777619);}return (n>>>0).toString(16);};
export function buildCrossScripts(registry,posts,{uid='',snapshots={},bindings={},replyParents={}}={}){
 const r=validateRegistry(registry),scripts=[],issues=[],assignments={...bindings};
 const ready=r.profiles.filter(p=>readiness(p).ready),byName=name=>r.profiles.filter(p=>[p.alias,p.name,p.source?.originalName].some(v=>v&&norm(v)===norm(name)));
 const slotName=entry=>norm(entry.slot)+(entry.role!=='author'&&!/\d$/.test(norm(entry.slot))?' 1':'');
 const ownersFor=post=>{const source=docId(post.sourceUrl)||String(post.sourceKey||'').split(':')[0];return r.profiles.filter(p=>docId(p.source?.docsUrl)===source);};
 const entriesFor=post=>{const source=docId(post.sourceUrl)||String(post.sourceKey||'').split(':')[0];return parseCommentLines(post.comments?.length?post.comments:snapshots[source]?.comments?.[post.number]||[]);};
 const fitsRole=(p,author,role)=>{const relation=r.relations.find(rel=>rel.from===p.id&&rel.to===author.id);return !!relation&&(role==='customer'||(role==='junior'?relation.role.startsWith('junior_'):relation.role===role));};
 // Reserve a UID for each numbered role once, across all posts of this author.
 // An unnumbered role is slot 1, not a new person. Existing assignments never rotate.
 const slots=new Map();for(const post of posts){const owners=ownersFor(post);if(owners.length!==1)continue;const author=owners[0];if(uid&&author.uid!==uid)continue;
  for(const entry of entriesFor(post)){const exact=entry.originalName?byName(entry.originalName):[];if(entry.role==='author'||exact.length===1&&exact[0].id===author.id)continue;const key=author.id+':vai:'+slotName(entry);if(!slots.has(key))slots.set(key,{author,entry,known:[]});if(exact.length===1)slots.get(key).known.push(exact[0]);}
 }
 const ordered=[...slots].sort(([a,x],[b,y])=>(x.entry.role==='customer')-(y.entry.role==='customer')||a.localeCompare(b,'vi',{numeric:true}));
 for(const [key,{author,entry,known}]of ordered){if(assignments[key])continue;const reserved=new Set(Object.entries(assignments).filter(([k])=>k.startsWith(author.id+':vai:')).map(([,id])=>id));const candidates=ready.filter(p=>p.id!==author.id&&!reserved.has(p.id)&&fitsRole(p,author,entry.role));const named=candidates.find(p=>known.some(v=>v.id===p.id));const actor=named||candidates.sort((a,b)=>a.id.localeCompare(b.id))[0];if(actor)assignments[key]=actor.id;}
 for(const post of posts){
  const source=docId(post.sourceUrl)||String(post.sourceKey||'').split(':')[0];const owners=r.profiles.filter(p=>docId(p.source?.docsUrl)===source);if(owners.length!==1){issues.push({postId:post.id,code:'source-owner',reason:'Docs chưa gắn duy nhất một clone trong Sheet.'});continue;}
  const author=owners[0];if(uid&&author.uid!==uid)continue;if(!readiness(author).ready){issues.push({postId:post.id,code:'author-not-ready',reason:'Clone tác giả thiếu UID/hồ sơ.'});continue;}
  const fallback=snapshots[source]?.comments?.[post.number];const entries=parseCommentLines(post.comments?.length?post.comments:fallback||[]),steps=[],used=new Map(),resolved=new Map();
  for(const entry of entries){
   const issue=(code,reason)=>issues.push({postId:post.id,postNumber:post.number,author:author.alias,line:entry.index+1,stepId:entry.id,text:entry.text,parents:code==='unknown-author-parent'?steps.map(s=>({id:s.id,actorId:s.actorId,text:s.text})):undefined,role:entry.tag,originalName:entry.originalName,code,reason});
   if(!entry.text){issue('empty-comment','Chỉ có nhãn giao diện hoặc nội dung trống.');continue;}if(entry.partial){issue('partial-comment','Comment nguồn còn Xem thêm; chưa đủ nguyên văn.');continue;}
   const exact=entry.originalName?byName(entry.originalName):[];let actor;
   if(entry.role==='author')actor=author;else if(exact.length===1){actor=exact[0];if(!readiness(actor).ready){issue('missing-uid','Người gốc đã có clone tương ứng nhưng clone chưa đủ UID/hồ sơ.');continue;}}
   const person=norm(entry.originalName||entry.slot);const bindKey=author.id+':vai:'+slotName(entry);
   const fits=p=>fitsRole(p,author,entry.role);
   if(actor&&actor.id!==author.id&&(!fits(actor)||(assignments[bindKey]&&assignments[bindKey]!==actor.id))){issue('fixed-role-conflict','Người nguồn đã có clone nhưng xung đột vai/UID cố định; không tráo vai.');continue;}
   if(actor&&actor.id!==author.id&&Object.entries(assignments).some(([key,id])=>key!==bindKey&&key.startsWith(author.id+':vai:')&&id===actor.id)){issue('fixed-role-conflict','UID này đã khóa cho vai khác của cùng tác giả; không cho đóng thêm vai.');continue;}
   if(!actor&&exact.length>1){issue('ambiguous-person','Tên trùng nhiều nhân vật.');continue;}
   if(!actor){
    let candidates=ready.filter(p=>p.id!==author.id&&!([...used].some(([key,id])=>id===p.id&&key!==person)));
    candidates=candidates.filter(fits);
    const preferred=used.get(person)||assignments[bindKey];
    if(preferred&&!candidates.some(p=>p.id===preferred)){issue('binding-conflict','Clone đã gán trước đó không còn phù hợp vai hoặc đang đóng người khác trong bài; giữ nguyên ánh xạ, không tự đổi UID.');continue;}
    actor=candidates.find(p=>p.id===preferred);
    if(!actor){issue('unfilled-role','Chưa có clone đủ UID và vai phù hợp; không dùng một clone đóng hai người trong cùng bài.');continue;}assignments[bindKey]=actor.id;
   }
   if([...used].some(([key,id])=>id===actor.id&&key!==person)&&actor.id!==author.id){issue('actor-collision','Hai người nguồn khác nhau đang trỏ cùng clone trong một bài.');continue;}
   if(actor.id!==author.id)assignments[bindKey]=actor.id;
   let parentId=entry.parentId||replyParents[post.id+':'+entry.id]||'';if(entry.parentOriginalName){parentId=[...resolved].reverse().find(([,value])=>norm(value.originalName)===norm(entry.parentOriginalName))?.[0]||'';if(!parentId){issue('missing-parent','Chưa xác định được comment cha.');continue;}}
   if(parentId&&!steps.some(s=>s.id===parentId)){issue('missing-parent','Reply có comment cha chưa được gán hoặc chưa đủ dữ liệu.');continue;}
   if(actor.id===author.id&&steps.length&&!parentId&&entry.role==='author'){issue('unknown-author-parent','Docs không ghi rõ tác giả đang reply cho ai; chọn parent trong khung sửa, không tự gán vào người liền trước.');continue;}
   let text=entry.text;for(const p of r.profiles.filter(p=>p.name&&p.source?.originalName).sort((a,b)=>b.source.originalName.length-a.source.originalName.length))text=text.split(p.source.originalName).join(p.name);
   const step={id:entry.id,actorId:actor.id,parentId,delaySeconds:60,text,sourceRole:entry.tag,sourceSlot:slotName(entry),sourceOriginalName:entry.originalName};steps.push(step);used.set(person,actor.id);resolved.set(step.id,entry);
  }
  if(steps.length)scripts.push({schema:'desk.comment-script/1',id:'cross-'+hash(source+'|'+author.uid+'|'+(post.sourcePostUrl||post.id)),postId:post.id,authorId:author.id,steps});
 }
 return {scripts,issues,bindings:assignments,readyProfiles:ready.map(p=>({id:p.id,alias:p.alias,uid:p.uid}))};
}
