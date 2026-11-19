/* Runs in a Facebook profile tab, once per recipient. Only controls inside the
   target header or a post attributed to that profile may be used. */
export async function friendPage(action,p){
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const norm=v=>String(v||'').replace(/\s+/g,' ').trim().toLowerCase();
 const label=e=>(e.getAttribute('aria-label')||e.innerText||e.title||'').trim();
 const visible=e=>e?.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 const all=(sel,root=document)=>[...root.querySelectorAll(sel)].filter(visible);
 const buttons=(root=document)=>all('button,[role=button],[role=menuitem]',root);
 const btn=(root,re)=>buttons(root).find(e=>re.test(label(e)));
 function identity(href){try{const u=new URL(href);return u.pathname==='/profile.php'?u.searchParams.get('id'):u.pathname.match(/^\/people\/[^/]+\/(\d+)\/?$/i)?.[1]||u.pathname.replace(/^\/|\/$/g,'').toLowerCase();}catch{return '';}}
 const lease=async(type,extra={})=>{while(true){const reason=globalThis.deskRestriction?.();if(reason)throw Error(reason);const r=await chrome.runtime.sendMessage({type:'friends-'+type,token:p.token,...extra});if(!r?.ok)throw Error(r?.error||'Lượt thao tác đã dừng.');if(r.data?.waitMs){await sleep(Math.min(10000,r.data.waitMs));continue;}return r.data;}};
 try{
  if(action==='collect'){
   const main=document.querySelector('[role=main],main')||document.body;
   const result=new Set();
   for(let n=0;n<15;n++){for(const a of all('a[href]',main))if(a.closest('[role=listitem],li')||a.querySelector('img'))result.add(a.href);if(result.size>=p.limit*2)break;window.scrollBy(0,innerHeight);await sleep(350);}
   return {urls:[...result]};
  }
  const h=all('h1,h2,[role=heading]').find(e=>e.tagName==='H1'||e.getAttribute('aria-level')==='1');
  if(!h||/login|checkpoint/.test(location.pathname))throw Error('Không thấy tên trên trang cá nhân.');
  if(identity(location.href)!==p.target.id && ![...h.querySelectorAll('a[href]')].some(a=>identity(a.href)===p.target.id))throw Error('Không đối chiếu được profile đích sau khi chuyển trang.');
  const name=(h.innerText||'').split('\n')[0].trim();
  let header=h.parentElement;
  const add=/^(add friend|kết bạn|thêm bạn bè)$/i,pending=/^(cancel request|cancel friend request|hủy yêu cầu|hủy lời mời|đã gửi lời mời|request sent)$/i,friends=/^(friends|bạn bè)$/i;
  function relation(root){
   if(btn(root,pending))return 'pending';
   if(btn(root,add))return 'add';
   if(btn(root,friends))return 'friends';
   if(btn(root,/^(confirm|xác nhận)$/i))return 'incoming';
   return '';
  }
  while(header&&header!==document.body&&!relation(header)){
   if(header.querySelector('[role=article],article'))break;header=header.parentElement;
  }
  if(!header||header===document.body||header.querySelector('[role=article],article'))throw Error('Không xác định được nút kết bạn của đúng profile.');
  const before=relation(header);
  if(action==='scan'){
   const notices=all('[role=alert],[role=status]',header);
   if(notices.some(el=>/friend request (was |has been )?(declined|rejected)|lời mời kết bạn (đã )?bị từ chối/i.test(el.innerText)))return {name,relation:'rejected'};
   return {name,relation:before};
  }
  if(before==='incoming'&&p.acceptIncoming===true){
   const confirms=buttons(header).filter(e=>/^(confirm|xác nhận)$/i.test(label(e)));
   if(confirms.length!==1)throw Error('Không xác định duy nhất nút chấp nhận lời mời của clone đích.');
   await lease('progress',{name,stage:'Chuẩn bị nhận lời mời nội bộ'});
   await lease('permit',{name,warm:'Không cần'});
   if(!confirms[0].isConnected||relation(header)!=='incoming'||globalThis.deskRestriction?.())throw Error('Lời mời đã thay đổi trước khi chấp nhận.');
   confirms[0].click();for(let n=0;n<15;n++){await sleep(400);if(header.isConnected&&relation(header)==='friends')return {name,relation:'friends'};}
   return {name,relation:'uncertain'};
  }
  if(before!=='add')return {name,relation:before};
  await lease('progress',{name,stage:'Warm-up'});
  const log=[];
  const report=(stage,details=[])=>lease('progress',{name,stage,warm:[...log,...details].join(', ')});

  const like=async root=>{
   if(btn(root,/^(unlike|bỏ thích|gỡ thích)$/i))return true;
   const b=btn(root,/^(like|thích)$/i);if(!b)return false;await lease('guard',{paced:true});b.click();await sleep(400);return !!btn(root,/^(unlike|bỏ thích|gỡ thích)$/i)||b.getAttribute('aria-pressed')==='true';
  };
  async function photo(type){
   const re=type==='avatar'?/profile picture|profile photo|ảnh đại diện/i:/cover photo|ảnh bìa/i;
   let el=all('a[href],button,[role=button]',header).find(x=>re.test(label(x)||x.querySelector('img')?.alt||'')&&!/edit|chỉnh sửa/i.test(label(x)));
   if(!el)return false;
   const link=el.closest('a[href]')?.href;
   if(link){const u=new URL(link);if(u.origin===location.origin&&/^\/photo(?:\.php|\/)?$/.test(u.pathname)&&u.searchParams.has('fbid'))return lease('photo',{url:link});}
   await lease('guard');el.click();await sleep(700);
   const menuItem=all('[role=menuitem]').find(x=>/view profile picture|xem ảnh đại diện/i.test(label(x)));
   if(menuItem){menuItem.click();await sleep(700);}
   const dlg=all('[role=dialog]').at(-1);if(!dlg){if(identity(location.href)!==p.target.id)throw Error('Facebook chuyển sang trang ảnh riêng; cần kiểm tra.');return false;}
   const ok=await like(dlg);const close=btn(dlg,/^(close|đóng)$/i);if(!close)throw Error('Không đóng được ảnh đã mở.');close.click();await sleep(400);return ok;
  }
  if(p.warm!=='none'){
   if(p.warm==='light'){await report('Đang kiểm tra ảnh bìa');log.push('ảnh bìa '+(await photo('cover')?'✓':'—'));}
   await report('Đang kiểm tra ảnh đại diện');
   log.push('avatar '+(await photo('avatar')?'✓':'—'));
   if(p.warm==='light'){
    await report('Đang tìm nút Chọc');
    let poke=btn(header,/^(poke|chọc)$/i);
    if(!poke){const more=btn(header,/profile settings see more options|tùy chọn.*trang cá nhân|^more options$|^xem thêm tùy chọn$/i);
     if(more){more.click();await sleep(350);const menu=all('[role=menu]').at(-1);poke=menu&&btn(menu,/^(poke|chọc)$/i);if(!poke)more.click();}}
    if(poke){await lease('guard',{paced:true});poke.click();log.push('đã bấm Chọc');}else log.push('không thấy Chọc');
   }else{
    const max=p.warm==='deep'?10:5,seen=new Set();let likes=0,visited=0;
    const counts=()=>['Like '+likes+'/'+max];
    await report('Đang tìm bài của nick này',counts());
    for(let pass=0;pass<14&&visited<max;pass++){
     const roots=new Set(all('article,[role=article]'));
     for(const menu of buttons().filter(b=>/actions for this post|hành động.*bài viết/i.test(label(b)))){
      for(let r=menu.parentElement;r&&r!==document.body;r=r.parentElement){if(btn(r,/^(like|thích|unlike|bỏ thích)$/i)){if(![...roots].some(known=>known===r||known.contains(r)||r.contains(known)))roots.add(r);break;}}
     }
     for(const root of roots){
      if(seen.has(root)||visited>=max)continue;
      const author=all('h2 a[href],h3 a[href],h4 a[href],[role=heading] a[href]',root).find(a=>identity(a.href)===p.target.id);
      if(!author)continue;seen.add(root);visited++;
      await report('Đang kiểm tra lượt thích bài '+visited+'/'+max,counts());
      if(await like(root))likes++;
      await report('Đã xử lý bài '+visited+'/'+max,counts());
     }
     if(visited<max){window.scrollBy(0,innerHeight);await sleep(480);}
    }
    log.push('like '+likes+'/'+max);if(p.warm==='deep')log.push('comment: tự duyệt và gửi thủ công');
   }
  }
  const warm=log.join(', ')||'Không cần';
  await lease('progress',{name,warm,stage:'Chuẩn bị gửi'});
  if(!header.isConnected||relation(header)!=='add')throw Error('Trạng thái profile đã thay đổi trước khi gửi.');
  const send=btn(header,add);await lease('permit',{name,warm});if(!send?.isConnected||relation(header)!=='add'||globalThis.deskRestriction?.())throw Error('Trạng thái Facebook đã đổi trong khi chờ gửi.');send.click();
  for(let n=0;n<15;n++){await sleep(400);if(header.isConnected&&relation(header)==='pending')return {name,warm,relation:'sent'};}
  return {name,warm,relation:'uncertain'};
 }catch(e){return {error:String(e.message||e)};}
}
