// Trang Hồ sơ khách hàng. Dữ liệu lưu tại máy (chrome.storage.local, khóa customerProfiles), không gửi đi đâu.
const $=id=>document.getElementById(id),sleep=ms=>new Promise(r=>setTimeout(r,ms));
const M=globalThis.customerModel,STORE='customerProfiles';
let current=null;
const say=t=>{$('status').textContent=t;};
const fbProfile=value=>{let u;try{u=new URL(String(value||'').trim());}catch{throw Error('Dán link trang cá nhân Facebook (https://www.facebook.com/…).');}
 if(u.protocol!=='https:'||!/^(www\.|m\.)?facebook\.com$/.test(u.hostname))throw Error('Chỉ nhận link trang cá nhân trên facebook.com.');
 u.hostname='www.facebook.com';u.hash='';
 if(u.pathname==='/profile.php'){const id=u.searchParams.get('id');if(!/^\d+$/.test(id||''))throw Error('Link profile.php cần có id.');return 'https://www.facebook.com/profile.php?id='+id;}
 const p=u.pathname.replace(/\/+$/,'');if(!/^\/[\w.\-]+$/.test(p)||/^\/(groups|pages|watch|reel|marketplace|events|photo|permalink\.php|story\.php|share)$/i.test(p))throw Error('Đây không phải link trang cá nhân.');return 'https://www.facebook.com'+p;};
const keyOf=url=>{const u=new URL(url);return u.pathname==='/profile.php'?'id:'+u.searchParams.get('id'):u.pathname.toLowerCase();};
async function loadAll(){return (await chrome.storage.local.get(STORE))[STORE]||{};}
async function saveAll(all){await chrome.storage.local.set({[STORE]:all});}

// ---- Đọc trang (tab Facebook mở ở chế độ hiện, vì dòng thời gian chỉ tải khi tab đang hiện) ----
async function settle(tab,url){if(url)await chrome.tabs.update(tab,{url});for(let i=0;i<40;i++){await sleep(400);const t=await chrome.tabs.get(tab).catch(()=>null);if(!t)throw Error('Tab Facebook đã bị đóng.');if(t.status==='complete'&&t.url&&!t.pendingUrl)break;}await sleep(1800);}
const run=async(tab,func,args=[])=>{const [r]=await chrome.scripting.executeScript({target:{tabId:tab},func,args});return r?.result;};
async function analyze(){
 const url=fbProfile($('url').value);$('url').value=url;
 const home=await chrome.tabs.getCurrent();let tab;
 $('analyze').disabled=true;
 try{
  say('Đang mở trang cá nhân…');tab=(await chrome.tabs.create({url,active:true})).id;await settle(tab);
  const t=await chrome.tabs.get(tab);if(/login|checkpoint/.test(t.url))throw Error('Chrome Profile này chưa đăng nhập Facebook hoặc đang bị kiểm tra.');
  say('Đang đọc đầu trang…');const header=await run(tab,customerReadHeader);
  say('Đang đọc các bài công khai gần đây (cuộn dòng thời gian, khoảng 30 giây)…');const posts=await run(tab,customerReadPosts,[25,20])||[];
  say('Đang đọc trang Giới thiệu…');const about=[];
  const start=new URL(url);if(start.pathname==='/profile.php')start.searchParams.set('sk','about');else start.pathname+='/about';
  await settle(tab,start.href);let first=null;for(let i=0;i<5&&!first?.tabs?.length;i++){first=await run(tab,readAboutPanel);if(!first?.tabs?.length)await sleep(700);}
  const seen=new Set;for(const sub of first?.tabs||[]){if(seen.has(sub.href))continue;seen.add(sub.href);say('Đang đọc Giới thiệu › '+sub.name+'…');await settle(tab,sub.href);let r=null;for(let i=0;i<3;i++){r=await run(tab,readAboutPanel);if(r?.sections?.length||r?.links?.length)break;await sleep(600);}if(r&&(r.sections.length||r.links.length))about.push({tab:sub.name,sections:r.sections,links:r.links});}
  const prev=(await loadAll())[keyOf(url)];
  current=M.buildProfile({id:prev?.id,url,name:header?.name||prev?.name||'',header,posts,about,productKeywords:$('product').value,external:prev?.external});
  current.manual=prev?.manual||{};current.notes=prev?.notes||'';
  say('Xong: đọc '+posts.length+' bài, '+about.length+' mục Giới thiệu. Kiểm tra rồi bấm "Lưu hồ sơ".');render();
 }finally{$('analyze').disabled=false;if(tab)await chrome.tabs.remove(tab).catch(()=>{});if(home?.id)await chrome.tabs.update(home.id,{active:true}).catch(()=>{});}
}

// ---- Vẽ ----
const allAxes=()=>[...M.AXES,...M.EXTERNAL_AXES];
function drawRadar(){
 const c=$('radar'),size=480,dpr=devicePixelRatio||1;c.width=size*dpr;c.height=size*dpr;c.style.width=size+'px';c.style.height=size+'px';
 const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);g.clearRect(0,0,size,size);
 const axes=allAxes(),cx=size/2,cy=size/2,R=150,step=Math.PI*2/axes.length,ang=i=>i*step-Math.PI/2;
 g.beginPath();g.arc(cx,cy,R+10,0,Math.PI*2);g.strokeStyle='rgba(212,175,55,.2)';g.lineWidth=1;g.stroke();
 for(let l=1;l<=5;l++){const r=R/5*l;g.beginPath();axes.forEach((_,i)=>{const x=cx+Math.cos(ang(i))*r,y=cy+Math.sin(ang(i))*r;i?g.lineTo(x,y):g.moveTo(x,y);});g.closePath();g.strokeStyle=l===5?'rgba(212,175,55,.55)':'rgba(212,175,55,.18)';g.lineWidth=l===5?1.5:1;g.stroke();}
 const vals=axes.map(a=>M.axisValue(current,a.id));
 axes.forEach((a,i)=>{const ex=cx+Math.cos(ang(i))*R,ey=cy+Math.sin(ang(i))*R;g.beginPath();g.moveTo(cx,cy);g.lineTo(ex,ey);g.strokeStyle='rgba(212,175,55,.22)';g.stroke();
  const lx=cx+Math.cos(ang(i))*(R+38),ly=cy+Math.sin(ang(i))*(R+38);g.textAlign='center';g.textBaseline='middle';
  g.font='bold 13px "Segoe UI",sans-serif';g.fillStyle=vals[i].score==null?'#7d745f':'#f3e9d2';
  const words=a.label.split(' '),half=Math.ceil(words.length/2),lines=a.label.length>14?[words.slice(0,half).join(' '),words.slice(half).join(' ')]:[a.label];
  lines.forEach((t,k)=>g.fillText(t,lx,ly+(k-(lines.length-1)/2)*15));
  g.font='11px "Segoe UI",sans-serif';g.fillStyle=vals[i].score==null?'#7d745f':'#d4af37';g.fillText(vals[i].score==null?'(chưa có)':'('+vals[i].score+(vals[i].manual?' ✎':'')+')',lx,ly+lines.length*8+8);});
 const pts=vals.map((v,i)=>({x:cx+Math.cos(ang(i))*(v.score??0)/100*R,y:cy+Math.sin(ang(i))*(v.score??0)/100*R,none:v.score==null}));
 g.beginPath();pts.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fillStyle='rgba(201,42,42,.38)';g.fill();g.strokeStyle='#ff4d4d';g.lineWidth=2.2;g.stroke();
 pts.forEach(p=>{g.beginPath();g.arc(p.x,p.y,4.5,0,Math.PI*2);if(p.none){g.strokeStyle='#7d745f';g.lineWidth=1.5;g.stroke();}else{g.fillStyle='#ffd43b';g.fill();g.strokeStyle='#c92a2a';g.lineWidth=1.5;g.stroke();}});
}
const el=(tag,props={},kids=[])=>{const e=document.createElement(tag);Object.assign(e,props);for(const k of [].concat(kids))if(k!=null)e.append(k);return e;};
function render(){
 if(!current){$('result').hidden=true;return;}
 $('result').hidden=false;$('name').textContent=current.name||'(chưa đọc được tên)';$('link').href=current.url;$('link').textContent=current.url;
 $('meta').textContent='Phân tích lúc '+new Date(current.analyzedAt).toLocaleString('vi-VN')+' · '+current.postsRead+' bài công khai'+(current.productKeywords?' · từ khóa: '+current.productKeywords:'');
 $('notes').value=current.notes||'';
 const demo=$('demo');demo.replaceChildren(...(current.demographics.length?current.demographics.map(d=>el('div',{className:'chip'+(d.estimate?' est':'')},[el('b',{textContent:d.label}),el('span',{textContent:d.value}),el('small',{textContent:(d.estimate?'Ước tính · ':'')+d.source})])):[el('p',{className:'muted',textContent:'Trang không công khai thông tin nhân khẩu nào.'})]));
 const sl=$('sliders');sl.replaceChildren();
 for(const a of allAxes()){const ext=M.EXTERNAL_AXES.includes(a),v=M.axisValue(current,a.id),auto=(current.axes[a.id]||current.external?.[a.id])?.score??null;
  const input=el('input',{type:'range',min:0,max:100,value:v.score??0,disabled:ext&&auto==null,ariaLabel:a.label});
  const val=el('b',{textContent:v.score==null?'—':String(v.score)});
  const reset=el('button',{type:'button',textContent:'↺',title:'Về điểm tự động ('+(auto??'chưa có')+')',hidden:!v.manual});
  input.oninput=()=>{current.manual[a.id]={score:+input.value,at:new Date().toISOString()};val.textContent=input.value;reset.hidden=false;drawRadar();};
  reset.onclick=()=>{delete current.manual[a.id];render();};
  sl.append(el('div',{className:'slider'},[el('div',{className:'head'},[el('span',{textContent:a.label}),el('span',{className:'tag',textContent:ext?'trục 8 · '+(auto==null?'chờ agent khác':'đã nạp'):v.manual?'chỉnh tay':(current.axes[a.id]?.confidence?'tin cậy: '+current.axes[a.id].confidence:'')}),reset,val]),input]));}
 const box=$('axes');box.replaceChildren();
 for(const a of allAxes()){const r=current.axes[a.id]||current.external?.[a.id]||{},v=M.axisValue(current,a.id);
  const ev=(r.evidence||[]).map(e=>el('li',{},[el('span',{textContent:e.text}),' ',el('span',{className:'why',textContent:'('+e.why+')'})]));
  box.append(el('details',{className:'axis'},[el('summary',{},[el('span',{textContent:a.label}),el('b',{textContent:v.score==null?'chưa có':v.score+(v.manual?' (chỉnh tay; tự động: '+(r.score??'—')+')':'')})]),
   el('p',{textContent:'Định nghĩa: '+a.definition}),a.low?el('p',{className:'muted',textContent:'Thấp: '+a.low}):null,a.high?el('p',{className:'muted',textContent:'Cao: '+a.high}):null,
   r.note?el('p',{className:'muted',textContent:r.note}):null,ev.length?el('ul',{},ev):null,M.EXTERNAL_AXES.includes(a)?el('p',{className:'muted',textContent:'Trục do '+a.owner+' cung cấp; nạp bằng nút "Nạp trục 8 (JSON)".'}):null]));}
 drawRadar();
}
async function renderSaved(){
 const all=await loadAll(),q=M.fold($('search').value);const list=$('savedList');list.replaceChildren();
 const items=Object.values(all).filter(p=>!q||M.fold(p.name).includes(q)).sort((a,b)=>Date.parse(b.analyzedAt)-Date.parse(a.analyzedAt));
 for(const p of items){const li=el('li',{},[el('span',{textContent:p.name||p.url}),el('small',{textContent:new Date(p.analyzedAt).toLocaleDateString('vi-VN')+' · '+p.postsRead+' bài'})]);li.setAttribute('aria-current',String(current?.id===p.id));li.onclick=()=>{current=structuredClone(p);$('url').value=p.url;$('product').value=p.productKeywords||'';say('');render();renderSaved();};list.append(li);}
 if(!items.length)list.append(el('li',{className:'muted',textContent:'Chưa có hồ sơ.'}));
}
const download=(name,data)=>{const a=el('a',{href:URL.createObjectURL(new Blob([JSON.stringify(data,null,1)],{type:'application/json'})),download:name});a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000);};
$('analyze').onclick=()=>analyze().then(renderSaved).catch(e=>say(e.message));
$('url').onkeydown=e=>{if(e.key==='Enter')$('analyze').click();};
$('notes').oninput=()=>{if(current)current.notes=$('notes').value.slice(0,3000);};
$('save').onclick=async()=>{if(!current)return;const all=await loadAll();all[keyOf(current.url)]=current;await saveAll(all);say('Đã lưu hồ sơ.');renderSaved();};
$('remove').onclick=async()=>{if(!current||!confirm('Xóa hồ sơ của '+(current.name||current.url)+' khỏi máy này?'))return;const all=await loadAll();delete all[keyOf(current.url)];await saveAll(all);current=null;render();renderSaved();say('Đã xóa hồ sơ.');};
$('exportOne').onclick=()=>{if(current)download('ho-so-'+keyOf(current.url).replace(/[^\w]+/g,'-')+'.json',current);};
$('exportAll').onclick=async()=>download('ho-so-khach-hang.json',Object.values(await loadAll()));
$('importAxis').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f||!current)return;try{current=M.mergeExternal(current,JSON.parse(await f.text()));render();say('Đã nạp trục 8. Bấm "Lưu hồ sơ" để giữ.');}catch(err){say(err.message);}};
$('search').oninput=renderSaved;
renderSaved();
