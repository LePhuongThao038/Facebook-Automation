export function assertFixedRoster(old,next,mappings={}){
 if(!old)return;const ids=new Set(),pairs=new Set();
 for(const [key,actor]of Object.entries(mappings)){const author=key.split(':vai:')[0];ids.add(author);ids.add(actor);pairs.add(actor+':'+author);pairs.add(author+':'+actor);}
 for(const p of old.profiles||[])if(ids.has(p.id)&&p.uid&&p.uid!==next.profiles.find(v=>v.id===p.id)?.uid)throw Error('UID của '+p.alias+' đã khóa với vai cố định; không được tự tráo UID.');
 for(const relation of old.relations||[])if(pairs.has(relation.from+':'+relation.to)){const after=next.relations.find(v=>v.from===relation.from&&v.to===relation.to);if(!after||['role','self','other'].some(k=>after[k]!==relation[k]))throw Error('Quan hệ và xưng hô đã khóa giữa hai clone; không đổi hoặc xóa vai qua các bài.');}
}
