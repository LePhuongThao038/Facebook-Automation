// Exact source-name replacement only; sheet/Docs content is data, never instructions.
const docId=value=>String(value||'').match(/\/document\/d\/([\w-]+)/)?.[1]||'';
const actorUid=actor=>{try{return new URL(actor?.url||'').searchParams.get('id')||'';}catch{return '';}};
const escaped=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
function matches(text,name){
 const pattern=new RegExp('(?<![\\p{L}\\p{M}\\p{N}_])'+escaped(name).replace(/\s+/g,'\\s+')+'(?![\\p{L}\\p{M}\\p{N}_])','giu');
 return [...text.matchAll(pattern)].filter(m=>{
  // Leave URLs and email addresses intact; changing them can break their destination.
  const before=text.slice(0,m.index).match(/\S*$/)?.[0]||'';
  const after=text.slice(m.index+m[0].length).match(/^\S*/)?.[0]||'';
  return !/(?:https?:\/\/|www\.|@)/iu.test(before+m[0]+after);
 });
}
export function filterCaptionName(post,registry,sources=[],actor){
 const source=post.sourceUrl||sources.find(s=>s.key===post.sourceKey)?.url||'';
 const id=docId(source)||String(post.sourceKey||'').split(':')[0];
 const profiles=(registry?.profiles||[]).filter(p=>p.enabled!==false&&p.uid&&docId(p.source?.docsUrl)===id&&id);
 if(!profiles.length)return {status:'unmapped',count:0,message:'Chưa có ánh xạ tên gốc → clone cho nguồn này.'};
 if(profiles.length!==1)throw Error('Bộ lọc tên: nguồn Docs đang gán cho nhiều clone; kiểm tra danh bạ trước khi đăng.');
 const p=profiles[0],from=String(p.source?.originalName||'').normalize('NFC').trim(),to=String(p.name||p.alias||'').normalize('NFC').trim();
 if(actor&&actorUid(actor)!==p.uid)throw Error('Bộ lọc tên: UID đăng khác clone được gán cho nguồn Docs.');
 if(!from||!to)throw Error('Bộ lọc tên: thiếu tên tài khoản gốc hoặc tên clone trong danh bạ.');
 if(from.toLocaleLowerCase('vi')===to.toLocaleLowerCase('vi'))return {status:'ready',from,to,uid:p.uid,count:0,message:'Tên gốc và tên clone trùng nhau; giữ caption.'};
 const blocks=Array.isArray(post.blocks)&&post.blocks.length?post.blocks:[{runs:[{text:post.text||''}]}];
 let count=0;
 const rewritten=blocks.map(block=>{
  const runs=(block.runs||[]).map(r=>({...r,text:String(r.text||'').normalize('NFC')}));
  const text=runs.map(r=>r.text).join(''),clones=matches(text,to),hits=matches(text,from).filter(hit=>!clones.some(existing=>hit.index>=existing.index&&hit.index+hit[0].length<=existing.index+existing[0].length));
  if(!hits.length)return {...block,runs};
  if(from.split(/\s+/u).length<2)throw Error('Bộ lọc tên: tên gốc chỉ có một từ, dễ thay nhầm. Cần kiểm tra caption thủ công.');
  let offset=0;
  const result=runs.map(run=>{
   const start=offset,end=start+run.text.length;offset=end;let out='',cursor=start;
   for(const hit of hits){const a=hit.index,b=a+hit[0].length;if(b<=start||a>=end)continue;
    out+=text.slice(cursor,Math.max(cursor,a));if(a>=start)out+=to;cursor=Math.min(end,b);
   }
   out+=text.slice(cursor,end);return {...run,text:out};
  });count+=hits.length;return {...block,runs:result};
 });
 if(count){post.blocks=rewritten;post.text=rewritten.map(b=>b.runs.map(r=>r.text||'').join('')).join('\n').trim();if(post.titleAuto)post.title=post.text.replace(/\s+/g,' ').slice(0,120)||'Bài '+(post.number||'');}
 return {status:'ready',from,to,uid:p.uid,count,message:count?'Đã thay '+count+' lần tên “'+from+'” → “'+to+'”.':'Đã kiểm tra tên gốc → clone.'};
}
export function applyCaptionNames(data,registry){
 const busy=new Set((data.bot?.jobs||[]).filter(j=>['running','verifying','unknown','partial'].includes(j.state)).map(j=>j.postId));
 for(const post of data.posts||[]){if(!['draft','error','scheduled','queued','prepared'].includes(post.state)||busy.has(post.id))continue;
  try{const result=filterCaptionName(post,registry,data.sources);const previous=post.captionNameFilter;
   const same=previous?.from===result.from&&previous?.to===result.to;
   post.captionNameFilter={...result,count:result.count+(same?previous.count||0:0),message:!result.count&&same&&previous.count?previous.message:result.message};
  }catch(error){post.captionNameFilter={status:'blocked',count:0,message:error.message};}
 }
 return data;
}
