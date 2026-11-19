// When a new Docs source is read, unposted posts from older sources are replaced.
// Anything that is posted, posting, or possibly posted is kept so it is never
// lost or published twice. Removed data is backed up in d.replacedBackup.
const PROTECTED_POST_STATES=['success','running','verifying','unknown','partial'];
const PROTECTED_JOB_STATES=['running','verifying','unknown','partial','success'];

export function isNewSource(d,posts){
 const keys=new Set(posts.map(p=>p.sourceKey).filter(Boolean));
 if(keys.size!==1)return false;
 const [key]=keys;
 return !(d.posts||[]).some(p=>p.sourceKey===key);
}

export function replacePendingPosts(d,newKey,now=new Date().toISOString()){
 const jobs=d.bot?.jobs||[];
 const protectedIds=new Set(jobs.filter(j=>PROTECTED_JOB_STATES.includes(j.state)||j.submittedAt).map(j=>j.postId));
 const removable=p=>p.sourceKey!==newKey&&!PROTECTED_POST_STATES.includes(p.state)&&!protectedIds.has(p.id)&&!p.postUrl;
 const removed=(d.posts||[]).filter(removable);
 if(!removed.length)return {removed:0,cancelled:0,kept:0};
 const ids=new Set(removed.map(p=>p.id));
 const cancelledJobs=jobs.filter(j=>ids.has(j.postId)&&j.state==='queued');
 d.replacedBackup={at:now,newSourceKey:newKey,posts:structuredClone(removed),jobs:structuredClone(cancelledJobs)};
 for(const j of cancelledJobs){j.state='cancelled';j.stage='replaced';j.error='Đã thay bằng nguồn Docs mới.';j.finishedAt=now;}
 d.posts=d.posts.filter(p=>!ids.has(p.id));
 if(d.bot?.plan?.ids?.some(id=>ids.has(id)))d.bot.plan=null;
 const kept=d.posts.filter(p=>p.sourceKey!==newKey&&p.state!=='success').length;
 return {removed:removed.length,cancelled:cancelledJobs.length,kept};
}
