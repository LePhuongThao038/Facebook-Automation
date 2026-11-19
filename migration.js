import {validateRegistry} from './persona-model.js';
export const migrationKeys=['deskV2','friendDesk1','friendForm','deskRestrictionHistory','deskLastInteraction','deskPersonas','deskCrossMappings','deskCrossReplyParents','deskCrossRosterInitialized','deskAudienceHistory'];
export function makeSnapshot(raw){
 const data=structuredClone(Object.fromEntries(migrationKeys.filter(k=>raw[k]!==undefined).map(k=>[k,raw[k]])));
 if(!Array.isArray(data.deskV2?.posts)||!Array.isArray(data.deskV2?.logs))throw Error('Thiếu dữ liệu bài đăng.');
 if(data.friendDesk1)delete data.friendDesk1.active;
 if(data.friendDesk1?.config)delete data.friendDesk1.config.key;
 for(const j of data.deskV2.bot?.jobs||[]){delete j.token;delete j.runnerTabId;delete j.facebookTabId;}
 for(const r of data.friendDesk1?.rows||[]){delete r.token;delete r.tab;}
 if(data.deskAudienceHistory){delete data.deskAudienceHistory.runnerTabId;delete data.deskAudienceHistory.activeTabId;delete data.deskAudienceHistory.sessionId;for(const j of data.deskAudienceHistory.jobs||[])delete j.token;}
 return {format:'FacebookDesk/1',created:new Date().toISOString(),data};
}
export function restoreSnapshot(file){
 if(file.format!=='FacebookDesk/1')throw Error('Sai định dạng bản sao.');
 const {data}=makeSnapshot(file.data);
 if(data.deskPersonas)data.deskPersonas=validateRegistry(data.deskPersonas);
 if(data.deskCrossMappings){const ids=new Set(data.deskPersonas?.profiles.map(p=>p.id)||[]);for(const [key,id]of Object.entries(data.deskCrossMappings))if(!key.includes(':vai:')||!ids.has(key.split(':vai:')[0])||!ids.has(id))throw Error('Bản sao có ánh xạ vai không thuộc danh bạ UID.');}
 if(data.deskAudienceHistory){const a=data.deskAudienceHistory;a.enabled=false;a.completedAt=0;a.scan={enabled:false,done:false,coverage:'restored-needs-verification'};for(const j of a.jobs||[])if(j.state==='running')j.state='pending';}
 const desk=data.deskV2,bot=desk.bot;
 if(bot){
  bot.enabled=false;delete bot.runnerTabId;
  for(const j of bot.jobs||[]){
   j.token=crypto.randomUUID();
   if(['running','verifying'].includes(j.state)){
    j.state=j.submittedAt?'unknown':'failed';j.error='Lượt bị gián đoạn khi chuyển máy. Kiểm tra trước khi tiếp tục.';
    const post=desk.posts.find(p=>p.id===j.postId);if(post&&post.state!=='success')post.state=j.submittedAt?'unknown':'error';
   }
  }
 }
 const friends=data.friendDesk1;
 if(friends){friends.enabled=false;friends.pausedByUser=true;delete friends.scan;delete friends.active;
  for(const r of friends.rows||[])if(r.state==='queued'&&r.sentAt){r.state='uncertain';r.send='Chờ đối soát';}
 }
 return {...data,deskPersonaBinding:null,deskRunControl:{enabled:false,reason:'Đã nhập dữ liệu. Kiểm tra trước khi chạy.',at:Date.now()}};
}
