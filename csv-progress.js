import {decodeV2} from './progress-v2.js';
import {decodeV3,normalizedHeaders} from './progress-v3.js';
export const progressKey=value=>String(value||'').normalize('NFKC').replace(/[\u200b-\u200f\u034f\ufe0e\ufe0f\ufeff]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const key=progressKey;
const isPublished=r=>['đã đăng','cần đối soát','đã đăng, thiếu bước','success','unknown','partial'].includes(key(r.status));
function aliases(post,d){
 const values=[];const add=p=>{if(!p)return;values.push(p.title,p.text);if(p.blocks)values.push(p.blocks.map(b=>(b.runs||[]).map(r=>r.text||'').join('')).join('\n'));};
 add(post);add(post.original);add(post.sourceUpdate?.post);
 for(const j of d.bot?.jobs||[])if(j.postId===post.id)add(j.post);
 for(const l of d.logs||[])if(l.postId===post.id)values.push(l.title);
 return new Set(values.map(key).filter(Boolean));
}
export function combineProgressRows(previous,rows){
 const unique=new Map();for(const r of [...previous,...rows])unique.set(JSON.stringify([r.postId||'',r.title,r.status,r.date,r.url,r.detail]),r);
 if(unique.size>50000)throw Error('Lịch sử CSV lưu vượt 50.000 dòng.');return [...unique.values()];
}
export function readProgressFile(text){
 if(typeof text!=='string'||text.length>10*1024*1024)throw Error('CSV quá lớn (tối đa 10 MB).');
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){if(c==='"'){if(text[i+1]==='"'){cell+='"';i++;}else quoted=false;}else cell+=c;}
  else if(c==='"'){if(cell)throw Error('CSV sai dấu ngoặc kép.');quoted=true;}
  else if(c===','){row.push(cell);cell='';}
  else if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}
  else cell+=c;
  if(rows.length>50000)throw Error('CSV vượt 50.000 dòng.');
 }
 if(quoted)throw Error('CSV chưa đóng dấu ngoặc kép.');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);
 if(rows.length){const table=normalizedHeaders(rows),index=table[0].indexOf('format_version');if(index>=0)return table.slice(1).some(r=>r[index]==='facebook-desk/3')?decodeV3(rows):decodeV2(table);}
 const header=rows.shift()||[],index=name=>header.findIndex(h=>key(h)===key(name));
 const title=index('Bài đăng'),status=index('Trạng thái'),detail=index('Chi tiết'),date=index('Ngày giờ');
 const link=header.findIndex(h=>['link','link bài đăng'].includes(key(h)));
 if(title<0||status<0||date<0)throw Error('Cần CSV lịch sử có cột Ngày giờ, Bài đăng, Trạng thái.');
 const unescape=v=>/^'[=+@\-\t\r]/.test(v||'')?v.slice(1):v||'';
 return {profile:null,posts:[],rows:rows.map((r,i)=>({title:unescape(r[title]),status:r[status]||'',detail:unescape(r[detail]),date:r[date]||'',url:r[link]||'',line:i+2})).filter(r=>r.title.trim())};
}
export function parseProgressCSV(text){return readProgressFile(text).rows;}
function timestamp(value){const m=value.match(/(\d{1,2}):(\d{2}):(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);if(!m)return Date.parse(value)||0;const [,h,n,s,d,month,y]=m;return Date.parse(`${y}-${month.padStart(2,'0')}-${d.padStart(2,'0')}T${h.padStart(2,'0')}:${n}:${s}+07:00`)||0;}
function postLink(raw){try{const u=new URL(raw);return u.protocol==='https:'&&['www.facebook.com','facebook.com'].includes(u.hostname)&&(/\/(posts|videos|reel)\//.test(u.pathname)||u.searchParams.has('story_fbid')||u.searchParams.has('fbid'))?u.href:'';}catch{return '';}}
export function restoreCSVProgress(d,rows,{publishedOnly=false,pause=true}={}){
 if(pause&&d.bot?.jobs?.some(j=>['running','verifying'].includes(j.state)))throw Error('Còn lượt đang đăng/tìm link. Dừng bot và chờ lượt này kết thúc rồi nhập CSV để tránh đổi trạng thái giữa lúc đăng.');
 const groups=new Map();for(const row of rows){const k=row.postId?'id:'+row.postId:key(row.title);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(row);}
 const report={rows:rows.length,reconcileRows:rows.filter(r=>['cần đối soát','unknown'].includes(key(r.status))).length,reconcilePosts:new Set(rows.filter(r=>['cần đối soát','unknown'].includes(key(r.status))).map(r=>r.postId||key(r.title))).size,publishedDetected:[...groups.values()].filter(h=>h.some(isPublished)).length,published:0,remaining:0,alreadyPublished:0,issues:[],matched:0,entries:[],stateCounts:{},autoConfirmed:0};
 for(const row of rows){const state=row.originalStatus||row.status;report.stateCounts[state]=(report.stateCounts[state]||0)+1;}
 const index=new Map((d.posts||[]).map(p=>[p.id,aliases(p,d)])),resolved=new Map();
 for(const [name,history] of groups){
  const published=history.some(isPublished),bound=d.csvProgressBindings?.[key(history[0].title)],exactId=history.find(r=>r.postId)?.postId;
  const posts=(d.posts||[]).filter(p=>exactId?p.id===exactId:bound?p.id===bound:index.get(p.id).has(name));
  const entry={title:history[0].title,published,matched:posts.length===1,postId:posts.length===1?posts[0].id:'',matchedTitle:posts.length===1?posts[0].title:'',candidates:posts.map(p=>p.id)};report.entries.push(entry);
  if(posts.length!==1){report.issues.push({title:history[0].title,published,reason:posts.length?'Nhiều bài cùng khớp; chọn bài bên dưới':'Chưa tìm thấy trong tiêu đề, nội dung, bản gốc hoặc lịch sử; đọc Docs hoặc chọn bài bên dưới'});continue;}
  report.matched++;
  if(!resolved.has(posts[0].id))resolved.set(posts[0].id,[]);resolved.get(posts[0].id).push(...history);
 }
 for(const [postId,history] of resolved){
  const p=d.posts.find(p=>p.id===postId),jobs=(d.bot?.jobs||[]).filter(j=>j.postId===p.id);
  const published=history.filter(isPublished).sort((a,b)=>timestamp(b.date)-timestamp(a.date));
  if(!pause&&jobs.some(j=>['running','verifying'].includes(j.state))){report.issues.push({title:p.title,published:Boolean(published.length),reason:'Bài đang chạy; chưa đổi trạng thái'});continue;}
  if(published.length){
   const r=published[0];p.state='success';p.reminded=true;p.schedule='';p.csvProgress={status:r.status,date:r.date,importedAt:new Date().toISOString(),confirmation:'automatic-from-csv',policy:'user-authorized-published-and-reconciliation'};
   const url=published.map(x=>postLink(x.url)).find(Boolean);if(url)p.postUrl=url;
   for(const j of jobs){j.state='success';j.stage='csv-restored';j.finishedAt=new Date().toISOString();j.manualReconciliation=true;j.csvProgress=true;if(url)j.postUrl=url;}
   report.published++;report.autoConfirmed++;
  }else if(publishedOnly)continue;
  else if(p.state==='success'||jobs.some(j=>j.state==='success')){p.state='success';report.alreadyPublished++;}
  else if(jobs.some(j=>j.submittedAt||['unknown','partial'].includes(j.state))){report.issues.push({title:p.title,reason:'Lượt hiện tại đã gửi; giữ nguyên để tránh đăng trùng'});}
  else{
   for(const j of jobs){j.state='cancelled';j.stage='csv-replaced';}
   p.state='draft';p.csvOriginalStatus=history.find(r=>r.originalStatus)?.originalStatus||history[0].status;p.schedule='';p.reminded=false;report.remaining++;
  }
 }
 if(pause&&d.bot){d.bot.enabled=false;d.bot.plan=null;d.bot.pauseReason='Đã nhập CSV. Kiểm tra kết quả rồi sắp lịch các bài còn lại.';}
 return report;
}
