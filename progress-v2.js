import {DEFAULT_INTERVAL_MINUTES} from './posting-plan.js';
import {imageSourceUrl} from './image-source.js';
export const columns=['format_version','record_type','post_id','source_key','source_url','source_post_url','post_number','caption','status','status_label','scheduled_at','published_at','post_url','media_json','comments_json','location','feeling','with_people','api_key','api_mode','api_model','api_protocol','api_base_url','api_json_mode','actor_uid','actor_url','actor_name','target_url','interval_minutes'];
const labels={success:'Đã đăng',unknown:'Cần đối soát',partial:'Đã đăng, thiếu bước',queued:'Chờ tự đăng',running:'Đang xử lý',verifying:'Đang tìm link',failed:'Chưa đăng / lỗi',error:'Chưa đăng / lỗi',draft:'Chờ chuẩn bị'};
function encode(value,index){let s=String(value??'');if(/^[=+@\-\t\r']/.test(s)||(columns[index]==='actor_uid'&&/^\d+$/.test(s)))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function progressRows(d,apiKey=''){
 const actor=d.bot?.actor||{};let uid='';try{uid=new URL(actor.url).searchParams.get('id')||'';}catch{}
 const rows=[{format_version:'facebook-desk/2',record_type:'profile',api_key:apiKey,api_mode:d.settings.mode,api_model:d.settings.model,api_protocol:d.settings.apiProtocol||'gemini',api_base_url:d.settings.apiBaseUrl||'https://generativelanguage.googleapis.com/v1beta',api_json_mode:d.settings.apiJsonMode?'1':'0',actor_uid:uid,actor_url:actor.url,actor_name:actor.name,target_url:d.settings.target,interval_minutes:d.bot?.intervalMinutes||DEFAULT_INTERVAL_MINUTES}];
 for(const p of d.posts){const jobs=(d.bot?.jobs||[]).filter(j=>j.postId===p.id),j=jobs.find(j=>j.state==='success')||jobs.at(-1),status=p.state==='success'||j?.state==='success'?'success':['queued','running','verifying','unknown','partial'].includes(j?.state)?j.state:p.state==='error'&&j?.state==='failed'?'failed':p.state||j?.state||'draft';
  rows.push({format_version:'facebook-desk/2',record_type:'post',post_id:p.id,source_key:p.sourceKey,source_url:p.sourceUrl,source_post_url:p.sourcePostUrl,post_number:p.number,caption:p.text,status,status_label:labels[status]||status,scheduled_at:j?.dueAt||p.schedule||'',published_at:j?.submittedAt||'',post_url:p.postUrl||j?.postUrl||'',media_json:JSON.stringify(p.media||[]),comments_json:JSON.stringify(p.comments||[]),location:p.location,feeling:p.feeling,with_people:p.withPeople});
 }
 return rows;
}
export function exportProgressV2(d,apiKey=''){const rows=progressRows(d,apiKey);return '\uFEFF'+[columns,...rows.map(r=>columns.map(c=>r[c]??''))].map(r=>r.map(encode).join(',')).join('\r\n');}
export function decodeV2(table){
 const header=table[0],objects=table.slice(1).map(row=>Object.fromEntries(header.map((h,i)=>[h,/^'[=+@\-\t\r']/.test(row[i]||'')||(h==='actor_uid'&&/^'\d+$/.test(row[i]||''))?row[i].slice(1):row[i]||''])));
 if(objects.some(r=>r.format_version!=='facebook-desk/2'))throw Error('CSV phiên bản mới không hợp lệ.');
 const profiles=objects.filter(r=>r.record_type==='profile');if(profiles.length>1)throw Error('CSV chỉ được có một dòng cấu hình.');
 const profile=profiles[0]||null,posts=[],rows=[];const ids=new Set();
 for(const r of objects.filter(r=>r.record_type==='post')){
  if(!r.post_id||ids.has(r.post_id))throw Error('CSV có mã bài trống hoặc trùng.');ids.add(r.post_id);
  let media,comments;try{media=JSON.parse(r.media_json||'[]');comments=JSON.parse(r.comments_json||'[]');}catch{throw Error('Media/bình luận trong CSV sai JSON.');}
  if(!Array.isArray(media)||!Array.isArray(comments)||media.some(m=>!['image','video'].includes(m.type)||typeof m.url!=='string'||(m.type==='image'?!imageSourceUrl(m.url):!m.url.startsWith('https://')))||comments.some(c=>typeof c!=='string'))throw Error('Media/bình luận trong CSV không hợp lệ.');
  const p={id:r.post_id,sourceKey:r.source_key,sourceUrl:r.source_url,sourcePostUrl:r.source_post_url,number:Number(r.post_number)||0,text:r.caption,title:r.caption.replace(/\s+/g,' ').slice(0,120)||'Bài '+r.post_number,contentSchema:2,sourceKind:media.find(m=>m.manifest)?.manifest.kind||'post',blocks:[{runs:[{text:r.caption}]}],media,comments,notes:[],state:'draft',time:Date.parse(r.scheduled_at)>Date.now()?r.scheduled_at:'',location:r.location,feeling:r.feeling,withPeople:r.with_people};posts.push(p);
  rows.push({title:p.title,postId:p.id,sourceKey:p.sourceKey,sourcePostUrl:p.sourcePostUrl,status:r.status_label||r.status,date:r.published_at||'',url:r.post_url,detail:'CSV v2',line:rows.length+2});
 }
 return {profile,posts,rows};
}
