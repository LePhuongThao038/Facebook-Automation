const fields=['title','text','blocks','location','feeling','withPeople','time','comments','notes','missingVideo','contentSchema','sourceKind','sourcePostUrl','sourceCaption','sourceCaptionState','captionState','captionPartial','captionEvidence'];
function ordered(value){
 if(Array.isArray(value))return value.map(ordered);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,ordered(value[k])]));
 return value;
}
function equal(a,b){return JSON.stringify(ordered(a))===JSON.stringify(ordered(b));}
function docsImage(url){try{return new URL(url).hostname.endsWith('.googleusercontent.com')}catch{return false}}
async function digest(url){
 const r=await fetch(url,{credentials:'include',signal:AbortSignal.timeout(15000)});
 if(!r.ok||!r.headers.get('content-type')?.startsWith('image/'))throw Error('Không đọc được ảnh nguồn.');
 return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))).join('.');
}
export async function sourceChanges(base,next){
 const changes=fields.filter(k=>!equal(base[k]??'',next[k]??''));
 const old=base.media||[],media=next.media||[];
 let different=old.length!==media.length, uncertain=false;
 for(let i=0;!different&&i<media.length;i++){
  const a=old[i],b=media[i];
  if(a.type!==b.type||a.caption!==b.caption||!equal(a.manifest,b.manifest)){different=true;break}
  if(a.url===b.url)continue;
  if(!docsImage(a.url)||!docsImage(b.url)){different=true;break}
  try{const [left,right]=await Promise.all([digest(a.url),digest(b.url)]);different=left!==right}catch{uncertain=true}
 }
 if(different)changes.push('media');
 return {changes,uncertain};
}
