import {REVIEW_KEY,candidates,finish} from './post-review-model.js';
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const panel=el('section');panel.className='panel';panel.id='manual-post-review';
panel.append(el('h2','Duyệt bài thủ công'),el('p','Chỉ chuẩn bị để bạn tự đăng. Không bật bot, không tự điền hoặc gửi trên Facebook. Bài đang chạy, đã đăng hoặc cần đối soát không được đưa vào đây.'));
const row=el('div');row.className='row';const select=el('select');select.setAttribute('aria-label','Khoảng cách duyệt bài');
for(const n of [3,5,10,15,60])select.append(new Option(n+' phút',String(n)));
const start=el('button','Bắt đầu duyệt'),stop=el('button','Dừng duyệt');row.append(el('span','Nhịp duyệt'),select,start,stop);panel.append(row);
const status=el('p'),card=el('div'),errors=el('details'),summary=el('summary','Bài lỗi / cần xử lý riêng'),errorList=el('div');status.setAttribute('role','status');errors.append(summary,errorList);panel.append(status,card,errors);
document.getElementById('scenario').prepend(panel);
let view={},db={},busy=false;const drafts=new Map();
async function mutate(fn){return navigator.locks.request(REVIEW_KEY,async()=>{const r=(await chrome.storage.local.get(REVIEW_KEY))[REVIEW_KEY]||{minutes:5,records:{}};await chrome.storage.local.set({[REVIEW_KEY]:fn(r)});});}
async function act(fn){if(busy)return;busy=true;try{await fn();await refresh();}catch(e){status.textContent='Chưa lưu được: '+e.message;}finally{busy=false;}}
select.onchange=()=>act(()=>mutate(r=>({...r,minutes:Number(select.value)})));
start.onclick=()=>act(()=>mutate(r=>({...r,running:true,nextAt:0})));
stop.onclick=()=>act(()=>mutate(r=>({...r,running:false})));
function button(text,fn){const b=el('button',text);b.type='button';b.onclick=()=>act(fn);return b;}
async function refresh(){const data=await chrome.storage.local.get(['deskV2',REVIEW_KEY]);db=data.deskV2||{};view=data[REVIEW_KEY]||{minutes:5,records:{}};select.value=String(view.minutes||5);render();}
function render(){
 const list=candidates(db,view);card.replaceChildren();errorList.replaceChildren();
 for(const [id,r]of Object.entries(view.records||{})){if(r.status==='error')errorList.append(el('p',(db.posts||[]).find(p=>p.id===id)?.title||id),el('small',r.note||'Bạn đã báo lỗi; không tự thử lại.'));}
 if(!view.running){status.textContent='Đã dừng duyệt · '+list.length+' bài có thể duyệt.';return;}
 const seconds=Math.max(0,Math.ceil(((view.nextAt||0)-Date.now())/1000));
 if(seconds){status.textContent='Bài tiếp theo sẵn sàng sau '+seconds+' giây. Bạn vẫn phải tự gửi.';return;}
 const p=list[0];if(!p){status.textContent='Đã hết bài có thể duyệt. Không thay đổi lịch tự đăng hoặc trạng thái nguồn.';return;}
 status.textContent=list.length+' bài còn lại · Đang duyệt Bài '+(p.number||'');
 const text=el('textarea');text.rows=5;text.value=drafts.has(p.id)?drafts.get(p.id):(p.text||'');text.oninput=()=>drafts.set(p.id,text.value);text.setAttribute('aria-label','Caption bản duyệt');
 card.append(el('h3',p.title||'Bài chỉ có media'),text,el('p',(p.media||[]).length+' tệp · Caption trống được chấp nhận khi có ảnh/video. Nội dung nguồn không bị xóa.'));
 if(p.captionPartial||p.captionState==='unreadable')card.append(el('p','Nguồn có thể thiếu caption. Bạn có thể giữ, sửa bản duyệt hoặc để trống; không tự tạo caption.'));
 for(const m of p.media||[]){try{const u=new URL(m.url);if(u.protocol!=='https:')continue;const a=el('a',m.type==='video'?'Mở video nguồn':'Mở ảnh nguồn');a.href=u.href;a.target='_blank';a.rel='noopener noreferrer';card.append(a,el('br'));}catch{}}
 card.append(button('Sao chép caption',()=>navigator.clipboard.writeText(text.value)),button('Tôi đã đăng — bài tiếp theo',async()=>{
 if(!text.value.trim()&&!(p.media||[]).some(m=>['image','video'].includes(m.type)))throw Error('Bài cần nội dung hoặc ảnh/video.');
 if(!confirm('Bạn đã tự gửi bài này trên Facebook? Đây chỉ là ghi nhận thủ công, không xác minh bài đã đăng.'))return;
 await mutate(r=>finish(r,p.id,'confirmed'));
 }),button('Bài lỗi — chuyển ngay',()=>mutate(r=>finish(r,p.id,'error',Date.now(),'Bạn đánh dấu lỗi trong hàng duyệt; không thử lại.'))));
}
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.deskV2||changes[REVIEW_KEY]))void refresh();});
// Tick only the countdown; never replace an editable caption during review.
setInterval(()=>{if(view.running&&(view.nextAt||0)>0){if(Date.now()>=view.nextAt){view.nextAt=0;render();}else status.textContent='Bài tiếp theo sẵn sàng sau '+Math.ceil((view.nextAt-Date.now())/1000)+' giây. Bạn vẫn phải tự gửi.';}},1000);
void refresh();
