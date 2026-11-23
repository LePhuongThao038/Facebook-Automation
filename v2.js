import {initAudienceUI} from './audience-ui.js';
import {progressFilename} from './autosave-ui.js';
import {saveTeam} from './pilot-ui.js';
import {docsSource,htmlBlocks,splitPosts,parseTime,safeUrl,fbUrl} from './scenario.js';
import {vietnamTime,logMessage} from './display-time.js';
import {resetCandidate,resetCopy,captionIssue,mediaOnlyPost} from './automation-model.js';
import {postingOrder,DEFAULT_INTERVAL_MINUTES} from './posting-plan.js';
import {createScheduleDial,formatGap} from './schedule-dial.js';
import {mediaOrigins} from './media.js';
import {readProgressFile} from './csv-progress.js';
import {countdownText} from './countdown.js';
const $=id=>document.getElementById(id);let state={sources:[],posts:[],logs:[],settings:{}},selected=null,sourceDirty=false,postDirty=false,busy=false;
const labels={draft:'Chờ chuẩn bị',scheduled:'Đã hẹn nhắc',prepared:'Đã điền Facebook',success:'Đã đăng',error:'Lỗi chuẩn bị',ai:'AI đã xử lý',ai_error:'Lỗi AI',due:'Đến lịch',cancelled:'Đã hủy lịch',queued:'Chờ tự đăng',running:'Đang xử lý',verifying:'Đã gửi · đang tìm link',failed:'Chưa đăng / lỗi',partial:'Đã đăng, thiếu bước',unknown:'Cần đối soát'};
const LOG_GROUPS={ai:['ai'],ai_error:['ai_error'],success:['success'],error:['error','failed','partial','unknown'],waiting:['queued','scheduled','due'],running:['running','verifying'],cancelled:['cancelled']};
const logMatches=(l,f)=>f==='all'||(LOG_GROUPS[f]||[f]).includes(l.status);
const visibleLogs=()=>state.logs.filter(l=>logMatches(l,$('history-filter').value));
async function request(type,values={}){const r=await chrome.runtime.sendMessage({type,...values});if(!r?.ok)throw Error(r?.error||'Extension chưa phản hồi. Thử tải lại.');return r.data;}
let toastTimer;function toast(text){const el=$('toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,8000);const dialog=document.querySelector('dialog[open]');if(dialog){let note=dialog.querySelector('.feedback');if(!note){note=document.createElement('p');note.className='feedback connection';dialog.append(note);}note.textContent=text;}}
async function run(fn,button){if(button)button.disabled=true;try{return await fn();}catch(e){toast(e.message||String(e));}finally{if(button)button.disabled=false;if(current()?.state==='success')for(const id of ['save-post','ai-post','prepare','schedule-post','confirm-post'])$(id).disabled=true;}}
function on(id,fn){$(id).addEventListener('click',e=>run(fn,e.currentTarget));}
function make(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
function button(text,fn,cls){const b=make('button',text,cls);b.type='button';b.addEventListener('click',()=>run(fn,b));return b;}
async function load(){state=await request('state');render();}
function sourceValues(){return [...$('sources').querySelectorAll('.source')].map(el=>({id:el.dataset.id,url:el.querySelector('input').value.trim(),note:el.querySelector('textarea').value}));}
async function saveSources(){const sources=sourceValues();await request('sources',{sources});state.sources=sources;sourceDirty=false;toast('Đã lưu nguồn và chú thích.');}
function renderSources(){if(sourceDirty)return;$('sources').replaceChildren();for(const [index,s] of state.sources.entries()){
 const el=make('div',undefined,'source');el.dataset.id=s.id;const head=make('div',undefined,'source-head');head.append(make('b','NGUỒN '+String(index+1).padStart(2,'0')),button('Xóa nguồn',async()=>{const all=sourceValues().filter(x=>x.id!==s.id);await request('sources',{sources:all});sourceDirty=false;await load();}));
 const fields=make('div',undefined,'source-fields');const input=make('input');input.type='url';input.value=s.url;input.id='source-'+s.id;input.placeholder='https://docs.google.com/document/d/…';const label=make('label','Nguồn bài đăng');label.htmlFor=input.id;const note=make('textarea');note.value=s.note;note.id='note-'+s.id;note.placeholder='Ví dụ: Viết caption tự nhiên, tinh nghịch, giữ emoji; không thêm hashtag. Có thể ghi lịch đăng ở đây.';const noteLabel=make('label','Hướng dẫn caption / lịch');noteLabel.htmlFor=note.id;fields.append(label,input,noteLabel,note);const tools=make('div',undefined,'source-tools');tools.append(button('↗ Mở Docs',()=>chrome.tabs.create({url:docsSource(input.value).url})),button('Đọc nguồn này',async()=>{await saveSources();await readSource({id:s.id,url:input.value,note:note.value,replacePending:true});await load();}));el.append(head,fields,tools);el.addEventListener('input',()=>sourceDirty=true);$('sources').append(el);
 }$('source-count').textContent=state.sources.length+' nguồn';}
async function readSource(s){$('source-progress').textContent='Đang đọc Google Docs…';try{const {html,source}=await request('fetch-doc',{url:s.url});const posts=splitPosts(htmlBlocks(html),source);const result=await request('merge',{posts,replacePending:Boolean(s.replacePending)});$('source-progress').textContent=`Đã nhận ${posts.length} bài · Thêm ${result.added} bài mới · Giữ ${result.skipped} bài đã nhập · Nguồn ${result.sourceImages??0} ảnh · Phục hồi ${result.mediaRecovered??0} bài · Cập nhật ảnh ${result.mediaRefreshed??0} bài · ${result.mediaBlocked??0} bài bị chặn/chờ xử lý.`+(result.replaced?.removed?` · Đã thay ${result.replaced.removed} bài chờ đăng của nguồn cũ (hủy ${result.replaced.cancelled} lịch; có sao lưu)`+(result.replaced.kept?`, giữ ${result.replaced.kept} bài đang đăng/cần đối soát.`:'.'):'');}catch(e){$('source-progress').textContent='Không đọc được nguồn: '+e.message;throw e;}}
const cardTimes=new Map();
function cardControls(post){
 const jobs=state.bot?.jobs||[],job=jobs.find(j=>j.postId===post.id&&!['failed','cancelled'].includes(j.state));
 const group=make('div',undefined,'card-scheduling'),input=make('input');
 input.type='datetime-local';input.step='0.001';input.title='Giờ đăng dự kiến (giờ Việt Nam)';input.setAttribute('aria-label',input.title);
 const due=job?.dueAt||post.timing?.iso;
 input.value=cardTimes.get(post.id)??(due&&Number.isFinite(Date.parse(due))?new Date(Date.parse(due)+7*3600000).toISOString().slice(0,23):'');
 input.addEventListener('input',()=>cardTimes.set(post.id,input.value));
 async function schedule(mode){
  const value=input.value;
  if(mode==='manual'&&(!value||!input.validity.valid))throw Error('Chọn ngày giờ đăng (giờ Việt Nam).');
  const origins=mediaOrigins([post]);
  if(origins.length&&!await chrome.permissions.request({origins}))throw Error('Cần quyền đọc ảnh/video của bài.');
  const dueAt=await request('bot-card-schedule',{id:post.id,mode,dueAt:value?value+'+07:00':''});
  cardTimes.delete(post.id);await load();toast((mode==='dry'?'Đã xếp CHẠY THỬ (không đăng) lúc ':'Đã xếp lịch đăng lúc ')+vietnamTime(dueAt));
 }
 const now=button('Đăng ngay',()=>schedule('now')),save=button('Lưu giờ',()=>schedule('manual'));
 // 3.8.7: chạy thử đủ các bước tới trước nút Đăng, không đăng; tải về cấu trúc giao diện để kiểm thử.
 const dry=button('Chạy thử',()=>schedule('dry'));dry.title='Chạy đủ các bước tới trước nút Đăng rồi bỏ bản nháp. Không đăng gì lên Facebook.';
 const shot=job?.uiSnapshot?button('Tải cấu trúc giao diện',()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(job.uiSnapshot,null,1)],{type:'application/json'}));a.download='ui-snapshot-bai-'+(post.number||'')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);}):null;
 save.title='Lưu lịch đăng';save.setAttribute('aria-label',save.title);
 now.disabled=dry.disabled=input.disabled=save.disabled=post.state==='success'||Boolean(job&&job.state!=='queued');
 group.append(now,dry,input,save);if(shot)group.append(shot);
 if(job?.state==='queued'){const clock=make('span',undefined,'queue-countdown');clock.dataset.dueAt=job.dueAt;clock.dataset.gap=String(job.minGapMs||0);clock.setAttribute('role','timer');group.append(clock);}
 return group;
}
function tickCountdowns(){for(const el of document.querySelectorAll('.publish-countdown')){const seconds=Math.max(0,Math.ceil((Number(el.dataset.until)-Date.now())/1000));el.textContent=seconds?'Chờ lượt bấm Đăng: '+seconds+' giây':'Đang kiểm tra nút Đăng…';}const last=Math.max(0,...(state.bot?.jobs||[]).map(j=>Date.parse(j.submittedAt)||0));for(const el of document.querySelectorAll('.queue-countdown')){const time=Math.max(Date.parse(el.dataset.dueAt),last+Number(el.dataset.gap));const text=countdownText(Number.isFinite(time)?new Date(time).toISOString():'',Date.now(),state.bot?.enabled===true);if(el.textContent!==text)el.textContent=text;}}
function countdownLoop(){tickCountdowns();setTimeout(countdownLoop,1000-Date.now()%1000);}countdownLoop();
let csvRenderSignature='';
function renderCSVProgress(){
 const r=state.lastCSVImport;if(!r)return;
 const entries=(r.entries||[]).filter(e=>e.published),unmatched=entries.filter(e=>!e.matched).length;
 $('import-report-result').textContent=`Đọc được ${r.rows??'?'} dòng CSV · ${r.reconcileRows??'?'} dòng Cần đối soát (${r.reconcilePosts??'?'} bài) · ${r.publishedDetected??r.published} bài đã đăng trong CSV.\nĐã ghép và đánh dấu ${r.published} bài đã đăng · ${unmatched} bài đã đăng chưa ghép được · ${r.remaining} bài chờ xếp lịch. Tự xác nhận ${r.autoConfirmed??r.published} bài đã đăng.`+(unmatched?'\nHãy chọn bài tương ứng cho các mục chưa ghép trước khi tiếp tục đăng.':'');
 if(r.stateCounts)$('import-report-result').textContent+='\nTrạng thái ghi trong file (số dòng): '+Object.entries(r.stateCounts).map(([s,n])=>(labels[s]||s)+': '+n).join(' · ');
 if(r.captionRepairs)$('import-report-result').textContent+='\nĐã tự phục hồi '+r.captionRepairs+' caption từ bản dự phòng.';
 let container=$('csv-progress-matches');if(!container){container=make('div');container.id='csv-progress-matches';$('import-report-result').after(container);}
 const signature=JSON.stringify([r,state.posts.map(p=>[p.id,p.title,p.state])]);if(signature===csvRenderSignature)return;csvRenderSignature=signature;container.replaceChildren();
 for(const entry of entries){
  const row=make('div',undefined,'panel');row.append(make('strong',entry.title),make('p',entry.matched?'Đã đăng — khớp với: '+entry.matchedTitle:'CSV xác nhận đã đăng — chưa xác định được bài tương ứng.'));
  if(!entry.matched){
   const select=make('select');select.setAttribute('aria-label','Chọn bài tương ứng với '+entry.title);const placeholder=make('option','Chọn bài trong nguồn…');placeholder.value='';select.append(placeholder);
   const candidates=state.posts.filter(p=>!entry.candidates.length||entry.candidates.includes(p.id));
   for(const p of candidates){const option=make('option',(p.number?'Bài '+p.number+' · ':'')+p.title+' · '+String(p.text||'').slice(0,100));option.value=p.id;select.append(option);}
   row.append(select,button('Xác nhận bài này đã đăng',async()=>{if(!select.value)throw Error('Chọn bài tương ứng trước.');await request('bind-progress-csv',{title:entry.title,postId:select.value});await load();toast('Đã đối chiếu và đánh dấu bài đã đăng. Không đăng lại.');}));
  }
  container.append(row);
 }
 if(!state.posts.length)container.append(make('p','CSV đã được lưu. Đọc nguồn Docs để tự động đối chiếu các bài.'));
}
function render(){renderSources();renderCSVProgress();$('ai-status').textContent=state.settings.mode==='team'?'GPT của team':state.settings.mode==='web'?'✦ Gemini web · Auto':state.keyConfigured?'✦ AI API · '+(state.settings.model||'chưa chọn model'):'AI chưa cấu hình';
 if(!frequencyReady){dial.setMinutes(state.bot?.intervalMinutes||DEFAULT_INTERVAL_MINUTES);frequencyReady=true;}dial.setCount(schedulableIds().length);$('bot-pause').hidden=!state.bot?.enabled;
 const paused=(state.bot?.jobs||[]).filter(j=>j.kind!=='story'&&j.state==='queued'&&(!state.bot.enabled||(state.bot.cardsOnly&&!j.cardScheduled)));
 $('resume-all').hidden=!paused.length;$('pause-reason').hidden=!paused.length;
 if(paused.length){
  $('resume-all').textContent='Tiếp tục tất cả ('+paused.length+')';
  const problem=state.logs.find(l=>['unknown','partial','failed'].includes(l.status));
  $('pause-reason').textContent=state.bot.enabled?'Một số bài chưa được bật tự đăng.':state.bot.pauseReason||('Hàng chờ đang dừng.'+(problem?' Sự cố gần nhất: '+problem.title+' · '+problem.message:''));
 }
 const dates=new Set(state.logs.map(l=>new Date(l.at).toLocaleDateString('en-CA',{timeZone:'Asia/Ho_Chi_Minh'})));$('days').textContent=dates.size;$('success').textContent=new Set(state.logs.filter(l=>l.kind!=='story'&&l.status==='success').map(l=>l.postId)).size;$('failed').textContent=new Set(state.logs.filter(l=>l.kind!=='story'&&['error','failed','partial','unknown'].includes(l.status)).map(l=>l.postId)).size;$('post-count').textContent=state.posts.length;
 const query=$('search').value.toLocaleLowerCase('vi'),filter=$('state-filter').value;const byPost=new Map();
 for(const job of state.bot?.jobs||[]){
  if(byPost.get(job.postId)?.state!=='success')byPost.set(job.postId,job);
 }
 const posts=state.posts.map(post=>{
  const job=byPost.get(post.id);
  if(!job||post.state==='success')return post;
  if(['running','verifying','unknown','partial','success'].includes(job.state))
   return {...post,state:job.state,postUrl:job.postUrl||post.postUrl};
  return post;
 }).filter(p=>(filter==='all'||p.state===filter)&&(p.title+' '+p.text).toLocaleLowerCase('vi').includes(query));$('posts').replaceChildren();
 if(!posts.length){const empty=make('div',undefined,'empty');empty.append(make('strong',state.posts.length?'Không tìm thấy bài phù hợp':'Kịch bản của bạn bắt đầu ở đây'),make('span','Dán nguồn Google Docs phía trên, thêm chú thích rồi bấm Đọc bài.'));$('posts').append(empty);}
 for(const p of posts){const job=byPost.get(p.id);const card=make('article',undefined,'post-card'),top=make('div',undefined,'row');let caption=labels[p.state]||p.state;
 if(!job&&['draft','prepared'].includes(p.state)&&scheduleIssue(p))caption='Chưa xếp lịch: '+scheduleIssue(p);
 if(job?.state==='queued'){
  const last=Math.max(0,...state.bot.jobs.map(x=>Date.parse(x.submittedAt)||0));
  const due=Math.max(Date.parse(job.dueAt),last+(job.minGapMs??60000));
  const remaining=Math.ceil((due-Date.now())/60000);
  caption=!state.bot.enabled||(state.bot.cardsOnly&&!job.cardScheduled)?'Tạm dừng · đã xếp lịch':remaining>0?'Sẽ đăng trong '+remaining+' phút nữa':'Đã đến giờ · chờ đến lượt';
 }
 if(job?.state==='queued'&&job.lastFailure){
  caption='Thử lại '+(job.attempt-1)+'/3 · '+caption;
  card.title=job.lastFailure;
 }
 if(p.state==='verifying')caption=job?.clickDispatchedAt?'Đã gửi thao tác bấm Đăng · đang xác minh bài':'Đã cấp lượt đăng · đang kiểm tra trước khi bấm';
 if(p.state==='unknown')caption='Chờ đối soát'+(job?.lookupAt&&job.nextLookup>Date.now()?' · thử lại lúc '+vietnamTime(job.nextLookup):' · đang chờ lượt tìm link');
 if(['error','failed','partial'].includes(p.state)){
  card.classList.add('error-card');caption='Đăng lỗi: '+(job?.error||'Chưa hoàn tất bài');
 }
 const badge=make('span',caption,'badge '+p.state);
 if(p.state==='success'&&p.postUrl){const link=make('a','Mở bài Facebook ↗');link.href=p.postUrl;link.rel='noopener noreferrer';link.target='_blank';badge.append(' · ',link);}
 if(job?.state==='running'&&job.stage==='waiting-submit'&&job.waitUntil){const clock=make('span','','publish-countdown chip');clock.dataset.until=String(job.waitUntil);clock.setAttribute('role','timer');top.append(clock);}
 top.append(badge,make('span',p.number?'Bài '+p.number:'Bản cũ','chip'));card.append(top,make('p',p.text||'Bài chỉ có media'),make('div',`${p.media?.filter(m=>m.type==='image').length||0} ảnh · ${p.media?.filter(m=>m.type==='video').length||0} video · ${p.comments?.length||0} dòng comment`+(p.sourceKind&&p.sourceKind!=='post'?' · Nguồn: '+p.sourceKind:''),'metadata'));if(p.csvOriginalStatus&&p.state!=='success')card.append(make('small','Trạng thái trong CSV: '+(labels[p.csvOriginalStatus]||p.csvOriginalStatus)));if(p.csvLastError)card.append(make('small',p.csvLastError,'card-error'));if(mediaOnlyPost(p))card.append(make('small','Bài chỉ có ảnh hoặc video'));else if(p.captionPartial)card.append(make('small','Có caption · nguồn đánh dấu còn rút gọn. Mở bài để xem/sửa.','card-error'));else if(p.captionState==='unreadable')card.append(make('small','Chưa lấy được caption nguồn · chưa cho đăng','card-error'));if(p.captionNameFilter?.status==='blocked'||p.captionNameFilter?.status==='unmapped')card.append(make('small',p.captionNameFilter.message,p.captionNameFilter.status==='blocked'?'card-error':'metadata'));else if(p.captionNameFilter?.count)card.append(make('small',p.captionNameFilter.message+' ('+p.captionNameFilter.count+' lần)','metadata'));const actions=make('div',undefined,'row');
 if(p.state==='success'){
  card.classList.add('published');
  if(p.mediaUncertain)card.append(make('small','Chưa đối chiếu được ảnh nguồn.'));
  if(p.sourceUpdate){
   actions.append(button('Cập nhật',async()=>{await request('apply-source-update',{id:p.id});await load();toast('Đã cập nhật bài cũ.');}));
   if(p.sourceUpdate.changes.some(k=>['text','media','location','time','withPeople','feeling'].includes(k)))actions.append(button('Đã sửa trên Facebook',async()=>{if(confirm('Bạn đã sửa đúng bài Facebook theo nguồn mới?')){await request('apply-source-update',{id:p.id,manual:true});await load();}}));
  }
 }else if(['verifying','unknown','partial'].includes(p.state)){
  const job=byPost.get(p.id);
  card.append(make('small',job?.error||'Facebook đã nhận thao tác Đăng. Bot đang đối chiếu bài trên trang cá nhân.'));
  if(job?.postUrl){const link=make('a','Mở bài đã đăng ↗');link.href=job.postUrl;link.target='_blank';link.rel='noopener noreferrer';actions.append(link);}
  else if(job && ['partial','unknown'].includes(job.state))actions.append(button('Tự tìm lại link',async()=>{await request('bot-find-link',{jobId:job.id});await load();}));
 }else {const latest=[...(state.bot?.jobs||[])].reverse().find(j=>j.postId===p.id);
 if(latest?.state==='queued')actions.append(button('Hủy lịch',async()=>{await request('bot-cancel',{jobId:latest.id});await load();}));
 actions.append(button(latest?.state==='queued'?'Dừng & sửa caption':'Sửa caption',async()=>{if(latest?.state==='queued'){await request('bot-pause');await load();}await openPost(p.id);}),cardControls(p),button('Xóa',async()=>{if(confirm('Xóa bài khỏi extension? Tài liệu Docs không thay đổi.')){await request('delete-post',{id:p.id});await load();}}));}card.append(actions);$('posts').append(card);}tickCountdowns();
 $('history').replaceChildren();const shownLogs=visibleLogs();if(!shownLogs.length){const tr=make('tr'),td=make('td',state.logs.length?'Không có dòng lịch sử nào khớp bộ lọc này.':'Chưa có lịch sử. Hoạt động sẽ được ghi khi xử lý hoặc chuẩn bị bài.');td.colSpan=5;tr.append(td);$('history').append(tr);}
 for(const l of shownLogs){const tr=make('tr'),status=make('td'),link=make('td');status.append(make('span',labels[l.status]||l.status,'badge '+l.status));if(safeUrl(l.url)){const a=make('a','Mở bài ↗');a.href=l.url;a.target='_blank';a.rel='noopener noreferrer';link.append(a);}else link.textContent='—';tr.append(make('td',vietnamTime(l.at)),make('td',l.title),status,make('td',logMessage(l)),link);$('history').append(tr);}
}
for(const name of ['scenario','friends','comments','stories'])on('tab-'+name,()=>{for(const n of ['scenario','friends','comments','stories']){$(n).hidden=n!==name;$('tab-'+n).classList.toggle('active',n===name);$('tab-'+n).setAttribute('aria-selected',String(n===name));}});
on('add-source',async()=>{const sources=sourceValues();sources.push({id:crypto.randomUUID(),url:'',note:''});await request('sources',{sources});sourceDirty=false;await load();});on('save-sources',saveSources);
on('read-all',async()=>{await saveSources();let failed=0;for(const s of state.sources){try{await readSource(s);}catch{failed++;}}await load();toast(failed?`${failed} nguồn chưa đọc được. Mở nguồn tương ứng để kiểm tra quyền xem.`:'Đã đọc xong các nguồn.');});
$('search').addEventListener('input',render);$('state-filter').addEventListener('change',render);$('history-filter').addEventListener('change',render);
function download(data,name,type){const url=URL.createObjectURL(new Blob([data],{type}));const a=make('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
on('export',async()=>download(JSON.stringify(await request('export'),null,2),'facebook-desk-v2.json','application/json'));
on('export-report',async()=>{download(await request('export-progress-v3',{includeKey:$('csv-include-key').checked}),await progressFilename(),'text/csv;charset=utf-8');toast('Đã xuất CSV v3: mỗi bài một dòng, caption nguồn + dự phòng, mã bài và trạng thái tự khôi phục.');});
on('import-report',()=>$('import-report-file').click());
$('import-report-file').addEventListener('change',()=>run(async()=>{
 const input=$('import-report-file'),file=input.files?.[0];if(!file)return;
 try{
  if(file.size>10*1024*1024)throw Error('CSV quá lớn (tối đa 10 MB).');
  const csv=await file.text(),parsed=readProgressFile(csv);
  let configuration=null;if(parsed.profile){configuration=await chooseCSVProfile(parsed.profile);if(configuration===null)return;}
  const result=await request('import-progress-csv',{csv});await load();
  if(configuration?.apply){try{await request('apply-import-profile',configuration);await load();}catch(e){toast('Tiến độ đã nhập, cấu hình chưa áp dụng: '+e.message);return;}}
  const message=`Đã đọc ${result.rows} dòng: ${result.reconcileRows} dòng Cần đối soát (${result.reconcilePosts} bài). Đã ghép ${result.published} bài đã đăng. Xem đối chiếu bên dưới; bot đã dừng.`;
  toast(message);
 }finally{input.value='';}
}));
function chooseCSVProfile(profile){return new Promise(resolve=>{
 const dialog=$('csv-profile-dialog'),form=$('csv-profile-form');
 $('csv-profile-summary').textContent='API: '+(profile.api_protocol||'gemini')+' · '+(profile.api_base_url||'Google Gemini')+' · UID: '+(profile.actor_uid||profile.actor_url||'không có')+' · Model: '+(profile.api_model||'chưa chọn')+' · API key: '+(profile.api_key?'••••'+profile.api_key.slice(-4):'không có');
 $('csv-profile-use').checked=true;$('csv-new-key').value='';$('csv-new-uid').value='';
 let answer=null;
 const submit=e=>{e.preventDefault();const reuse=$('csv-profile-use').checked;answer={apply:true,apiKey:reuse?profile.api_key:$('csv-new-key').value.trim(),uid:reuse?(profile.actor_uid||profile.actor_url):$('csv-new-uid').value.trim(),mode:profile.api_mode,model:profile.api_model,apiProtocol:profile.api_protocol||'gemini',apiBaseUrl:profile.api_base_url||'',apiJsonMode:profile.api_json_mode==='1'};dialog.close();};
 const close=()=>{form.removeEventListener('submit',submit);$('csv-new-key').value='';resolve(answer);};
 form.addEventListener('submit',submit);dialog.addEventListener('close',close,{once:true});dialog.showModal();
});}
function apiSettings(){return {apiProtocol:$('api-protocol').value,apiBaseUrl:$('api-base-url').value.trim(),apiJsonMode:$('api-json-mode').checked};}
const apiDefaults={gemini:'https://generativelanguage.googleapis.com/v1beta',compatible:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com/v1'};
$('api-protocol').addEventListener('change',()=>{$('api-base-url').value=apiDefaults[$('api-protocol').value];$('model').value='';$('model-options').replaceChildren();$('api-key').value='';$('connection-result').textContent='Nhập key và model của nhà cung cấp này.';});
async function allowAPI(){const u=new URL($('api-base-url').value);if(u.protocol!=='https:')throw Error('API cần địa chỉ HTTPS.');if(!await chrome.permissions.request({origins:[u.origin+'/*']}))throw Error('Bạn chưa cho phép kết nối địa chỉ API này.');}
function modes(){const mode=document.querySelector('input[name="mode"]:checked').value;$('manual-fields').hidden=mode!=='manual';$('web-fields').hidden=mode!=='web';$('team-fields').hidden=mode!=='team';}
document.querySelectorAll('input[name="mode"]').forEach(e=>e.addEventListener('change',modes));
on('settings-open',async()=>{await load();document.querySelector(`input[name="mode"][value="${state.settings.mode||'manual'}"]`).checked=true;$('api-protocol').value=state.settings.apiProtocol||'gemini';$('api-base-url').value=state.settings.apiBaseUrl||apiDefaults[$('api-protocol').value];$('api-json-mode').checked=Boolean(state.settings.apiJsonMode);$('model').value=state.settings.model||'';$('api-key').value='';$('api-key').type='password';$('show-key').textContent='Hiện';$('target').value=state.settings.target||'https://www.facebook.com/';$('remember-key').checked=state.rememberKey;$('key-state').textContent=state.keyConfigured?'Đã có key. Để trống để giữ key hiện tại.':'Chưa có API key.';modes();$('settings-dialog').showModal();});
on('settings-close',()=>$('settings-dialog').close());$('settings-dialog').addEventListener('close',()=>{$('api-key').value='';});
on('show-key',()=>{const show=$('api-key').type==='password';$('api-key').type=show?'text':'password';$('show-key').textContent=show?'Ẩn':'Hiện';});
on('remove-key',async()=>{await request('remove-key');$('api-key').value='';$('key-state').textContent='Đã xóa API key.';await load();});
async function connection(fn){$('connection-result').textContent='Đang kết nối…';try{const result=await fn();$('connection-result').textContent=result;return result;}catch(e){$('connection-result').textContent=e.message;throw e;}}
on('load-models',()=>connection(async()=>{await allowAPI();const models=await request('models',{settings:apiSettings(),key:$('api-key').value.trim()});$('model-options').replaceChildren();models.forEach(m=>{const o=make('option');o.value=m.id;o.label=m.name;$('model-options').append(o);});if(!$('model').value&&models.length)$('model').value=(models.find(m=>m.id.includes('flash'))||models[0]).id;return `Đã lấy ${models.length} model hỗ trợ tạo nội dung.`;}));
on('test-api',()=>connection(async()=>{await allowAPI();return request('test-api',{settings:apiSettings(),key:$('api-key').value.trim(),model:$('model').value.trim()});}));
on('connect-web',()=>connection(()=>request('connect-web')));
$('settings-form').addEventListener('submit',e=>{e.preventDefault();run(async()=>{if(document.querySelector('input[name="mode"]:checked').value==='team')await saveTeam();
 if(document.querySelector('input[name="mode"]:checked').value==='manual')await allowAPI();
 await request('settings',{settings:{...apiSettings(),mode:document.querySelector('input[name="mode"]:checked').value,model:$('model').value.trim(),target:$('target').value.trim()},key:$('api-key').value.trim(),remember:$('remember-key').checked});$('settings-dialog').close();await load();toast('Đã lưu cài đặt AI.');},e.submitter);});
function current(){return state.posts.find(p=>p.id===selected);}
async function openPost(id){if(postDirty&&!confirm('Bỏ chỉnh sửa chưa lưu?'))return;selected=id;postDirty=false;paintPost();await tabs();$('post-dialog').showModal();}
function paintPost(){const p=current();if(!p)return;$('caption-instructions').value=p.captionInstructions||'';$('post-heading').textContent=p.title;$('post-origin').textContent=p.number?'BÀI '+p.number+' · KỊCH BẢN GOOGLE DOCS':'BẢN NHÁP';for(const k of ['title','location','feeling','withPeople','time','text'])$('p-'+k).value=p[k]||'';$('post-link').value=p.postUrl||'';
 $('save-resume-post').disabled=p.state==='success'||busy||!state.bot?.jobs.some(j=>j.postId===p.id&&j.state==='queued');
 const time=parseTime(p.time);$('time-note').textContent=time.kind==='future'?'Thời gian tương lai: Bot chờ đến giờ để đăng khi Chrome đang mở.':time.kind==='past'?'Thời gian quá khứ: cần đổi ngày trên Facebook nếu tài khoản hỗ trợ. Bot thử đổi ngày sau đăng và kiểm chứng kết quả.':time.kind==='invalid'?'Ngày giờ chưa rõ. Dùng dd/mm/yyyy HH:mm hoặc ISO có múi giờ.':'Chưa đặt giờ: Bot quét lịch chung/chú thích, nếu không có thì dùng tần suất bạn chọn.';
 $('rich-preview').replaceChildren();for(const b of p.blocks||[]){const para=make('p');for(const r of b.runs){const span=make('span',r.text);if(r.bold)span.style.fontWeight='700';if(r.italic)span.style.fontStyle='italic';if(r.underline)span.style.textDecoration='underline';para.append(span);}$('rich-preview').append(para);}
 $('media-preview').replaceChildren();for(const m of p.media||[]){if(m.type==='image'){const img=make('img');img.src=m.url;img.loading='lazy';img.referrerPolicy='no-referrer';img.alt=m.caption||'Ảnh trong nguồn';img.addEventListener('error',()=>{img.alt='Ảnh hết hạn hoặc cần đăng nhập Docs';});$('media-preview').append(img);}else{const a=make('a','▶ Video nguồn');a.href=safeUrl(m.url);a.target='_blank';a.rel='noopener noreferrer';$('media-preview').append(a);}}
 $('media-warning').textContent=(p.media?.length||0)+' tệp nguồn · Video phải là link tải trực tiếp, không phải trang xem. Link ảnh Docs có thể hết hạn.';
 $('p-comments').textContent=(p.comments||[]).join('\n')||'Chưa có comment.';$('p-notes').textContent=[...(p.notes||[]),...(p.aiWarnings||[])].join('\n');for(const id of ['save-post','ai-post','prepare','schedule-post','confirm-post'])$(id).disabled=p.state==='success'||busy;
}
$('caption-instructions').addEventListener('input',()=>postDirty=true);
for(const k of ['title','location','feeling','withPeople','time','text'])$('p-'+k).addEventListener('input',()=>postDirty=true);
function closePost(){if(postDirty&&!confirm('Bỏ chỉnh sửa chưa lưu?'))return;$('post-dialog').close();postDirty=false;}
on('post-close',closePost);$('post-dialog').addEventListener('cancel',e=>{e.preventDefault();closePost();});
async function savePost(){await request('post-update',{id:selected,values:{...Object.fromEntries(['title','location','feeling','withPeople','time','text'].map(k=>[k,$('p-'+k).value])),captionInstructions:$('caption-instructions').value}});postDirty=false;await load();paintPost();}
on('save-post',async()=>{await savePost();toast('Đã lưu chỉnh sửa.');});
on('save-resume-post',async()=>{await savePost();await request('bot-start');$('post-dialog').close();await load();toast('Đã lưu caption mới và tiếp tục hàng chờ.');});
on('ai-post',async()=>{await savePost();busy=true;toast('AI đang xử lý bài. Giữ cửa sổ này mở.');try{await request('ai',{id:selected});await load();paintPost();toast('AI đã xử lý xong. Kiểm tra lại bản xem trước.');}finally{busy=false;paintPost();}});
on('open-target',()=>chrome.tabs.create({url:fbUrl(state.settings.target||'https://www.facebook.com/')}));
async function tabs(){const list=await chrome.tabs.query({url:'https://www.facebook.com/*'});$('facebook-tab').replaceChildren();const first=make('option',list.length?'Chọn đúng tab và tài khoản…':'Chưa mở Facebook');first.value='';$('facebook-tab').append(first);for(const t of list){const o=make('option',t.title||t.url);o.value=t.id;$('facebook-tab').append(o);}}
on('refresh-tabs',tabs);
on('prepare',async()=>{const tabId=Number($('facebook-tab').value);if(!tabId)throw Error('Chọn tab Facebook trước.');if(postDirty)throw Error('Lưu chỉnh sửa trước khi chuẩn bị bài.');const origins=mediaOrigins([current()]);if(origins.length&&!await chrome.permissions.request({origins}))throw Error('Chưa được cấp quyền đọc media nguồn.');toast('Đang tải media và chuẩn bị bài…');const result=await request('prepare',{id:selected,tabId});await load();paintPost();toast(result);});
on('copy-post',async()=>{await navigator.clipboard.writeText($('p-text').value);toast('Đã sao chép phần chữ.');});
on('schedule-post',async()=>{if(postDirty)await savePost();await request('schedule',{id:selected});await load();paintPost();toast('Đã hẹn nhắc đăng; Chrome cần đang chạy.');});
on('cancel-schedule',async()=>{await request('cancel-schedule',{id:selected});await load();paintPost();toast('Đã hủy lịch nếu bài đang hẹn nhắc.');});
on('confirm-post',async()=>{if(postDirty)throw Error('Lưu chỉnh sửa trước khi xác nhận đăng.');await request('confirm-post',{id:selected,url:$('post-link').value.trim()});await load();paintPost();toast('Đã ghi nhận xác nhận của bạn cùng link bài đăng.');});
function scheduleIssue(p){
 if(p.captionNameFilter?.status==='blocked')return p.captionNameFilter.message;
 if(p.missingVideo)return 'Nguồn thiếu tệp video/Reels';
 if(p.mediaReadError||(p.sourceImageCount||0)>(p.media||[]).filter(m=>m.type==='image').length)return 'Ảnh đọc từ Docs chưa đầy đủ';
 const issue=captionIssue(p);if(issue)return issue;
 if(!p.text?.trim()&&!p.media?.length)return 'Thiếu nội dung hoặc ảnh/video';
 if(String(p.withPeople||'').split(/[;\n]+/).filter(x=>x.trim()).length>20)return 'Vượt 20 người được gắn thẻ';
 return '';
}
function scheduleProgress(message){$('schedule-progress').textContent=message;}
async function enqueue(ids,minutes,resetUnsent=false){
 if(sourceDirty)throw Error('Lưu nguồn và chú thích trước khi xếp lịch.');
 const candidates=state.posts.filter(p=>ids.includes(p.id)),posts=candidates.map(p=>resetUnsent?resetCopy(p):p).filter(p=>!scheduleIssue(p));
 const skipped=candidates.length-posts.length;
 if(!posts.length)throw Error('Không có bài đủ điều kiện. Xem lý do trên từng thẻ bài.');
 const origins=mediaOrigins(posts);
 if(origins.length&&!await chrome.permissions.request({origins}))throw Error('Chưa cấp quyền tải media nguồn.');
 busy=true;
 try{
  const needAI=new Set(),aiErrors=[];
  for(const p of posts){
   const source=state.sources.find(s=>{try{return docsSource(s.url).key===p.sourceKey;}catch{return false;}});
   if(!mediaOnlyPost(p)&&p.state!=='queued'&&(source?.note?.trim()||p.notes?.length)&&(!p.aiProcessedAt||p.aiSourceNote!==(source?.note||'')))needAI.add(p.id);
  }
  for(const p of posts){
   if(!needAI.has(p.id))continue;
   scheduleProgress('Đang xử lý hướng dẫn: '+p.title);
   try{await request('ai',{id:p.id});needAI.delete(p.id);await new Promise(r=>setTimeout(r,1500));}
   catch(e){const msg=e.message||String(e);aiErrors.push(msg);if(/trong ngày|API key|Model không tồn tại|Chưa cấu hình/i.test(msg))break;}
  }
  ids=postingOrder(posts.filter(p=>!needAI.has(p.id))).map(p=>p.id);
  if(!ids.length)throw Error('Chưa xếp lịch được bài nào vì lỗi AI: '+(aiErrors[0]||'không rõ')+' Muốn đăng nguyên văn không cần AI: xóa ô Chú thích thêm của nguồn rồi bấm lại.');
  scheduleProgress('Đang xác minh nick và đọc lịch cho '+ids.length+' bài…');
  const plan=await request('bot-plan',{ids});
  const {startAt}=dial.value();const jobs=await request('bot-enqueue',{ids,planId:plan.id,intervalMinutes:minutes,startAt:startAt?new Date(startAt).toISOString():'',jitterSeconds:dial.value().jitterSeconds,resetUnsent});
  for(const job of jobs)cardTimes.delete(job.postId);
  await load();
  const msg='Đã xếp lịch '+jobs.length+' bài cho '+plan.actor.name+' · Bắt đầu '+(dial.value().startAt?new Date(dial.value().startAt).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'ngay')+', mỗi bài cách '+formatGap(minutes)+'.'+(skipped?' Bỏ qua '+skipped+' bài chưa đủ điều kiện.':'')+(needAI.size?' '+needAI.size+' bài chưa xếp vì lỗi AI ('+(aiErrors[0]||'')+'). Bấm Sắp lịch tự động lần nữa để xếp nốt.':'');
  scheduleProgress(msg);toast(msg);
 }finally{busy=false;}
}
let frequencyReady=false;
// 3.8.7: đồng hồ xoay thay cho danh sách 3/5/10 phút. Quay để chọn giờ bắt đầu và khoảng cách giữa các bài.
const dial=createScheduleDial($('schedule-dial'),{minutes:DEFAULT_INTERVAL_MINUTES});
function schedulableIds(){return (state?.posts||[]).filter(p=>{
  const job=state.bot?.jobs.find(j=>j.postId===p.id&&!['failed','cancelled'].includes(j.state));
  return job?job.state==='queued'&&!['manual','explicit'].includes(job.scheduleMode):['draft','prepared'].includes(p.state);
 }).map(p=>p.id);}
on('reset-unsent',async()=>{
 await load();
 const jobs=state.bot?.jobs||[];
 const ids=state.posts.filter(p=>resetCandidate(p,jobs)&&(['error','failed'].includes(p.state)||p.captionPartial&&p.media?.length)).map(p=>p.id);
 if(!ids.length){scheduleProgress('Không có bài lỗi trước khi gửi hoặc bài có media bị chặn do caption rút gọn.');return;}
 const minutes=dial.value().minutes;
 if(!Number.isSafeInteger(minutes)||minutes<1)throw Error('Khoảng cách đăng không hợp lệ.');
 await enqueue(ids,minutes,true);
});
on('auto-schedule',async()=>{
 try{scheduleProgress('Đang kiểm tra các bài cần xếp lịch…');
 const minutes=dial.value().minutes;
 if(!Number.isSafeInteger(minutes)||minutes<1)throw Error('Quay đồng hồ để chọn khoảng cách lớn hơn 0 phút.');
 const ids=schedulableIds();
 if(ids.length)await enqueue(ids,minutes);
 else if(state.bot?.jobs.some(j=>j.state==='queued')){await request('bot-start');await load();scheduleProgress('Đã bật lại hàng chờ; giữ nguyên lịch đặt tay và lịch theo kịch bản.');}
 else throw Error('Không có bài chờ sắp lịch.');
 }catch(e){scheduleProgress('Sắp lịch: '+e.message);throw e;}
});
on('resume-all',async()=>{await request('bot-start');await load();toast('Đã tiếp tục các bài còn chờ theo lịch hiện có.');});
on('bot-pause',async()=>{await request('bot-pause');await load();});
setInterval(()=>{if(!document.hidden&&!postDirty&&!busy&&!document.activeElement?.matches('.card-scheduling input'))load().catch(()=>{});},5000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!postDirty&&!busy)load().catch(()=>{});});
window.addEventListener('beforeunload',e=>{if(sourceDirty||postDirty||busy){e.preventDefault();e.returnValue='';}});
run(load);


on('csv-profile-cancel',()=>$('csv-profile-dialog').close());

on('media-copy-id',async()=>{await navigator.clipboard.writeText(chrome.runtime.id);$('media-bridge-result').textContent='Đã chép Extension ID.';});
on('media-check',async()=>{try{$('media-bridge-result').textContent=await request('media-bridge-status');}catch(e){$('media-bridge-result').textContent=e.message;}});
$('media-extension-id').textContent=chrome.runtime.id;


initAudienceUI();
