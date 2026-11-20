const fm='application/vnd.google-apps.folder',dm='application/vnd.google-apps.document';
function clipboardPackage(items,c=null){
  const body=document.createElement('div'),plain=[];
  function line(tag,value,parent=body){
    const el=document.createElement(tag);
    el.textContent=value;
    parent.append(el);
    return el;
  }
  function paragraph(value,depth=0){
    const p=line('p','');
    if(depth)p.style.marginLeft=(depth*18)+'pt';
    String(value).split(/\r?\n/).forEach((part,index)=>{
      if(index)p.append(document.createElement('br'));
      p.append(document.createTextNode(part));
    });
    plain.push('  '.repeat(depth)+value);
  }
  function link(label,url){
    if(!url||!/^https:\/\//i.test(url))return;
    line('a',label,line('p','')).href=url;
    plain.push(label+' '+url);
  }
  function heading(value){line('h1',value);plain.push(value)}
  if(c){heading('Thông tin nhân vật');for(const x of characterRows(c)){if(x.im){let img=line('img','',line('p',''));img.src=x.im.src;img.width=Math.min(320,x.im.w);plain.push(x.im.src)}else if(x.url)link(x.t,x.url);else paragraph(x.t)}line('hr','').style.breakAfter='page'}
  for(const x of researchLines(items)){
    if(x.im){const pic=x.im;if(!pic.src?.startsWith('https://'))continue;const img=line('img','',line('p',''));img.src=pic.src;img.alt='Ảnh bài đăng';img.width=Math.max(1,Math.min(560,pic.w||560));plain.push(img.alt+' '+pic.src);}
    else if(x.h)heading(x.t);else if(x.url)link(x.t,x.url);else paragraph(x.t,x.depth||0);
  }
  heading('Mục lục bài gốc');
  items.forEach((p,i)=>link('Nguồn bài '+(i+1),p.url));
  return {'text/html':new Blob([body.innerHTML],{type:'text/html'}),'text/plain':new Blob([plain.join('\n')],{type:'text/plain'})};
}
async function copyToDocs(){
  const manual=$('destMode').value==='manual';
  const raw=$('targetDoc').value.trim();
  let target='https://docs.google.com/document/create';
  if(manual){
    const doc=resource(raw,'doc');
    target='https://docs.google.com/document/d/'+doc.id+'/edit'+(doc.tab?'?tab='+encodeURIComponent(doc.tab):'');
  }
  try{await navigator.clipboard.write([new ClipboardItem(clipboardPackage(posts,character))])}
  catch{throw Error('Chrome chưa cho sao chép. Bấm Tải Word để lưu toàn bộ bài và ảnh.')}
  status('Đã sao chép '+posts.length+' bài. '+(manual?'Đặt con trỏ ở vị trí muốn thêm rồi nhấn Ctrl+V.':'Nhấn Ctrl+V trong Google Docs để dán.'));
  await chrome.tabs.create({url:target});
}
if(!configured()){
  $('drive').textContent='Sao chép và mở Google Docs';
  $('drive').onclick=()=>run(copyToDocs);
  $('driveSettings').querySelector('summary').textContent='Chọn tài liệu Google Docs';
  for(const el of $('driveSettings').querySelectorAll('[data-drive-api]'))el.hidden=true;
}
$('syncDrive').onclick=()=>run(async()=>{
  $('conn').textContent='Đang đồng bộ…';
  try {
    const access=await token();
    if($('destMode').value==='auto')await folders(access);
    await destination(access);
    const pendingExport=posts.length && $('doc').hidden;
    if(pendingExport)await exportDrive();
    $('conn').textContent=pendingExport?'Đã đồng bộ kết quả với Google Docs.':'Đã đồng bộ thư mục và kiểm tra quyền ghi.';
  } catch(error) {
    $('conn').textContent=error.message;
    throw error;
  }
});
function destUI(){const manual=$('destMode').value==='manual';$('autoDest').hidden=manual||!configured();$('manualDest').hidden=!manual}
function option(id,label){let o=document.createElement('option');o.value=id;o.textContent=label;return o}
chrome.storage.local.get(['destMode','autoFolder','autoName','targetDoc']).then(x=>{$('destMode').value=x.destMode||'auto';if(x.autoFolder&&x.autoFolder!=='root'){$('autoFolder').append(option(x.autoFolder,x.autoName||x.autoFolder));$('autoFolder').value=x.autoFolder}$('targetDoc').value=x.targetDoc||'';destUI()});
$('destMode').onchange=()=>{destUI();chrome.storage.local.set({destMode:$('destMode').value})};$('autoFolder').onchange=()=>chrome.storage.local.set({autoFolder:$('autoFolder').value,autoName:$('autoFolder').selectedOptions[0].textContent});$('targetDoc').onchange=()=>chrome.storage.local.set({targetDoc:$('targetDoc').value.trim()});
async function folders(t){let list=[],pageToken='';do{const qs=new URLSearchParams({q:"trashed=false and mimeType='"+fm+"'",fields:'nextPageToken,files(id,name,capabilities/canAddChildren)',pageSize:'1000',orderBy:'name',supportsAllDrives:'true',includeItemsFromAllDrives:'true'});if(pageToken)qs.set('pageToken',pageToken);let res=await api('drive/v3/files?'+qs,t);list.push(...(res.files||[]).filter(f=>f.capabilities?.canAddChildren));pageToken=res.nextPageToken}while(pageToken);let sel=$('autoFolder'),old=sel.value;sel.replaceChildren(option('root','Drive của tôi'));let names=new Set;for(const f of list){sel.append(option(f.id,names.has(f.name)?f.name+' · '+f.id.slice(-6):f.name));names.add(f.name)}sel.value=[...sel.options].some(o=>o.value===old)?old:'root';sel.onchange();$('conn').textContent='Đã kết nối · '+list.length+' thư mục có thể ghi.'}
$('folders').onclick=$('connect').onclick=()=>run(async()=>{let t=await token();if($('destMode').value==='auto')await folders(t);else {await destination(t);$('conn').textContent='Đã xác nhận quyền ghi vào hai đích.'}});
function resource(raw,kind){raw=raw.trim();if(kind==='folder'&&/^[\w-]{10,}$/.test(raw))return {id:raw};let u;try{u=new URL(raw)}catch{}let match=u?.protocol==='https:'&&(kind==='folder'?u.hostname==='drive.google.com'&&u.pathname.match(/\/folders\/([\w-]+)\/?$/):u.hostname==='docs.google.com'&&u.pathname.match(/^\/document\/(?:u\/\d+\/)?d\/([\w-]+)(?:\/|$)/));if(!match)throw Error(kind==='folder'?'Link thư mục Drive không hợp lệ.':'Nhập link Google Docs đích.');return {id:match[1],tab:u.searchParams.get('tab')||null}}
async function destination(t){let manual=$('destMode').value==='manual',folder=manual?resource($('folder').value,'folder').id:$('autoFolder').value||'root',target=manual?resource($('targetDoc').value,'doc'):{};const inspect=id=>api('drive/v3/files/'+encodeURIComponent(id)+'?supportsAllDrives=true&fields=id,mimeType,trashed,capabilities(canAddChildren,canEdit)',t);let f=await inspect(folder);if(f.trashed||f.mimeType!==fm||!f.capabilities?.canAddChildren)throw Error('Tài khoản đã kết nối không thể thêm tệp vào thư mục đã chọn.');if(manual){let d=await inspect(target.id);if(d.trashed||d.mimeType!==dm||!d.capabilities?.canEdit)throw Error('Tài liệu đích phải là Google Docs và cho phép tài khoản đã kết nối chỉnh sửa.')}return {folder:f.id,doc:target.id,tab:target.tab}}
function appendPlan(content,items,tabId,c=null){const para=x=>x.paragraph?.elements?.map(e=>e.textRun?.content||'').join('').trim()||'',end=content.at(-1).endIndex-1,index=content.findLast(x=>para(x)==='Mục lục bài gốc'&&x.paragraph?.paragraphStyle?.namedStyleType==='HEADING_1'),start=index?.startIndex??end;let n=content.reduce((m,x)=>Math.max(m,Number(para(x).match(/^Bài (\d+)$/)?.[1]||0)),0),lines=[],refs=[],requests=[];
lines=researchLines(items,undefined,n);items.forEach((b,i)=>refs.push({t:'Nguồn bài '+(n+i+1),url:b.url}));
function insert(rows,pos,prefix){let text=prefix,styles=[],imgs=[];for(let x of rows){let from=pos+text.length,clean=x.t.replace(/[\u0000-\u0008\u000b-\u001f]/g,'');text+=clean+'\n';let range={startIndex:from,endIndex:from+clean.length+1,tabId};styles.push({updateParagraphStyle:{range,paragraphStyle:{namedStyleType:x.h?'HEADING_1':'NORMAL_TEXT',indentStart:{magnitude:(x.depth||0)*18,unit:'PT'}},fields:'namedStyleType,indentStart'}});if(clean&&x.url)styles.push({updateTextStyle:{range:{...range,endIndex:range.endIndex-1},textStyle:{link:{url:x.url}},fields:'link'}});if(x.im){let scale=Math.min(1,420/x.im.w,550/x.im.h);imgs.unshift({insertInlineImage:{location:{index:from,tabId},uri:x.im.src,objectSize:{width:{magnitude:Math.max(1,x.im.w*scale),unit:'PT'},height:{magnitude:Math.max(1,x.im.h*scale),unit:'PT'}}}})}}requests.push({insertText:{location:{index:pos,tabId},text}},...styles,...imgs)}
const second=content.find(x=>para(x)==='Phần 2 – Bình luận');const first=content.find(x=>para(x)==='Phần 1 – Bài viết');if(index&&second&&first){const split=lines.findIndex(x=>x.t==='Phần 2 – Bình luận');insert(refs,end,end>1?'\n':'');insert(lines.slice(split+1),start,'');insert(lines.slice(1,split),second.startIndex,'');}else if(index){insert(refs,end,end>1?'\n':'');insert(lines,start,'')}else insert([...lines,{t:'Mục lục bài gốc',h:true},...refs],end,end>1?'\n':'');if(c){requests.push({insertPageBreak:{location:{index:1,tabId}}});insert([{t:'Thông tin nhân vật',h:true},...characterRows(c)],1,'')}return requests}
async function docsCall(id,t,suffix,options={}){let r=await fetch('https://docs.googleapis.com/v1/documents/'+encodeURIComponent(id)+suffix,{...options,headers:{Authorization:'Bearer '+t,'Content-Type':'application/json'}}),j=await r.json();if(!r.ok)throw Error(j.error?.message||'Google Docs HTTP '+r.status);return j}
async function appendExisting(t,d){let data=await docsCall(d.doc,t,'?includeTabsContent=true'),tabs=[];function walk(xs){for(const x of xs||[]){tabs.push(x);walk(x.childTabs)}}walk(data.tabs);let tab=d.tab?tabs.find(x=>x.tabProperties.tabId===d.tab):tabs[0];if(!tab?.documentTab?.body?.content)throw Error('Không tìm thấy tab trong tài liệu đích.');let temp,items=posts,c=character;const same=c&&tab.documentTab.body.content.some(x=>x.paragraph?.elements?.some(e=>e.textRun?.content?.trim()==='Tên: '+c.out['Tên']));if(same)c=null;let profileImages=c?characterRows(c).filter(x=>x.im).map(x=>x.im):[];try{if(profileImages.length||posts.some(p=>p.pics?.length)){// Stage embedded images privately so Docs can copy them without Facebook cookies.
temp=(await upload(t,{name:'Ảnh tạm – Sổ nghiên cứu',mimeType:dm},buildDoc(posts,c,"original"))).id;let staged=await docsCall(temp,t,'');let uris=(staged.body?.content||[]).flatMap(x=>(x.paragraph?.elements||[]).flatMap(e=>{let id=e.inlineObjectElement?.inlineObjectId;return id?[staged.inlineObjects?.[id]?.inlineObjectProperties?.embeddedObject?.imageProperties?.contentUri]:[]}));if(uris.length!==profileImages.length+posts.reduce((n,b)=>n+b.pics.length,0)||uris.some(u=>!u))throw Error('Google Docs chưa chuyển đủ ảnh. Tài liệu đích chưa được ghi.');let n=0;if(c){let mapped=new Map(profileImages.map(im=>[im,{...im,original:im.src,src:uris[n++]}]));c={...c,pics:Object.fromEntries(Object.entries(c.pics).map(([k,v])=>[k,v.map(im=>mapped.get(im))]))}}items=posts.map(b=>({...b,pics:b.pics.map(im=>({...im,src:uris[n++]}))}))}let requests=appendPlan(tab.documentTab.body.content,items,tab.tabProperties.tabId,c);await docsCall(d.doc,t,':batchUpdate',{method:'POST',body:JSON.stringify({writeControl:{requiredRevisionId:data.revisionId},requests})});return {id:d.doc}}finally{if(temp)try{await api('drive/v3/files/'+temp,t,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({trashed:true})})}catch{note('Chưa dọn được tài liệu ảnh tạm trong Drive.')}}}

