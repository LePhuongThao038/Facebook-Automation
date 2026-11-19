// Portable coordinator. Persistence, authentication and lock are provided by host.
const clone=v=>JSON.parse(JSON.stringify(v));
function coordinatorURL(value){const m=String(value).match(/^https:\/\/(www\.)?facebook\.com(\/[^#]*)?(?:#.*)?$/i);if(!m)throw Error('Invalid Facebook URL.');const part=m[2]||'/',pathname=part.split('?')[0],query=part.includes('?')?part.slice(part.indexOf('?')+1):'';const params=query.split('&').map(x=>x.split('=').map(v=>decodeURIComponent(v.replace(/\+/g,' '))));return {protocol:'https:',hostname:m[1]?'www.facebook.com':'facebook.com',pathname,searchParams:{has:k=>params.some(x=>x[0]===k),get:k=>params.find(x=>x[0]===k)?.[1]||''}};}
export function initialCommentState(){return {schema:'desk.comment-store/1',revision:0,paused:true,workers:[],plans:[],jobs:[],nextByUid:{}};}
function networkReadiness(s,now){
 const n=s.network;if(!n)return {required:false,ready:true,profiles:[]};
 const activeUids=n.activeUids||n.uids;
 const profiles=activeUids.map(uid=>{const p=n.reports[uid],fresh=!!p&&now-p.at<86400000;return {uid,publicReady:fresh&&p.publicReady===true,friendsReady:fresh&&activeUids.every(other=>other===uid||p.friendUids.includes(other)),reportedAt:p?.at||0};});
 return {required:true,publicPolicy:n.publicPolicy||'all-history',activeUids,rosterSize:n.uids.length,ready:profiles.every(p=>(n.publicPolicy==='target-public-v1'||p.publicReady)&&p.friendsReady),profiles};
}
export function commentDispatch(state,request,auth,now,token,hashText){
 const s=clone(state),type=request.action,admin=auth.admin===true;
 const fail=m=>{throw Error(m);};
 const requireAdmin=()=>{if(!admin)fail('Admin permission required.');};
 const worker=s.workers.find(w=>w.id===auth.workerId&&!w.disabled);
 const own=()=>{if(!worker)fail('Worker is not paired.');return worker;};
 const inCohort=uid=>!s.network||(s.network.activeUids||s.network.uids).includes(uid);
 const planInCohort=j=>{const p=s.plans.find(p=>p.key===j.planKey);return p&&inCohort(p.authorUid)&&s.jobs.filter(x=>x.planKey===j.planKey).every(x=>inCohort(x.actorUid)&&inCohort(x.recipientUid));};
 const job=()=>{const w=own(),j=s.jobs.find(j=>j.id===request.jobId);if(!j||j.actorUid!==w.uid||j.workerId!==w.id||j.leaseToken!==request.leaseToken||j.leaseUntil<=now)fail('Lease is invalid or expired.');return j;};
 const receiptId=u=>{try{const x=coordinatorURL(u);return x.searchParams.get('reply_comment_id')||x.searchParams.get('comment_id')||'';}catch{return '';}};
 // Expired leases before send may retry; anything possibly sent never retries blindly.
 for(const j of s.jobs){if(['leased','sending','verifying'].includes(j.state)&&j.leaseUntil<=now){j.state=j.state==='leased'||j.state==='sending'&&!j.clickAuthorized?'queued':'uncertain';j.error='Lease expired';j.workerId='';j.leaseToken='';}}
 let result;
 if(type==='status'){
  if(!admin)own();result={protocolVersion:2,paused:s.paused,revision:s.revision,network:networkReadiness(s,now),workers:admin?s.workers.map(w=>({id:w.id,uid:w.uid,disabled:w.disabled,lastSeen:w.lastSeen})):undefined,jobs:s.jobs.filter(j=>admin||j.actorUid===worker.uid).map(j=>({id:j.id,stepId:j.stepId,actorUid:j.actorUid,state:j.state,notBefore:j.notBefore,receipt:j.receipt,error:j.error,text:j.text,postUrl:j.postUrl}))};
 }else if(type==='networkConfigure'){
  requireAdmin();const uids=[...new Set(request.uids||[])].sort();if(uids.length!==15||uids.some(uid=>!/^\d{5,25}$/.test(uid)))fail('Network requires exactly 15 distinct clone UIDs.');
  if(s.network&&JSON.stringify(s.network.uids)!==JSON.stringify(uids))fail('Fixed network UID roster changed; stop and review the network before migration.');
  if(!s.network)s.network={uids,reports:{}};if(request.activeUids!==undefined){if(!Array.isArray(request.activeUids))fail('Invalid trial cohort.');const active=[...new Set(request.activeUids)].sort();if(active.length<2||active.length>uids.length||active.length!==request.activeUids.length||active.some(uid=>!uids.includes(uid)))fail('Trial cohort must contain distinct UIDs from the fixed roster.');if(JSON.stringify(active)!==JSON.stringify(s.network.activeUids||uids)){if(!s.paused||s.jobs.some(j=>['leased','sending','verifying'].includes(j.state)))fail('Pause coordinator and finish active jobs before changing trial cohort.');s.network.activeUids=active;}}if(request.publicPolicy!==undefined){if(!['all-history','target-public-v1'].includes(request.publicPolicy))fail('Invalid public policy.');if(request.publicPolicy!==(s.network.publicPolicy||'all-history')&&s.jobs.some(j=>['leased','sending','verifying'].includes(j.state)))fail('Stop active comment jobs before changing public policy.');s.network.publicPolicy=request.publicPolicy;}result=networkReadiness(s,now);
 }else if(type==='networkReport'){
  const w=own();if(!s.network?.uids.includes(w.uid))fail('Worker UID is outside the fixed clone network.');
  s.network.reports[w.uid]={at:now,publicReady:request.publicReady===true,friendUids:[...new Set(request.friendUids||[])].filter(uid=>s.network.uids.includes(uid)&&uid!==w.uid)};result=networkReadiness(s,now);
 }else if(type==='pair'){
  requireAdmin();if(!/^\d{5,25}$/.test(request.uid||''))fail('Invalid UID.');const old=s.workers.find(w=>w.uid===request.uid&&!w.disabled);if(old)old.disabled=true;
  const w={id:token(),uid:request.uid,secret:token(),disabled:false,lastSeen:0};s.workers.push(w);result={workerId:w.id,workerToken:w.secret,uid:w.uid};
 }else if(type==='pause'){
  requireAdmin();s.paused=request.paused!==false;result={paused:s.paused};
 }else if(type==='installPlan'){
  requireAdmin();const p=request.plan;
  if(p?.schema!=='desk.comment-plan/1'||!p.id||!p.post?.id||!/^\d{5,25}$/.test(p.post.authorUid||'')||!Array.isArray(p.jobs)||!p.jobs.length||p.jobs.length>200)fail('Invalid plan.');
  const key=p.post.authorUid+':'+p.id+':'+p.post.id,existing=s.plans.find(x=>x.key===key),fingerprint=JSON.stringify(p.jobs.map(j=>[j.stepId,j.actorUid,j.recipientUid,j.parentStepId,j.textSha256,j.delayAfterPreviousSeconds,j.dependsOnStepIds,j.personaFingerprint]));
  if(existing){if(existing.fingerprint!==fingerprint)fail('Plan already installed; edited script requires a new ID.');result={alreadyInstalled:true,count:s.jobs.filter(j=>j.planKey===key).length};}
  else{
   const seen=new Set();for(const j of p.jobs){if(!j.id||s.jobs.some(x=>x.id===j.id)||seen.has(j.stepId)||!/^\d{5,25}$/.test(j.actorUid||'')||!j.text?.trim()||j.text.length>8000||!/^[a-f0-9]{64}$/.test(j.textSha256||'')||!/^[a-f0-9]{64}$/.test(j.personaFingerprint||'')||!['comment','reply'].includes(j.kind)||!Number.isInteger(j.delayAfterPreviousSeconds)||j.delayAfterPreviousSeconds<60||!Array.isArray(j.dependsOnStepIds)||j.dependsOnStepIds.some(id=>!seen.has(id)))fail('Invalid or duplicate job/dependency.');if(hashText&&hashText(j.text)!==j.textSha256)fail('Text SHA-256 mismatch.');if(j.parentStepId&&!seen.has(j.parentStepId))fail('Parent must precede reply.');seen.add(j.stepId);}
   if(s.jobs.length+p.jobs.length>2000)fail('Coordinator capacity reached (2000 jobs). Archive/rotate storage before adding plans.');
   const rec={key,postId:p.post.id,authorUid:p.post.authorUid,fingerprint,registryId:p.registryId,revision:p.registryRevision,published:false,postUrl:'',publishedAt:0};
   s.plans.push(rec);for(const j of p.jobs)s.jobs.push({...clone(j),planKey:key,state:'waiting_post',attempt:0,notBefore:0,leaseUntil:0,workerId:'',leaseToken:'',sendingAt:0,clickAuthorized:false,receipt:null,error:''});result={installed:true,count:p.jobs.length};
  }
 }else if(type==='publish'){
  const w=own();if(request.authorUid!==w.uid)fail('Publication author does not match worker UID.');
  const url=String(request.postUrl||'');let u;try{u=coordinatorURL(url);}catch{fail('Invalid post URL.');}
  if(u.protocol!=='https:'||!['www.facebook.com','facebook.com'].includes(u.hostname)||!(/\/(posts|videos|reel)\/[\w.-]+/.test(u.pathname)||(u.pathname==='/permalink.php'&&u.searchParams.has('story_fbid')&&u.searchParams.has('id'))))fail('Canonical published post required.');if(u.searchParams.has('id')&&u.searchParams.get('id')!==w.uid)fail('Permalink author UID mismatch.');
  const plans=s.plans.filter(p=>p.postId===request.postId&&p.authorUid===w.uid);
  for(const p of plans){if(p.published&&p.postUrl!==url)fail('Publication URL changed; manual review required.');if(!p.published){p.published=true;p.postUrl=url;p.publishedAt=now;for(const j of s.jobs.filter(j=>j.planKey===p.key)){j.postUrl=url;j.state='queued';j.notBefore=now+j.delayAfterPreviousSeconds*1000;}}}
  result={matchedPlans:plans.length};
 }else if(type==='claim'){
  const w=own();w.lastSeen=now;if(s.paused)result={job:null,paused:true};else if(!inCohort(w.uid))result={job:null,blocked:'outside_trial_cohort'};else if(!networkReadiness(s,now).ready)result={job:null,blocked:'network_prerequisites',network:networkReadiness(s,now)};else{
   if(s.jobs.some(j=>j.actorUid===w.uid&&['leased','sending','verifying'].includes(j.state)))result={job:null,busy:true};
   else{const j=s.jobs.find(j=>j.actorUid===w.uid&&planInCohort(j)&&j.state==='queued'&&j.notBefore<=now&&(s.nextByUid[w.uid]||0)<=now&&j.dependsOnStepIds.every(id=>{const dep=s.jobs.find(x=>x.planKey===j.planKey&&x.stepId===id);return dep?.state==='success'&&dep.receipt&&now>=dep.finishedAt+j.delayAfterPreviousSeconds*1000;}));
    if(!j)result={job:null};else{j.state='leased';j.workerId=w.id;j.leaseToken=token();j.leaseUntil=now+180000;j.attempt++;const p=s.plans.find(p=>p.key===j.planKey),parent=s.jobs.find(x=>x.planKey===j.planKey&&x.stepId===j.parentStepId);result={job:{...clone(j),requirePublic:true,authorUid:p.authorUid,parentReceipt:parent?.receipt||null}};}
   }
  }
 }else if(type==='heartbeat'){
  const j=job();if(!['leased','sending','verifying'].includes(j.state))fail('Job is not active.');j.leaseUntil=now+180000;worker.lastSeen=now;result={paused:s.paused};
 }else if(type==='sending'){
  const j=job();if(s.paused||!planInCohort(j)||!networkReadiness(s,now).ready||j.state!=='leased')fail('Paused, network prerequisites missing or invalid sending transition.');if(request.textSha256!==j.textSha256)fail('Text hash mismatch.');j.state='sending';j.sendingAt=now;j.leaseUntil=now+180000;result={ok:true};
 }else if(type==='authorizeClick'){
  const j=job();if(s.paused||!planInCohort(j)||!networkReadiness(s,now).ready||j.state!=='sending'||j.clickAuthorized)fail('Send permission unavailable.');j.clickAuthorized=true;j.state='verifying';s.nextByUid[j.actorUid]=now+60000;result={ok:true};
 }else if(type==='retryBeforeSend'){
  requireAdmin();const j=s.jobs.find(j=>j.id===request.jobId);if(!j||j.state!=='failed_before_send'||j.clickAuthorized)fail('Only definitely-unsent jobs may retry.');j.state='queued';j.notBefore=now+60000;j.error='';j.sendingAt=0;result={queued:true};
 }else if(type==='reconcile'){
  requireAdmin();const j=s.jobs.find(j=>j.id===request.jobId);if(!j||j.state!=='uncertain'||request.reviewed!==true||!receiptId(request.url))fail('Manual review and a specific comment URL are required.');
  const target=coordinatorURL(j.postUrl),receipt=coordinatorURL(request.url);if(target.pathname!==receipt.pathname||target.searchParams.get('story_fbid')!==receipt.searchParams.get('story_fbid')||target.searchParams.get('id')!==receipt.searchParams.get('id'))fail('Receipt URL belongs to another post.');
  const parent=s.jobs.find(x=>x.planKey===j.planKey&&x.stepId===j.parentStepId),parentId=parent?receiptId(parent.receipt?.url):'';
  if(j.parentStepId&&(receipt.searchParams.get('comment_id')!==parentId||!receipt.searchParams.has('reply_comment_id')))fail('Reply URL parent mismatch.');if(!j.parentStepId&&receipt.searchParams.has('reply_comment_id'))fail('Expected a top-level comment.');
  j.receipt={url:request.url,postUrl:j.postUrl,actorUid:j.actorUid,textSha256:j.textSha256,parentCommentId:parentId,reviewedByOperator:true};j.state='success';j.finishedAt=now;j.leaseUntil=0;j.error='';result={success:true,manual:true};
 }else if(type==='receipt'){
  const done=s.jobs.find(j=>j.id===request.jobId);if(done?.state==='success'&&worker&&done.workerId===worker.id&&done.leaseToken===request.leaseToken&&JSON.stringify(done.receipt)===JSON.stringify(request.receipt))return {state:s,result:{success:true,alreadyRecorded:true}};
  const j=job(),v=request.receipt;
  if(!['sending','verifying'].includes(j.state)||!j.clickAuthorized||!v||v.actorUid!==j.actorUid||v.textSha256!==j.textSha256||v.postUrl!==j.postUrl||!receiptId(v.url))fail('Receipt does not match job.');
  const parent=s.jobs.find(x=>x.planKey===j.planKey&&x.stepId===j.parentStepId);
  const target=coordinatorURL(j.postUrl),receiptURL=coordinatorURL(v.url);if(target.pathname!==receiptURL.pathname||target.searchParams.get('story_fbid')!==receiptURL.searchParams.get('story_fbid')||target.searchParams.get('id')!==receiptURL.searchParams.get('id'))fail('Receipt URL belongs to another post.');
  if(j.parentStepId&&(!parent?.receipt||v.parentCommentId!==receiptId(parent.receipt.url)))fail('Reply parent receipt mismatch.');
  if(!j.parentStepId&&v.parentCommentId)fail('Top-level comment reported as reply.');
  j.state='success';j.receipt=clone(v);j.finishedAt=now;j.leaseUntil=0;result={success:true};
 }else if(type==='fail'){
  const j=job();if(j.state==='leased'||j.state==='sending'&&!j.clickAuthorized){j.state='failed_before_send';}else j.state='uncertain';j.error=String(request.error||'Worker interrupted').slice(0,1500);j.leaseUntil=0;result={state:j.state};
 }else if(type==='recover'){
  const j=job();if(!['leased','sending','verifying'].includes(j.state))fail('Job is not recoverable by worker.');if(j.clickAuthorized){j.state='uncertain';j.error='Worker recovered after click authorization; review receipt before continuing.';}else{j.state='queued';j.notBefore=Math.max(j.notBefore,now+60000);j.workerId='';j.leaseToken='';j.sendingAt=0;}j.leaseUntil=0;result={state:j.state};
 }else if(type==='release'){
  const j=job();if(j.state!=='leased')fail('Cannot requeue potentially sent job.');j.state='queued';j.workerId='';j.leaseToken='';j.leaseUntil=0;result={released:true};
 }else fail('Unknown coordinator action.');
 s.revision++;return {state:s,result};
}
