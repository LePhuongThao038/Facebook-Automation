export const DEFAULT_SHEET='';
export function targetOf(value){
 const s=String(value||'').trim().replace(/^["']|["']$/g,'');
 if(/^\d{5,20}$/.test(s))return {id:s,url:'https://www.facebook.com/profile.php?id='+s};
 let u;try{u=new URL(/^((www|m)\.)?facebook\.com\//i.test(s)?'https://'+s:s);}catch{return null;}
 if(u.protocol!=='https:'||!['facebook.com','www.facebook.com','m.facebook.com'].includes(u.hostname)||u.username||u.password)return null;
 const people=u.pathname.match(/^\/people\/[^/]+\/(\d{5,20})\/?$/i);
 if(people)return targetOf(people[1]);
 if(u.pathname==='/profile.php')return /^\d{5,20}$/.test(u.searchParams.get('id')||'')?targetOf(u.searchParams.get('id')):null;
 const slug=u.pathname.match(/^\/([a-z\d.]+)\/?$/i)?.[1]?.toLowerCase();
 if(!slug||/^(groups|pages|friends|watch|reel|photo|stories|events|marketplace|login|share|permalink\.php|photo\.php|settings|notifications|help|gaming|messages|search|people|posts|videos|home\.php|me)$/.test(slug))return null;
 return {id:slug,url:'https://www.facebook.com/'+slug};
}
export function parseTargets(raw){
 const found=new Map();for(const token of String(raw).split(/[\s,;|]+/)){
  const item=targetOf(token);if(item)found.set(item.id,item);
 }return [...found.values()];
}
export function sheetId(value){const u=new URL(value);const id=u.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)?.[1];if(u.origin!=='https://docs.google.com'||!id)throw Error('Cần link Google Sheets hợp lệ.');return id;}
export function todayVN(ms){return new Date(ms+7*3600000).toISOString().slice(0,10);}
export function rowsFor(state,actor){return state.rows.filter(r=>r.actor.url===actor.url);}

export function parseNamedTargets(text){
 const rows=[];let row=[],value='',quoted=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;
  }else if(!quoted&&(ch===','||ch==='\n')){
   row.push(value.trim());value='';
   if(ch==='\n'){rows.push(row);row=[];}
  }else value+=ch;
 }
 row.push(value.trim());rows.push(row);
 const header=rows.findIndex(cols=>cols.some(c=>/^(uid|facebook uid|profile url)$/i.test(c)));
 if(header<0)return parseTargets(text);
 const id=rows[header].findIndex(c=>/^(uid|facebook uid|profile url)$/i.test(c));
 const name=rows[header].findIndex(c=>/^(tên|tên bạn|tên bạn bè|họ tên|name|facebook name)$/i.test(c));
 const result=new Map();
 for(const cols of rows.slice(header+1)){
  const target=targetOf(cols[id]);if(target)result.set(target.id,{...target,name:cols[name]||''});
 }
 return [...result.values()];
}
