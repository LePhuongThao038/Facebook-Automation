'use strict';
const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms)),defaultFolder='1ZABqZbgQYTZnnTseJDPcYzaZWAv8cQiG';let posts=[],tabId,profileURL='',busy=false,ai,attemptedAI=false,notes=[],pending=new Map();
const note=t=>{if(!notes.includes(t))notes.push(t);$('notes').textContent=notes.join('\n')},status=t=>{$('report').hidden=false;$('status').textContent=t;activity.progress(t)};
chrome.storage.local.get('folder').then(x=>$('folder').value=x.folder??defaultFolder);$('folder').onchange=()=>chrome.storage.local.set({folder:$('folder').value.trim()});
function parse(raw){let s=raw.trim().replaceAll('\\','');if(!/^https?:\/\//i.test(s))s='https://'+s;let u=new URL(s);if(!/^(?:www\.|m\.|web\.|mbasic\.)?facebook\.com$/i.test(u.hostname)||u.username||u.password||u.port)throw Error('Hãy nhập link facebook.com của một bài hoặc trang cá nhân.');u.protocol='https:';u.hostname='www.facebook.com';for(const k of [...u.searchParams.keys()])if(!['id','fbid','story_fbid','v','set'].includes(k))u.searchParams.delete(k);u.hash='';let single=/\/(?:posts|reels?|videos|share\/[prv])\/[^/]+|\/(?:photo(?:\.php)?\/?|permalink\.php|story\.php|watch\/?)$/.test(u.pathname);if(!single&&!/^\/(?:profile\.php|people\/[^/]+\/\d+|[\w.-]+)\/?$/.test(u.pathname))throw Error('Chưa nhận diện được loại link Facebook này.');return {url:u.href,single}}
async function run(fn){if(busy)return;busy=true;activity.start();document.querySelectorAll('button').forEach(x=>x.disabled=true);try{await fn()}catch(e){status('Chưa hoàn tất: '+e.message);activity.fail(e.message)}finally{activity.finish();busy=false;document.querySelectorAll('button').forEach(x=>x.disabled=false)}}
async function openFB(url){activity.progress('Đang mở trang Facebook…');let t;if(tabId){try{t=await chrome.tabs.update(tabId,{url,active:false})}catch{}}if(!t)t=await chrome.tabs.create({url,active:false});tabId=t.id;for(let i=0;i<90;i++){await sleep(250);let q=await chrome.tabs.get(t.id);if(q.status==='complete'&&q.url&&q.url!=='about:blank')break}await sleep(1300)}
const captionSnapshots=new Map();
async function scan(mode, quota){const target={tabId};await chrome.scripting.executeScript({target,files:['caption.js','scan.js']});let [r]=await chrome.scripting.executeScript({target,func:async (m,n,k,id)=>{try{return {data:await globalThis.researchScan(m,n===null?Infinity:n,k,id)}}catch(e){return {error:e.message}}},args:[mode,quota??commentLimit(),mode.startsWith("profile")?[...pending.keys()]:[],mode==="profile"?liveScanId:null]});if(!r?.result||r.result.error)throw Error(r?.result?.error||'Không đọc được trang Facebook.');return r.result.data}
let liveScanId=null;
function receivePreviews(rows) {
  for(const {url,title,body,captionPartial} of rows) {
    if(body)captionSnapshots.set(url,researchCaption.choose({text:body,partial:Boolean(captionPartial),method:'timeline'},captionSnapshots.get(url)));
    const preview=body||title||'';
    if(pending.has(url)){if(body)pending.set(url,preview);continue;}
    pending.set(url,preview);appendPreview(url,preview);
  }
  if(pending.size)$('selection').hidden=false;
}
// Keep the clock on the dashboard. The Facebook tab performs one synchronous
// read and scroll per call, so background page timers cannot hold this job open.
function boundedRead(task, milliseconds){
  let timer;
  return Promise.race([task,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(Error('Tab Facebook không phản hồi.')),milliseconds);
  })]).finally(()=>clearTimeout(timer));
}
// Facebook's own "Go to date" filter loads a new timeline starting on
// the selected day, including its overlap with the previous page.
async function resumeAtDate(isoDate){
  const text=e=>e?.innerText?.trim();
  const press=e=>{
    e.focus({preventScroll:true});
    for(const type of ['pointerdown','mousedown','pointerup','mouseup']){
      const EventType=type.startsWith('pointer')?PointerEvent:MouseEvent;
      e.dispatchEvent(new EventType(type,{bubbles:true,cancelable:true,button:0,pointerType:'mouse'}));
    }
    e.click();
  };
  const find=(selector,scope=document)=>[...scope.querySelectorAll(selector)].filter(e=>e.getClientRects().length);
  const wait=async get=>{
    for(let n=0;n<80;n++){
      const element=get();
      if(element)return element;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    throw Error('Facebook chưa hiển thị bộ lọc ngày.');
  };
  const button=(name,scope)=>find('button,[role=button]',scope).find(e=>text(e)===name);
  const filter=button('Bộ lọc');
  if(!filter)return false;
  if(!find('[role=dialog]').some(e=>text(e)?.includes('Bộ lọc bài viết')))press(filter);
  const dialog=()=>find('[role=dialog]').find(e=>text(e)?.includes('Bộ lọc bài viết'));
  const [year,month,day]=isoDate.split('-').map(Number);
  try{
    for(const [field,value] of [['năm',String(year)],['tháng','Tháng '+month],['ngày',String(day)]]){
      const combo=await wait(()=>dialog() && find('[role=combobox]',dialog()).find(e=>(e.getAttribute('aria-label')||'').includes('kết thúc '+field))).catch(()=>{throw Error('Chưa tìm thấy ô chọn '+field);});
      if(text(combo)===value)continue;
      press(combo);
      const option=await wait(()=>find('[role=option]').find(e=>text(e)===value)).catch(()=>{throw Error('Facebook chưa mở danh sách '+field);});
      press(option);
    }
    press(await wait(()=>dialog() && button('Xong',dialog())));
    return true;
  }catch(error){
    if(dialog())find('[aria-label="Đóng"]',dialog())[0]?.click();
    return {error:error.message};
  }
}
let resumeDay='';
async function readProfilePage(source, dashboard){
  const rows=[], started=Date.now();
  let lastNew=started, nextAttempt=started+6500, attempts=0, askedAstra=false, total=null, detail='';
  let focusTaken=false;
  try{
    while(rows.length<30 && Date.now()-started<300000){
      let page;
      try{page=await boundedRead(scan('profileStep',30-rows.length),6500)}
      catch(error){detail=error.message}
      if(page){
        if(page.lastStoryDate)resumeDay=page.lastStoryDate;
        total=page.total??total;
        const fresh=page.rows.filter(post=>!pending.has(post.url));
        receivePreviews(fresh);
        rows.push(...fresh);
        if(fresh.length){
          lastNew=Date.now();nextAttempt=lastNew+6500;attempts=0;askedAstra=false;detail='';
        }
        $('pageCount').textContent='Đã hiển thị '+pending.size+'/'+(total??'?')+' bài';
        if(page.ended||rows.length>=30)return {rows,total,ended:page.ended};
      }
      const seconds=Math.floor((Date.now()-lastNew)/1000);
      if(Date.now()>=nextAttempt){
        if(askedAstra)break;
        let action;
        if(attempts<3){
          attempts++;
          action=['scroll','restore_focus',resumeDay?'reopen_timeline':'scroll'][attempts-1];
          status('Đang thử khôi phục '+attempts+'/3…');
        }else{
          askedAstra=true;
          status('Đã thử 3 lần. Đang hỏi GPT-6 Astra…');
          try{
            const reply=await fetch('http://127.0.0.1:47832/recover',{
              method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(50000),
              body:JSON.stringify({attempts,count:pending.size,hasDate:Boolean(resumeDay),responsive:Boolean(page)})});
            const plan=await reply.json();
            if(!reply.ok)throw Error(plan.error||'Trình kết nối Astra chưa sẵn sàng.');
            action=plan.action;
            if(!['wait_for_feed','restore_focus','reapply_date','reopen_timeline','stop'].includes(action))throw Error('Phản hồi Astra không hợp lệ.');
            note('Sau 3 lần thử, Astra chọn: '+({wait_for_feed:'chờ Facebook tải tiếp',restore_focus:'đưa Facebook ra trước',reapply_date:'mở lại bộ lọc ngày',reopen_timeline:'mở lại trang và tiếp tục theo ngày',stop:'dừng lượt quét'})[action]+'.');
            if(action==='stop'){detail='Astra đề nghị dừng lượt quét.';break}
          }catch(error){
            detail=error.message==='Failed to fetch'?'Chưa kết nối được Astra. Hãy chạy Start-Astra.ps1 trên máy.':error.message;
            break;
          }
        }
        try{
          if(action==='restore_focus' && chrome.windows && source.windowId!==dashboard.windowId){
            await chrome.windows.update(source.windowId,{focused:true});
            focusTaken=true;
          }
          if(action==='reopen_timeline')await openFB(profileURL);
          if((action==='reapply_date'||action==='reopen_timeline') && resumeDay){
            const [result]=await boundedRead(chrome.scripting.executeScript({target:{tabId:source.id},func:resumeAtDate,args:[resumeDay]}),30000);
            if(result?.result!==true)detail=result?.result?.error||'Facebook chưa áp dụng bộ lọc ngày.';
          }
          if(action==='scroll'){
            await boundedRead(chrome.scripting.executeScript({target:{tabId:source.id},func:()=>{
              const sc=document.scrollingElement;
              if(sc)sc.scrollBy(0,-Math.max(500,sc.clientHeight));
            }}),5000);
          }
        }catch(error){detail=error.message}
        nextAttempt=Date.now()+(askedAstra || action==='reapply_date' || action==='reopen_timeline' ? 25000 : 6500);
      }
      status('Đang quét · '+rows.length+'/30 bài trong lượt này.'+
        (seconds>=3?' Đã chờ '+seconds+' giây cho bài mới.'+(focusTaken?' Đã đưa Facebook ra trước.':''):''));
      await sleep(750);
    }
    return {rows,total,ended:false,detail:detail||'Chưa tìm thấy thêm link bài trong thời gian chờ.'};
  }finally{
    if(focusTaken && chrome.windows){
      const sourceWindow=await chrome.windows.get(source.windowId).catch(()=>null);
      if(sourceWindow?.focused)await chrome.windows.update(dashboard.windowId,{focused:true}).catch(()=>{});
    }
  }
}
async function profile(more){
  if(more && !(await chrome.tabs.get(tabId).catch(()=>null)))await openFB(profileURL);
  if(!more){
    resumeDay='';
    pending.clear();
    $('list').replaceChildren();
    selectionCount();
    await openFB(profileURL);
    status('Đang đọc thông tin nhân vật…');await loadCharacter(tabId,profileURL).catch(()=>note('Chưa đọc đủ phần giới thiệu trên Facebook.'));
  }
  status('Đang tìm bài trên trang cá nhân…');
  const dashboard=await chrome.tabs.getCurrent();
  let source=await chrome.tabs.get(tabId);
  // Keep Facebook's feed visible in its own window while the user selects results.
  if(source.windowId===dashboard.windowId && chrome.windows)
    await chrome.windows.create({tabId,type:'popup',focused:false,width:1150,height:820});
  await chrome.tabs.update(tabId,{active:true});
  source=await chrome.tabs.get(tabId);
  liveScanId=crypto.getRandomValues(new Uint32Array(4)).join('-');
  let page;
  try { page=await readProfilePage(source,dashboard) }
  finally { liveScanId=null }
  receivePreviews(page.rows);
activity.progress('Đang giữ caption gốc cho '+page.rows.length+' bài…');await fillTitles(page.rows.map(({url,title})=>({url,body:excerpt(title)})));for(const input of document.querySelectorAll('#list input')){
  input.closest('.postCard').querySelector('strong').textContent=cachedTitle(input.value,pending.get(input.value));
};$('more').hidden=page.ended;$('pageCount').textContent='Đã hiển thị '+pending.size+'/'+(page.ended?pending.size:page.total??'?')+' bài'+(!page.ended&&page.total===null?' · chưa rõ tổng số':'')+(!page.ended&&page.rows.length<30?' · Facebook chưa tải đủ lượt này':'');$('selection').hidden=false;if(!page.ended&&page.rows.length<30)activity.fail('Lượt quét đã dừng sau '+page.rows.length+'/30 bài mới. '+(page.detail||'Facebook chưa hiển thị thêm bài.')+' Bấm “Quét thêm 30 bài” để thử tiếp.');status(pending.size?'Tìm thấy '+pending.size+' bài. Tick những bài muốn đưa vào tài liệu.':'Chưa tìm thấy bài. Mở tab Facebook vừa tạo để kiểm tra đăng nhập hoặc thử link bài lẻ.')}
$('go').onclick=()=>run(async()=>{let x=parse($('source').value);character=null;showCharacter();commentLimit();cardStates.clear();delete $('selection').dataset.tracking;titleMap.clear();pending.clear();captionSnapshots.clear();$('bridge').hidden=true;$('selection').hidden=true;$('actions').hidden=true;$('doc').hidden=true;notes=[];$('notes').textContent='';posts=[];if(x.single)await collect([x.url]);else{profileURL=x.url;await profile(false)}});$('source').onkeydown=e=>{if(e.key==='Enter')$('go').click()};$('more').onclick=()=>run(()=>profile(true));$('all').onclick=()=>{document.querySelectorAll('#list input').forEach(x=>x.checked=true);selectionCount()};$('none').onclick=()=>{document.querySelectorAll('#list input').forEach(x=>x.checked=false);selectionCount()};$('start').onclick=()=>run(async()=>{let links=[...document.querySelectorAll('#list input:checked')].map(x=>x.value);if(!links.length)throw Error('Chọn ít nhất một bài.');$('selection').dataset.tracking='true';
document.querySelectorAll('#list input').forEach(input=>input.disabled=true);
for(const url of links) cardStage(url,'queued');
await collect(links)});
async function titleOf(b){if(!attemptedAI){attemptedAI=true;try{let o={type:'headline',format:'plain-text',length:'short',outputLanguage:'vi'};if(globalThis.Summarizer&&await Summarizer.availability(o)==='available')ai=await Summarizer.create({...o,signal:AbortSignal.timeout(8000)})}catch{}}let t='';if(ai&&b.body)try{t=await ai.summarize(b.body,{signal:AbortSignal.timeout(8000)})}catch{}if(!t){note('Không có AI tiếng Việt sẵn dùng cho một số bài; tiêu đề các bài đó lấy từ dòng mở đầu.');t=b.body.split('\n').find(s=>s.trim())||(b.video?'Video':'Hình ảnh')+(b.author?' của '+b.author:'')}return t.trim().split(/\s+/).slice(0,14).join(' ')}
async function media(url){let u=new URL(url);if(u.protocol!=='https:'||!/(^|\.)(facebook\.com|fbcdn\.net|fbsbx\.com)$/.test(u.hostname))throw Error('Nguồn media không được hỗ trợ');let r=await fetch(u,{credentials:'include',signal:AbortSignal.timeout(90000)});if(!r.ok)throw Error('HTTP '+r.status);return r.blob()}
async function pic(u){let b=await createImageBitmap(await media(u)),s=Math.min(1,1600/Math.max(b.width,b.height)),c=new OffscreenCanvas(Math.max(1,Math.round(b.width*s)),Math.max(1,Math.round(b.height*s)));let ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,c.width,c.height);ctx.drawImage(b,0,0,c.width,c.height);b.close();return {w:c.width,h:c.height,data:new Uint8Array(await (await c.convertToBlob({type:'image/jpeg',quality:.86})).arrayBuffer())}}
async function collect(urls){posts=[];for(const [i,url] of urls.entries()){cardStage(url,'reading');status('Đang đọc bài '+(i+1)+'/'+urls.length+'…');try{let b=await readResearchPost(url,captionSnapshots.get(url));b.url=url;b.warnings=[];
const warn=message=>{b.warnings.push(message);note(message)};
if(b.captionState==='unreadable')warn('Chưa xác định được caption nguồn; không coi đây là bài vốn không có caption.');if(b.captionFallback)warn('Đã giữ caption lấy từ lượt quét trước cho bài này vì trang chi tiết chưa trả đủ chữ.');if(b.captionPartial)warn('Caption có thể còn bị rút gọn; kiểm tra nội dung trước khi dùng.');await fillTitles([b]);b.title=cachedTitle(b.url,b.body);if(b.stoppedEarly)warn(b.title+": Facebook chưa tải tiếp được bình luận.");b.pics=[];if(b.more&&b.gallery){try{let imgs=await retryRead(url,async()=>{const list=await scan('gallery');if(list.length<b.images.length)throw Error('Album chưa tải đủ');return list},{browser:true,source:b.gallery});if(imgs.length>=b.images.length)b.images=imgs;else warn(b.title+': album chỉ đọc được một phần.')}catch{warn(b.title+': chưa mở được album đầy đủ.')}}else if(b.more)warn(b.title+': chỉ lấy được ảnh đang hiển thị.');for(const u of b.images)try{b.pics.push({...await retryRead(url,()=>pic(u)),src:u})}catch{warn(b.title+': có ảnh không tải được.')}posts.push(b);cardStage(url,'ready',b.warnings.join(' '))}catch(e){cardStage(url,'failed',e.message);activity.fail('Chưa đọc được bài '+(i+1)+'. '+e.message);note(url+' — '+e.message)}}if(!posts.length)throw Error('Không có bài nào đọc được. Xem chi tiết bên dưới.');if(!character&&urls.length===1&&posts[0].authorURL){try{await openFB(posts[0].authorURL);await loadCharacter(tabId,posts[0].authorURL)}catch{note('Chưa đọc được trang cá nhân của tác giả.')}}await fetchCharacterPics();showVideoDownloads(posts);$('actions').hidden=false;status('Đã lấy '+posts.length+'/'+urls.length+' bài · '+posts.reduce((s,p)=>s+p.pics.length,0)+' ảnh · '+posts.reduce((s,p)=>s+p.comments.length,0)+' bình luận và phản hồi.');if($('provider').value==='meta'){note('Có thể áp dụng tiêu đề Meta AI trước khi xuất.');showBridge()}else if(configured())await exportDrive();else note('Để lưu vào Google Docs, bấm Sao chép và mở Google Docs, rồi nhấn Ctrl+V.')}
function configured(){return !!chrome.runtime.getManifest().oauth2?.client_id}
async function token(){if(!configured())throw Error('Chưa có OAuth Client ID cho tiện ích. Mở “Hướng dẫn kết nối”, cấu hình một lần rồi bấm Đồng bộ Drive.');let x=await chrome.identity.getAuthToken({interactive:true});return x.token||x}
async function api(path,t,options={}){let res=await fetch('https://www.googleapis.com/'+path,{...options,headers:{Authorization:'Bearer '+t,...options.headers}});let j=await res.json();if(!res.ok){if(res.status===401)await chrome.identity.removeCachedAuthToken({token:t});throw Object.assign(Error(j.error?.message||'Drive HTTP '+res.status),{status:res.status})}return j}
async function upload(t,metadata,blob){let bd='research_'+crypto.randomUUID();return api('upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink',t,{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+bd},body:new Blob(['--'+bd+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n',JSON.stringify(metadata),'\r\n--'+bd+'\r\nContent-Type: '+blob.type+'\r\n\r\n',blob,'\r\n--'+bd+'--'])})}
async function exportDrive(){if(!$('doc').hidden)return;
try {
let t=await token(),dest=await destination(t);for(const b of posts) cardStage(b.url,'saving');
status('Đang tạo Google Docs…');let f=dest.doc?await appendExisting(t,dest):await upload(t,{parents:[dest.folder],name:'Sổ nghiên cứu – '+posts[0].title,mimeType:'application/vnd.google-apps.document'},buildDoc(posts,character));$('doc').href='https://docs.google.com/document/d/'+f.id+'/edit'+(dest.tab?'?tab='+encodeURIComponent(dest.tab):'');$('doc').hidden=false;$('drive').hidden=true;
for(const b of posts) cardStage(b.url,b.warnings.length?'partial':'done',b.warnings.join(' '));
status((dest.doc?'Đã ghi vào tài liệu đã chọn: ':'Đã tạo Google Docs: ')+posts.length+' bài.')
} catch(error) {
  for(const b of posts) cardStage(b.url,'saveError',error.message);
  throw error;
}}
$('drive').onclick=()=>run(exportDrive);$('word').onclick=()=>{let u=URL.createObjectURL(buildDoc(posts,character)),a=document.createElement('a');a.href=u;a.download='Sổ nghiên cứu – '+posts[0].title.replace(/[\\/:*?"<>|]/g,'')+'.docx';a.click();setTimeout(()=>URL.revokeObjectURL(u),60000)};$('connect').onclick=()=>run(async()=>{await token();$('conn').textContent='Đã kết nối.'});$('go').addEventListener('click',()=>{$('drive').hidden=false});


