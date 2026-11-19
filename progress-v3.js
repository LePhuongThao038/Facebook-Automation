import {progressRows,columns as oldColumns,decodeV2} from './progress-v2.js';
export const fields=[
 ['row_number','STT'],['caption','Nội dung đăng'],['caption_label','Tình trạng caption'],['status_label','Tiến độ bài'],['last_error','Lỗi gần nhất'],['published_label','Đã đăng?'],['post_url','Link bài đã đăng'],['source_post_url','Bài Facebook nguồn'],['scheduled_label','Giờ dự kiến (VN)'],['image_count','Số ảnh'],['video_count','Số video'],['comment_count','Số bình luận'],['actor_uid','UID đăng bài'],['source_caption','Caption gốc'],['source_caption_label','Caption nguồn'],['import_action','Xử lý khi nhập'],
 ['post_id','Mã bài'],['source_key','Mã nguồn Docs'],['source_url','Link Docs'],['post_number','Số bài trong Docs'],['status','Mã trạng thái'],['restored_from_status','Trạng thái trước khi khôi phục'],['caption_state','Mã caption'],['source_caption_state','Mã caption nguồn'],['caption_partial','Caption chưa đủ?'],['caption_evidence','Căn cứ đọc caption'],['caption_backup','Bản dự phòng nội dung'],['caption_sha256','Mã kiểm tra nội dung'],['source_caption_sha256','Mã kiểm tra caption gốc'],['media_json','Dữ liệu media (JSON)'],['comments_json','Dữ liệu bình luận (JSON)'],['location','Địa điểm'],['feeling','Cảm xúc'],['with_people','Gắn thẻ'],['scheduled_at','Giờ dự kiến (ISO)'],['published_at','Giờ gửi (ISO)'],['api_protocol','Kiểu API'],['api_base_url','Địa chỉ API'],['api_json_mode','JSON mode'],['api_mode','Chế độ AI'],['api_model','Model'],['api_key','API key (bản sao riêng)'],['actor_url','Link tài khoản'],['actor_name','Tên tài khoản'],['target_url','Nơi đăng'],['interval_minutes','Khoảng cách (phút)'],['record_type','Loại dòng'],['format_version','Phiên bản dữ liệu']
];
const captionLabels={present:'Có caption',no_caption:'Không có caption (đã kiểm tra)',unreadable:'Chưa đọc được — không coi là bài trống',empty_after_cleanup:'Caption chỉ còn hashtag đã bỏ'};
const publishedCodes=new Set(['success','unknown','partial']);
const validStates=new Set(['success','unknown','partial','queued','running','verifying','failed','error','draft','scheduled','prepared','cancelled']);
const localTime=value=>{const date=new Date(value);return value&&Number.isFinite(date.getTime())?new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'}).format(date):'';};
const sha=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join('');
function encode(value,index){let s=String(value??'');if(/^[=+@\-\t\r']/.test(s)||(fields[index][0]==='actor_uid'&&/^\d+$/.test(s)))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export async function exportProgressV3(d,apiKey=''){
 const base=progressRows(d,apiKey),profile=base.find(r=>r.record_type==='profile'),posts=base.filter(r=>r.record_type==='post'),byId=new Map(d.posts.map(p=>[p.id,p]));
 let index=0;for(const row of posts){const p=byId.get(row.post_id),text=String(row.caption||''),source=typeof p.sourceCaption==='string'?p.sourceCaption:text;
  const sourceState=source.trim()?'present':p.sourceCaptionState==='no_caption'?'no_caption':'unreadable';
  const captionState=text.trim()?'present':p.captionState||((p.sourceCaptionState==='no_caption')?'no_caption':'unreadable'),published=publishedCodes.has(row.status);
  Object.assign(row,{format_version:'facebook-desk/3',row_number:++index,restored_from_status:p.csvOriginalStatus||p.csvPreviousStatus||'',last_error:published?'':([...(d.bot?.jobs||[])].reverse().find(j=>j.postId===p.id)?.error||p.csvLastError||''),scheduled_label:localTime(row.scheduled_at),status_label:row.status==='unknown'?'Đã đăng (tự xác nhận theo quy tắc)':row.status==='partial'?'Đã đăng (còn bước phụ)':row.status_label,caption_state:captionState,caption_label:p.captionPartial?'Có chữ nhưng còn rút gọn — chưa chạy':captionLabels[captionState],source_caption:source,source_caption_state:sourceState,source_caption_label:captionLabels[sourceState],caption_partial:p.captionPartial?'1':'0',caption_evidence:p.captionEvidence||'',caption_backup:text,caption_sha256:await sha(text),source_caption_sha256:await sha(source),published_label:published?'Có — tự xác nhận':'Chưa đăng',import_action:published?'Tự đánh dấu đã đăng, không đăng lại':captionState==='unreadable'||p.captionPartial?'Giữ để đọc lại caption, chưa chạy':'Khôi phục tiến độ, chờ chạy tiếp',image_count:(p.media||[]).filter(m=>m.type==='image').length,video_count:(p.media||[]).filter(m=>m.type==='video').length,comment_count:(p.comments||[]).length,actor_uid:profile.actor_uid,actor_name:profile.actor_name,actor_url:profile.actor_url});
 }
 Object.assign(profile,{format_version:'facebook-desk/3',caption:'CẤU HÌNH BẢN SAO — không phải bài đăng',status_label:'Cấu hình dùng khi khôi phục',import_action:'Hỏi dùng tiếp API/UID hoặc thay cấu hình khác'});
 return '\uFEFF'+[fields.map(([id,label])=>label+' | '+id),...[...posts,profile].map(r=>fields.map(([id])=>r[id]??''))].map(r=>r.map(encode).join(',')).join('\r\n');
}
export function normalizedHeaders(table){const header=table[0].map(h=>h.includes('|')?h.slice(h.lastIndexOf('|')+1).trim():h.trim());if(new Set(header).size!==header.length)throw Error('CSV trùng mã cột.');return [header,...table.slice(1)];}
export function decodeV3(input){
 const table=normalizedHeaders(input),header=table[0],objects=table.slice(1).map(row=>Object.fromEntries(header.map((h,i)=>{let v=row[i]||'';if(/^'[=+@\-\t\r']/.test(v)||(h==='actor_uid'&&/^'\d+$/.test(v)))v=v.slice(1);return [h,v];})));
 for(const [field] of fields)if(!['api_protocol','api_base_url','api_json_mode'].includes(field)&&!header.includes(field))throw Error('CSV v3 thiếu cột '+field);
 if(objects.some(r=>r.format_version!=='facebook-desk/3'))throw Error('Phiên bản CSV không thống nhất.');
 if(objects.some(r=>!['post','profile'].includes(r.record_type)))throw Error('CSV có dòng không xác định loại dữ liệu.');
 const records=objects.filter(r=>r.record_type==='post');for(const r of records){if(!validStates.has(r.status))throw Error('Mã trạng thái không hợp lệ ở bài '+r.post_id);if(!['present','no_caption','unreadable'].includes(r.source_caption_state)||!['0','1'].includes(r.caption_partial))throw Error('Mã phân loại caption không hợp lệ ở bài '+r.post_id);if(r.caption_state==='no_caption'&&r.source_caption_state!=='no_caption')throw Error('Thiếu xác nhận bài nguồn không caption ở bài '+r.post_id);if(!Object.hasOwn(captionLabels,r.caption_state))throw Error('Trạng thái caption không hợp lệ ở bài '+r.post_id);}
 const v2table=[oldColumns,...objects.map(r=>oldColumns.map(c=>{let v=c==='format_version'?'facebook-desk/2':r[c]||'';if(c==='status_label'&&r.record_type==='post')v=({success:'Đã đăng',unknown:'Cần đối soát',partial:'Đã đăng, thiếu bước'})[r.status]||r.status;return /^[=+@\-\t\r']/.test(v)?"'"+v:v;}))];
 // decodeV2 expects its own escaped table; headers remain the canonical machine keys.
 const parsed=decodeV2(v2table);parsed.integrity=[];
 for(const r of records){const p=parsed.posts.find(p=>p.id===r.post_id);Object.assign(p,{sourceCaption:r.source_caption,sourceCaptionState:r.source_caption_state,captionState:r.caption_state,captionPartial:r.caption_partial==='1',captionEvidence:r.caption_evidence,csvOriginalStatus:r.status,csvPreviousStatus:r.restored_from_status||'',csvLastError:r.last_error||''});
  if(Number(r.image_count)!==p.media.filter(m=>m.type==='image').length||Number(r.video_count)!==p.media.filter(m=>m.type==='video').length||Number(r.comment_count)!==p.comments.length)throw Error('Số media/bình luận không khớp dữ liệu ở bài '+p.id);
  parsed.integrity.push({postId:p.id,caption:r.caption,backup:r.caption_backup,captionHash:r.caption_sha256,sourceCaption:r.source_caption,sourceHash:r.source_caption_sha256});
 }
 parsed.version=3;return parsed;
}
export async function verifyCSVIntegrity(parsed){
 for(const item of parsed.integrity||[]){
  if(!/^[a-f0-9]{64}$/.test(item.captionHash)||! /^[a-f0-9]{64}$/.test(item.sourceHash))throw Error('Thiếu mã kiểm tra caption ở bài '+item.postId);
  if(await sha(item.sourceCaption)!==item.sourceHash)throw Error('Caption gốc bị thay đổi/hỏng ở bài '+item.postId+'. Không nhập âm thầm.');
  let text=item.caption;
  let repaired=false;if(await sha(text)!==item.captionHash){if(await sha(item.backup)===item.captionHash){text=item.backup;repaired=true;}else throw Error('Cả nội dung và bản dự phòng bị hỏng ở bài '+item.postId+'. Chưa nhập dữ liệu.');}
  const p=parsed.posts.find(p=>p.id===item.postId);p.text=text;p.blocks=[{runs:[{text}]}];p.title=text.replace(/\s+/g,' ').slice(0,120)||'Bài '+p.number;
  if(repaired){p.captionRestoredFromBackup=true;parsed.repairedCaptions=(parsed.repairedCaptions||0)+1;}
  if(p.captionState==='present'&&!text.trim())throw Error('CSV ghi có caption nhưng nội dung trống ở bài '+p.id);
  if(p.captionState==='no_caption'&&(text.trim()||p.sourceCaption.trim()))throw Error('CSV ghi không caption nhưng vẫn có chữ ở bài '+p.id);
  const row=parsed.rows.find(r=>r.postId===p.id);row.title=p.title;row.captionState=p.captionState;row.originalStatus=p.csvOriginalStatus;
 }
 return parsed;
}
