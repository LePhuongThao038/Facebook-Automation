const statusNames={draft:'Chờ duyệt',manually_recorded:'Bạn xác nhận đã gửi',uncertain:'Chưa rõ kết quả',skipped:'Đã bỏ qua'};
const roleNames={author:'Tác giả',male_friend:'Bạn nam',female_friend:'Bạn nữ',junior_male:'Đàn em nam',junior_female:'Đàn em nữ',senior_male:'Đàn anh',senior_female:'Đàn chị',colleague:'Đồng nghiệp'};
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
export function initCommentReviewUI(root,call){
 const panel=el('section',undefined,'panel comment-review');panel.id='comment-review';
 const heading=el('h2','Hàng chờ duyệt comment và reply');panel.append(heading,el('p','Đối chiếu từng lời thoại rồi tự gửi trên Facebook. FB Desk không điền ô soạn hoặc bấm gửi. Tiến trình tự lưu trong Chrome Profile này.'));
 const toolbar=el('div',undefined,'row'),reload=el('button','Tải lại'),loadSaved=el('button','Nạp bản nháp đã lưu'),save=el('button','Xuất sao lưu JSON'),fileLabel=el('label','Nhập kế hoạch / sao lưu JSON'),file=el('input');file.type='file';file.accept='.json,application/json';fileLabel.append(file);toolbar.append(reload,loadSaved,save,fileLabel);panel.append(toolbar);
 const filters=el('div',undefined,'two'),query=el('input'),status=el('select');query.placeholder='Tìm tên, UID, bài hoặc nội dung';query.setAttribute('aria-label','Lọc hàng chờ duyệt');for(const [v,t]of [['','Tất cả trạng thái'],...Object.entries(statusNames)])status.append(new Option(t,v));status.setAttribute('aria-label','Trạng thái duyệt');filters.append(query,status);panel.append(filters);
 const summary=el('p'),message=el('p'),cards=el('div');message.setAttribute('role','status');message.setAttribute('aria-live','polite');panel.append(summary,message,cards);
 const nav=el('div',undefined,'row'),previous=el('button','Trang trước'),pageLabel=el('span'),next=el('button','Trang sau');nav.append(previous,pageLabel,next);panel.append(nav);root.insertBefore(panel,root.children[1]||null);
 let view=null,page=0,busy=false;
 function notify(text,error=false){message.textContent=text;message.className=error?'persona-message error':'persona-message';}
 async function refresh(){view=await call('review-state');render();}
 function action(fn){return async e=>{if(busy)return;busy=true;panel.setAttribute('aria-busy','true');const button=e?.currentTarget;if(button?.tagName==='BUTTON')button.disabled=true;try{await fn();}catch(error){notify(error.message,true);}finally{busy=false;panel.removeAttribute('aria-busy');if(button?.tagName==='BUTTON'&&button.isConnected)button.disabled=false;}};}
 async function change(item,kind,data){await call('review-change',{key:item.key,action:kind,data,revision:view.queue.revision});await refresh();notify('Đã lưu vào profile này.');}
 function button(text,fn,disabled=false){const b=el('button',text);b.disabled=disabled;b.addEventListener('click',action(fn));return b;}
 function field(label,value){const wrap=el('label',label),input=el('input');input.value=value||'';wrap.append(input);return {wrap,input};}
 function render(){
  const all=view.queue.items,term=query.value.trim().toLocaleLowerCase('vi'),filtered=all.filter(i=>(!status.value||i.status===status.value)&&(!term||[i.actorName,i.actorUid,i.authorName,i.postId,i.role,i.text].some(v=>String(v).toLocaleLowerCase('vi').includes(term))));
  const pages=Math.max(1,Math.ceil(filtered.length/10));page=Math.min(page,pages-1);summary.textContent=all.length+' lượt · '+all.filter(i=>i.status==='manually_recorded').length+' bạn đã xác nhận gửi · '+all.filter(i=>i.status==='uncertain').length+' cần đối chiếu. Không tự đồng bộ giữa các profile.';cards.replaceChildren();
  if(!filtered.length)cards.append(el('p',all.length?'Không có lượt khớp bộ lọc.':'Nạp kế hoạch JSON đã có hoặc bản nháp lưu từ phiên bản cũ để bắt đầu.'));
  for(const item of filtered.slice(page*10,page*10+10)){
   const card=el('article',undefined,'review-card'),state=el('span',statusNames[item.status]||item.status,'chip');card.append(el('h3',item.actorName+' → '+item.authorName),state);
   card.append(el('p','Người thực hiện: '+item.actorUid+' · Chủ bài: '+item.authorUid),el('p',(item.kind==='reply'?'Reply':'Comment')+' · Vai: '+(roleNames[item.role]||item.role||'Chưa rõ')+' · Mã bài: '+item.postId));
   const source=el('details'),sourceTitle=el('summary','Caption và nguồn đối chiếu');source.append(sourceTitle,el('pre',item.caption||'Kế hoạch không chứa caption. Mở Docs và đối chiếu trực tiếp.'));source.append(el('p','Docs: '+(item.docsUrl||'Chưa có link Docs')));card.append(source);
   const text=el('textarea');text.readOnly=true;text.rows=3;text.value=item.text;text.setAttribute('aria-label','Nguyên văn nội dung '+item.stepId);card.append(text);
   const parent=all.find(i=>i.key===item.parentKey);if(item.parentKey){card.append(el('p','Comment cha: '+(parent?parent.actorName+' — '+parent.text:'Chưa tìm thấy')));if(parent?.receiptUrl)card.append(button('Mở comment cha',()=>call('review-open',{key:item.key,target:'parent'})));}
   const target=field('Permalink bài Facebook',item.postUrl);target.input.readOnly=Boolean(item.postUrl);card.append(target.wrap);if(!item.postUrl)card.append(button('Lưu permalink bài',()=>change(item,'target',{url:target.input.value.trim()})));
   const row=el('div',undefined,'row');row.append(button('Mở bài để đối chiếu / tự gửi',()=>call('review-open',{key:item.key,target:'post'}),!item.postUrl),button('Mở Docs',()=>call('review-open',{key:item.key,target:'docs'}),!item.docsUrl));card.append(row);
   const checks=view.checks[item.key]||{},finished=['manually_recorded','skipped'].includes(item.status);
   for(const [key,label]of [['actor','Tôi đã kiểm tra đúng tài khoản đang đăng nhập'],['target','Tôi đã đối chiếu đúng bài và chủ bài'],['source','Nội dung này khớp nguồn Docs đã kiểm tra'],['role','Vai đã gán và comment cha của reply là đúng']]){const l=el('label',undefined,'inline'),c=el('input');c.type='checkbox';c.checked=checks[key]===true;c.disabled=finished;c.addEventListener('change',action(()=>change(item,'checks',{...checks,[key]:c.checked})));l.append(c,document.createTextNode(label));card.append(l);}
   const issues=view.issues[item.key]||[];if(item.status==='draft'&&issues.length){const ul=el('ul');for(const issue of issues)ul.append(el('li',issue));card.append(ul);}
   card.append(button('Sao chép nội dung đã duyệt',async()=>{const {text}=await call('review-copy',{key:item.key});await navigator.clipboard.writeText(text);notify('Đã sao chép. Bạn tự dán và bấm Gửi trên Facebook.');},issues.length>0));
   if(item.receiptUrl){const result=el('p');result.append(el('strong','Bạn xác nhận đã gửi: '),document.createTextNode(item.receiptUrl));card.append(result,el('p','Liên kết do bạn ghi nhận; FB Desk chưa xác minh tác giả và nội dung trên Facebook.'));}
   else if(item.status!=='skipped'){
    const receipt=field('Sau khi tự gửi, dán link comment / reply để ghi nhận', '');card.append(receipt.wrap);
    if(item.status==='uncertain'){const confirm=el('label',undefined,'inline'),box=el('input');box.type='checkbox';confirm.append(box,document.createTextNode('Tôi đã kiểm tra trên Facebook và chắc chắn lượt này chưa gửi'));card.append(confirm,button('Mở lại để duyệt',()=>{if(!box.checked)throw Error('Kiểm tra chắc chắn chưa gửi trước khi mở lại.');return change(item,'reopen',{confirmedNotSent:true});}));}
    card.append(button(item.status==='uncertain'?'Ghi nhận link kết quả đã tìm thấy':'Ghi nhận link tôi đã gửi',()=>change(item,'receipt',{url:receipt.input.value.trim()}),issues.some(i=>!i.startsWith('Lượt đã được ghi nhận'))));
    if(item.status==='draft')card.append(button('Chưa rõ đã gửi hay chưa',()=>change(item,'uncertain',{})));
    card.append(button('Bỏ qua lượt này',()=>change(item,'skip',{})));
   }
   cards.append(card);
  }
  pageLabel.textContent='Trang '+(page+1)+' / '+pages+' · '+filtered.length+' lượt';previous.disabled=page===0;next.disabled=page>=pages-1;
 }
 reload.onclick=action(refresh);loadSaved.onclick=action(async()=>{const r=await call('review-load-saved',{revision:view.queue.revision});await refresh();notify('Đã thêm '+r.added+' lượt · '+r.existing+' lượt đã có, giữ nguyên lịch sử.');});
 file.onchange=action(async()=>{try{const f=file.files?.[0];if(!f)return;if(f.size>4*1024*1024)throw Error('File tối đa 4 MB.');const input=JSON.parse(await f.text());const r=await call('review-import',{input,revision:view.queue.revision});await refresh();notify('Đã thêm '+r.added+' lượt · '+r.existing+' lượt đã có · '+(r.updated||0)+' kết quả cập nhật. Giữ link đã ghi nhận và trạng thái chưa rõ; lượt nháp mới cần duyệt lại.');}finally{file.value='';}});
 save.onclick=action(async()=>{const data=await call('review-export'),url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=el('a');a.href=url;a.download='FB-Desk-3.8.4-hang-cho-duyet-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Đã xuất sao lưu, gồm link kết quả và các lượt chưa rõ. Khi nhập ở profile mới, lượt nháp cần duyệt lại.');});
 query.oninput=()=>{page=0;if(view)render();};status.onchange=query.oninput;previous.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};
 void refresh().catch(e=>notify(e.message,true));
}
