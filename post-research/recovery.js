const recoveryLabels = {wait:'Chờ trang tải', reopen:'Mở lại bài', foreground:'Đọc ở tab đang hiển thị'};
async function recoveryStrategy(error, attempt) {
  const fallback = ['wait', 'reopen', 'foreground'][attempt - 1];
  const symptom = /frame|tab|navigat/i.test(error.message) ? 'navigation changed'
    : /video|media/i.test(error.message) ? 'media unavailable' : 'content not ready';
  const prompt = 'A Facebook reader failed. Symptom: '+symptom+'. Retry number '+attempt+
    '. Choose exactly one supported action: wait, reopen, foreground.';
  let answer = '';
  try {
    if ($('provider').value === 'gemini' && $('key').value.trim() && /^gemini-[\w.-]+$/.test($('model').value.trim())) {
      const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/'+$('model').value.trim()+':generateContent', {
        method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':$('key').value.trim()},
        signal:AbortSignal.timeout(6000), body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})
      });
      if(response.ok) answer=(await response.json()).candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else if ($('provider').value==='local' && globalThis.LanguageModel && await LanguageModel.availability()==='available') {
      const signal=AbortSignal.timeout(6000);
      const session=await LanguageModel.create({signal});
      try {answer=await session.prompt(prompt,{signal})} finally {session.destroy()}
    }
  } catch {}
  const chosen=answer.trim().toLowerCase();
  return Object.hasOwn(recoveryLabels,chosen)?{action:chosen,source:'AI'}:{action:fallback,source:'Tự động'};
}

async function retryRead(url, operation, {browser=false, stage='reading', source=url}={}) {
  let action='initial', lastError;
  for(let attempt=0;attempt<=3;attempt++) {
    let dashboard;
    try {
      if(attempt) {
        const choice=browser?await recoveryStrategy(lastError,attempt):{action:'wait',source:'Tự động'};
        action=choice.action;
        const message=choice.source+' · thử lại '+attempt+'/3 · '+recoveryLabels[action];
        activity.progress(message);
        cardStage(url,stage,message);
        await sleep(500*2**(attempt-1));
      }
      if(browser && (action==='initial'||action==='reopen'||!tabId)) await openFB(source);
      if(browser && action==='foreground') {
        dashboard=await chrome.tabs.getCurrent();
        await chrome.tabs.update(tabId,{active:true});
      }
      return await operation();
    } catch(error) {lastError=error}
    finally {
      if(dashboard?.id && (await chrome.tabs.get(tabId).catch(()=>null))?.active)
        await chrome.tabs.update(dashboard.id,{active:true}).catch(()=>{});
    }
  }
  throw new Error(lastError.message+' (đã thử lại 3 lần)');
}

async function videoFile(post) {
  if(post.videoURL)try{
    const blob=await media(post.videoURL);
    if(blob.type.startsWith('video/') && blob.size)return blob;
  }catch{}
  let response;
  try{
    response=await fetch('http://127.0.0.1:47833/video',{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({url:post.url}),signal:AbortSignal.timeout(250000)
    });
  }catch(error){
    throw Error(error.name==='TimeoutError'?'Tải video quá thời gian chờ.':'Mở Start-Video.cmd trong thư mục tiện ích rồi thử lại.');
  }
  if(!response.ok)throw Error((await response.text()).slice(0,250)||'Không tải được video.');
  const blob=await response.blob();
  if(!blob.size||!blob.type.startsWith('video/'))throw Error('Nguồn chưa trả về tệp video.');
  return blob;
}

function showVideoDownloads(items){const list=$('videoDownloads');list.replaceChildren();if(items.some(p=>p.video)){const note=document.createElement('p');note.textContent='Video/Reels đi cùng bài dưới dạng Media JSON trong Docs. FB Desk dùng Media Bridge Python để dựng MP4 trước khi đăng, không cần tải từng tệp thủ công.';list.append(note);}}

async function syncVideo(post, token, folder) {
  let blob;
  await retryRead(post.url,async()=>{
    if(!post.videoId) {
      if(!post.uploadId) {
        const generated=await api('drive/v3/files/generateIds?count=1&space=drive',token);
        post.uploadId=generated.ids[0];
      }
      if(post.uploadSent) {
        // A lost response may follow a successful create. Reuse the reserved ID.
        try {post.videoId=(await api('drive/v3/files/'+post.uploadId+'?supportsAllDrives=true&fields=id',token)).id}
        catch(error){if(error.status!==404)throw error}
      }
      if(!post.videoId) {
        blob ||= await videoFile(post);
        if(!blob.type.startsWith('video/'))throw Error('Nguồn không trả về tệp video');
        const ext=blob.type.includes('webm')?'.webm':'.mp4';
        post.uploadSent=true;
        post.videoId=(await upload(token,{id:post.uploadId,name:post.title+ext,parents:[folder]},blob)).id;
      }
    }
    await api('drive/v3/files/'+post.videoId+'/permissions?supportsAllDrives=true',token,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({role:'reader',type:'anyone',allowFileDiscovery:false})
    });
    post.shared='https://drive.google.com/file/d/'+post.videoId+'/view';
  },{stage:'saving'});
}

async function readResearchPost(url,preview) {
  let best,caption=preview,emptyChecks=0;
  const finish=post=>{const selected=caption?.text?caption:{text:post.body||'',partial:Boolean(post.captionPartial),method:post.captionMethod};return {...post,body:selected.text,captionState:selected.text?'present':emptyChecks>=3?'no_caption':'unreadable',captionEvidence:selected.text?(selected.method||'source-text'):emptyChecks>=3?'media-only; three stable reads; no loading/login':'caption not established',captionPartial:Boolean(selected.partial),captionFallback:Boolean(selected.fallback)||(!post.body&&Boolean(selected.text))};};
  try {
    await retryRead(url,async()=>{
      const post=await scan('post');
      caption=researchCaption.choose({text:post.body||'',partial:Boolean(post.captionPartial),method:post.captionMethod},caption);
      const score=p=>Number(!!p.videoURL)*100000+Number(!p.stoppedEarly)*10000+(p.comments?.length||0);
      if(!best || score(post)>score(best))best=post;
      if(!caption?.text){if(post.captionEmptyCandidate){emptyChecks++;if(emptyChecks<3)throw Error('Đang kiểm tra bài chỉ có media, chưa kết luận không có caption.');}else emptyChecks=0;}
      if(post.stoppedEarly)throw Error('Bình luận chưa tải hết');
      return post;
    },{browser:true});
    return finish(best);
  } catch(error) {
    if(best)return finish(best);
    throw error;
  }
}
