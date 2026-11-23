// 3.8.7-story: giao diện vùng ĐĂNG STORY (tab 04). Tách khỏi danh sách bài viết; dữ liệu ở d.stories.
import {putStoryFile,deleteStoryFile} from './story-files.js';
const $=id=>document.getElementById(id);
const rpc=async(type,values={})=>{const r=await chrome.runtime.sendMessage({type,...values});if(!r?.ok)throw Error(r?.error||'Không phản hồi.');return r.data;};
const say=(id,text)=>{const el=$(id);if(el)el.textContent=text;};
const LABEL={queued:'Chờ tới giờ',running:'Đang đăng',verifying:'Đang chờ Facebook nhận',success:'Đã đăng',failed:'Lỗi',unknown:'Cần xác nhận',partial:'Cần xác nhận',cancelled:'Đã hủy'};
const time=v=>{const t=Date.parse(v);return Number.isFinite(t)?new Date(t).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'}):'';};
let view={stories:[],jobs:[]};const picked=new Set();
const latestJob=id=>view.jobs.filter(j=>j.postId===id&&!j.dryRun).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
const latestDry=id=>view.jobs.filter(j=>j.postId===id&&j.dryRun).sort((a,b)=>Date.parse(b.createdAt)-Date.parse(a.createdAt))[0];
const posted=id=>view.jobs.some(j=>j.postId===id&&!j.dryRun&&['success','verifying','unknown','partial'].includes(j.state));
const pending=id=>view.jobs.some(j=>j.postId===id&&['queued','running','verifying'].includes(j.state));
function cell(row,text){const td=document.createElement('td');td.textContent=text;row.append(td);return td;}
function button(td,text,fn,title=''){const b=document.createElement('button');b.type='button';b.textContent=text;if(title)b.title=title;b.onclick=()=>fn().then(refresh).catch(e=>say('st-status',e.message));td.append(b);return b;}
function render(){
 const body=$('st-list');body.replaceChildren();
 view.stories.forEach((s,i)=>{
  const tr=document.createElement('tr');const j=latestJob(s.id),dry=latestDry(s.id);
  const box=document.createElement('input');box.type='checkbox';box.checked=picked.has(s.id);box.disabled=posted(s.id)||pending(s.id);box.onchange=()=>{box.checked?picked.add(s.id):picked.delete(s.id);};
  const c0=document.createElement('td');c0.append(box);tr.append(c0);
  cell(tr,String(i+1));cell(tr,s.kind==='text'?'Chữ':s.kind==='video'?'Video':'Ảnh');
  cell(tr,s.kind==='text'?String(s.text).slice(0,80):(s.name||s.media?.[0]?.url||s.media?.[0]?.manifest?.sourceUrl||'')+(s.size?' · '+(s.size/1048576).toFixed(1)+' MB':''));
  let state=j?(LABEL[j.state]||j.state)+(j.state==='queued'?' · '+time(j.dueAt):j.finishedAt?' · '+time(j.finishedAt):''):'Chưa đăng';
  if(j?.error&&['failed','unknown','partial'].includes(j.state))state+=' · '+String(j.error).slice(0,160);
  if(dry&&(!j||Date.parse(dry.createdAt)>Date.parse(j.createdAt)))state+=' · Chạy thử: '+(dry.state==='cancelled'&&dry.verification?.dryRun?'đạt':(LABEL[dry.state]||dry.state)+(dry.error?' ('+String(dry.error).slice(0,120)+')':''));
  cell(tr,state);
  const act=document.createElement('td');tr.append(act);
  button(act,'↑',()=>rpc('story-move',{id:s.id,dir:-1}),'Lên trên');button(act,'↓',()=>rpc('story-move',{id:s.id,dir:1}),'Xuống dưới');
  if(!posted(s.id)&&!pending(s.id))button(act,'Chạy thử',()=>rpc('bot-story-schedule',{ids:[s.id],mode:'dry'}),'Làm tới trước nút Chia sẻ rồi bỏ bản nháp, không đăng');
  if(j?.state==='queued')button(act,'Hủy lịch',()=>rpc('bot-cancel',{jobId:j.id}));
  if(j&&['unknown','partial'].includes(j.state))button(act,'Đã thấy tin trên Facebook',()=>rpc('bot-story-confirm',{jobId:j.id}),'Chỉ bấm khi đã mở Facebook và thấy tin này');
  if(dry?.uiSnapshot)button(act,'Tải cấu trúc',async()=>{const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(dry.uiSnapshot,null,1)],{type:'application/json'}));a.download='story-ui-'+s.id.slice(0,8)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);});
  if(!pending(s.id))button(act,'Xóa',()=>rpc('story-remove',{id:s.id}).then(()=>picked.delete(s.id)));
  body.append(tr);
 });
 if(!view.stories.length){const tr=document.createElement('tr');const td=cell(tr,'Chưa có tin. Thêm ảnh, video, link hoặc tin chữ ở trên.');td.colSpan=6;body.append(tr);}
}
async function refresh(){view=await rpc('story-list');for(const id of [...picked])if(!view.stories.some(s=>s.id===id)||posted(id)||pending(id))picked.delete(id);render();}
$('st-files').onchange=async e=>{
 const files=[...e.target.files];e.target.value='';if(!files.length)return;const ids=[];
 try{say('st-feedback','Đang lưu '+files.length+' tệp…');for(const f of files)ids.push((await putStoryFile(f)).id);
  const added=await rpc('story-add',{items:ids.map(fileId=>({fileId}))});say('st-feedback','Đã thêm '+added.length+' tin.');}
 catch(error){for(const id of ids)await deleteStoryFile(id).catch(()=>{});say('st-feedback',error.message);}
 refresh().catch(()=>{});
};
$('st-add-links').onclick=()=>{const links=$('st-links').value.split(/\s+/).map(x=>x.trim()).filter(Boolean);if(!links.length)return say('st-feedback','Dán ít nhất một link.');rpc('story-add',{items:links.map(link=>({link}))}).then(a=>{$('st-links').value='';say('st-feedback','Đã thêm '+a.length+' tin từ link.');return refresh();}).catch(e=>say('st-feedback',e.message));};
$('st-add-text').onclick=()=>{const text=$('st-text').value.trim();if(!text)return say('st-feedback','Nhập nội dung tin chữ.');rpc('story-add',{items:[{kind:'text',text}]}).then(()=>{$('st-text').value='';say('st-feedback','Đã thêm tin chữ.');return refresh();}).catch(e=>say('st-feedback',e.message));};
$('st-all').onclick=()=>{for(const s of view.stories)if(!posted(s.id)&&!pending(s.id))picked.add(s.id);render();};
$('st-none').onclick=()=>{picked.clear();render();};
const chosen=()=>view.stories.filter(s=>picked.has(s.id)).map(s=>s.id);
const gap=()=>Number($('st-gap').value);
$('st-schedule').onclick=()=>{const ids=chosen();if(!ids.length)return say('st-status','Tick ít nhất một tin.');const v=$('st-start').value;if(!v)return say('st-status','Chọn giờ bắt đầu.');rpc('bot-story-schedule',{ids,mode:'schedule',startAt:new Date(v).toISOString(),intervalMinutes:gap(),jitterSeconds:Number($('st-jitter').value)||0}).then(j=>{picked.clear();say('st-status','Đã xếp lịch '+j.length+' tin, tin đầu lúc '+time(j[0].dueAt)+'.');return refresh();}).catch(e=>say('st-status',e.message));};
$('st-now').onclick=()=>{const ids=chosen();if(!ids.length)return say('st-status','Tick ít nhất một tin.');rpc('bot-story-schedule',{ids,mode:'now',intervalMinutes:gap(),jitterSeconds:Number($('st-jitter').value)||0}).then(j=>{picked.clear();say('st-status','Đã đưa '+j.length+' tin vào hàng chờ, bắt đầu ngay.');return refresh();}).catch(e=>say('st-status',e.message));};
$('tab-stories').addEventListener('click',()=>refresh().catch(e=>say('st-status',e.message)));
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.deskV2&&!$('stories').hidden)refresh().catch(()=>{});});
