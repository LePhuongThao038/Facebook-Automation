let character=null;
const characterMissing='Chưa thấy trên trang cá nhân';
const characterFields=['Tên','Nickname','Mô tả','Sống tại','Ngày sinh','Tình trạng hôn nhân','Quan tâm','Du lịch','Thông tin liên hệ'];
const characterMedia=['Ảnh Avatar','Ảnh Cover photo','Tin nổi bật'];
function readCharacter(about){
 const root=document.querySelector('[role=main],main');if(!root)return null;
 const safe=e=>!e.closest('[role=article],article,[role=feed],nav,[role=navigation]');
 const all=(s,r=root)=>[...r.querySelectorAll(s)].filter(e=>safe(e)&&e.getClientRects().length);
 const txt=e=>(e?.innerText||'').trim();
 const followerLink = all('a[href*="/followers"]').at(0);
 // 0.2.23: tên chủ trang lấy từ tiêu đề trang (og:title / document.title). Thẻ h1 đầu tiên có thể là tên
 // nick đang đăng nhập hoặc nằm ngoài [role=main], làm sai Tên, Avatar, Ảnh bìa.
 const titleName=String(document.querySelector('meta[property="og:title"]')?.content||document.title||'').replace(/^\(\d+\)\s*/,'').replace(/\s*[|·–-]\s*Facebook\s*$/i,'').trim();
 const usableTitle=titleName&&!/^facebook$/i.test(titleName)&&titleName.length<120;
 const anyH1=[...document.querySelectorAll('h1,[aria-level="1"]')].filter(e=>e.getClientRects().length&&!e.closest('[role=article],article,[role=feed],nav,[role=navigation],[role=banner]'));
 const headerAvatar=[...root.querySelectorAll('svg')].filter(svg=>svg.getClientRects().length&&!svg.closest('[role=article],article,[role=feed],nav,[role=navigation],[role=banner]')&&svg.querySelector('image')&&svg.getAttribute('aria-label')&&svg.getBoundingClientRect().width>=100&&/\/photo/.test(svg.closest('a[href]')?.getAttribute('href')||'')).sort((a,b)=>b.getBoundingClientRect().width-a.getBoundingClientRect().width)[0];
 const avatarName=(headerAvatar?.getAttribute('aria-label')||'').trim();
 const bigName=[...root.querySelectorAll('[role=button] span,h1,h2')].find(e=>e.getClientRects().length&&!e.closest('[role=article],article,[role=feed],[role=dialog]')&&parseFloat(getComputedStyle(e).fontSize)>=24&&txt(e).length>1&&txt(e).length<80);
 let identity = (usableTitle&&anyH1.find(e=>txt(e).replace(/\s+/g,' ').startsWith(titleName)))||all('h1,[aria-level="1"]')[0]||(avatarName&&bigName&&txt(bigName).startsWith(avatarName)?bigName:null);
 if (!identity && followerLink) {
   for (let box = followerLink.parentElement; box && box !== root; box = box.parentElement) {
     const before = all('button,[role=button]', box).find(button =>
       txt(button) && (button.compareDocumentPosition(followerLink) & Node.DOCUMENT_POSITION_FOLLOWING));
     if (before) { identity = before; break; }
   }
 }
 let avatarPage = '', coverPage = '';
 const name = usableTitle?titleName:(avatarName||txt(identity)), out = {}, media = {};
 const match=name.match(/^(.+?)\s*\(([^()]+)\)$/s);if(name)out['Tên']=(match?.[1]||name).trim();if(match)out.Nickname=match[2].trim();
 const src=e=>e?.currentSrc||e?.getAttribute('href')||e?.getAttribute('xlink:href')||e?.src;
 function section(h){let p=h.parentElement;for(let i=0;p&&p!==root&&i<6;i++,p=p.parentElement){if(txt(p)!==txt(h)&&!p.querySelector('article,[role=feed],[role=article]')&&txt(p).length<3500)return p}}
 const heads=all('h2,h3,[role=heading]');
 const intro=heads.find(e=>/^(Giới thiệu|Intro|Tiểu sử|Bio)$/i.test(txt(e)));
 const parts=[];
 if(intro&&section(intro))parts.push(section(intro));
 for(const h of heads){if(/^(Thông tin cá nhân|Personal details|Details|Chi tiết|Contact info|Thông tin liên hệ|Basic info|Thông tin cơ bản|Du lịch|Travel)$/i.test(txt(h))&&section(h))parts.push(section(h))}
 if(about)parts.push(root);
 const patterns={'Mô tả':/^(?:Hạng mục|Category)\s*[:：]\s*/i,'Nickname':/^(?:Biệt danh|Nickname|Tên khác|Other names?)\s*[:：]?\s*/i,'Sống tại':/^(?:Sống (?:tại|ở)|Lives in)\s*[:：]?\s*/i,'Ngày sinh':/^(?:Ngày sinh|Sinh nhật|Birthday|Date of birth)\s*[:：]?\s*/i,'Tình trạng hôn nhân':/^(?:Tình trạng (?:hôn nhân|mối quan hệ)|Relationship status)\s*[:：]?\s*/i,'Quan tâm':/^(?:Quan tâm(?: đến)?|Interested in)\s*[:：]?\s*/i,'Du lịch':/^(?:Du lịch|Travel|Places visited)\s*[:：]?\s*/i,'Thông tin liên hệ':/^(?:Thông tin liên hệ|Contact info(?:rmation)?)\s*[:：]?\s*/i};
 for(const part of parts){const lines=[...all('span,div,h2,h3,a',part)].filter(e=>!e.closest('[role=tablist],[role=tab]')&&!e.children.length).flatMap(e=>txt(e).split('\n')).map(x=>x.trim()).filter(Boolean);
 for(let i=0;i<lines.length;i++){let line=lines[i];for(const [key,re] of Object.entries(patterns)){if(!re.test(line)||/Thông tin liên hệ và cơ bản|Contact and basic info/i.test(line))continue;
 let v=line.replace(re,'');if(!v){let node=all('span,div,h2,h3',part).find(e=>txt(e)===line&&!e.children.length&&!e.closest('[role=tablist],[role=tab]'));let box=node&&section(node);let vals=(box?all('span,div,a',box).filter(e=>!e.children.length).map(txt):[]).map(x=>x.trim()).filter(x=>x&&x!==line&&!/^(Chỉnh sửa|Edit|Xem thêm|See more)$/i.test(x));if(vals.length&&vals.length<=8&&!vals.some(x=>Object.values(patterns).some(r=>r.test(x))))v=vals.join('\n')}
 if(v&&!out[key])out[key]=v}
 if(/^(Độc thân|Đã kết hôn(?: với .+)?|Đang hẹn hò(?: với .+)?|Single|Married(?: to .+)?)$/i.test(line))out['Tình trạng hôn nhân']=line;
 if(!out['Mô tả']&&/^(?:Người sáng tạo nội dung số|Nhà sáng tạo nội dung số|Digital creator|Content creator|Người của công chúng|Public figure|Blogger|Doanh nhân|Entrepreneur)$/i.test(line))out['Mô tả']=line;
 }}
 for(const h of heads){let k=/^(?:Du lịch|Travel|Places visited)$/i.test(txt(h))?'Du lịch':/^(?:Thông tin liên hệ|Contact info(?:rmation)?)$/i.test(txt(h))?'Thông tin liên hệ':null;let box=k&&section(h);if(box){let values=txt(box).split('\n').map(v=>v.trim()).filter(v=>v&&v!==txt(h)&&!/^(Xem thêm|Chỉnh sửa|Edit|See more)$/i.test(v));if(values.length)out[k]=values.join('\n')}}
 if(intro&&!about){const box=section(intro);if(box){let el=all('[dir=auto]',box).find(e=>{let t=txt(e);return t&&t!==txt(intro)&&!e.querySelector('[dir=auto]')&&!e.closest('a,button,[role=button]')&&!Object.values(patterns).some(r=>r.test(t))&&!/^(Trang cá nhân|Profile|Chi tiết|Details|Chỉnh sửa|Edit|Từ |From )/i.test(t)});if(el)out['Mô tả']=txt(el)}}
 const bio=heads.find(e=>/^(Tiểu sử|Bio)$/i.test(txt(e)));if(bio&&section(bio))out['Mô tả']=txt(section(bio)).split('\n').filter(v=>v.trim()!==txt(bio)).join('\n').trim();
 if(!about){
   const details = all('[aria-label="Chi tiết nêu bật"],[aria-label="Profile highlights"]')[0];
   for (let box = details; box && box !== root; box = box.parentElement) {
     const bio = box.previousElementSibling;
     if (!bio || !txt(bio)) continue;
     if (!bio.querySelector('button,a,[role=button]') && txt(bio).length < 1000)
       out['Mô tả'] = txt(bio);
     break;
   }
   const images=[...new Set([...all('img,svg image'),...(identity&&!root.contains(identity)?[...document.querySelectorAll('img,svg image')].filter(e=>e.getClientRects().length&&!e.closest('[role=article],article,[role=feed],nav,[role=navigation],[role=banner]')):[])])];
   // 0.2.24: avatar không còn bắt buộc nằm trước thẻ tên (Facebook đổi thứ tự trong DOM, làm trượt avatar dù đã
   // thấy ảnh bìa). Chọn ảnh LỚN NHẤT có nhãn trùng tên chủ trang hoặc "ảnh đại diện"; bỏ ảnh trong thanh trên cùng.
   let bestAvatar=null;
   for (const image of images) {
     if (image.closest('[role=banner]')) continue;
     const link = image.closest('a,button,[role=button]');
     const labels = [image.alt, link?.getAttribute('aria-label'), image.closest('svg')?.getAttribute('aria-label')].filter(Boolean);
     const url = src(image);
     if (!/^https:\/\//.test(url || '')) continue;
     if (labels.some(label => /cover photo|ảnh bìa|xem ảnh bài của trang cá nhân/i.test(label))) { if(!media['Ảnh Cover photo']){media['Ảnh Cover photo'] = [url];const anchor=image.closest('a[href]');coverPage = anchor && /^\/photo(?:\.php|\/?)$/.test(anchor.pathname) ? anchor.href : '';} continue; }
     const named = labels.some(label => label.trim() === out['Tên'] || /ảnh đại diện|profile picture|profile photo/i.test(label));
     if (!named) continue;
     const box = (image.closest('svg') || image).getBoundingClientRect(), size = box.width * box.height;
     if (box.width < 60) continue;
     if (!bestAvatar || size > bestAvatar.size) bestAvatar = {size, url, anchor: image.closest('a[href]')};
   }
   if (bestAvatar) {
     media['Ảnh Avatar'] = [bestAvatar.url];
     const anchor = bestAvatar.anchor;
     avatarPage = anchor && /^\/photo(?:\.php|\/?)$/.test(anchor.pathname) ? anchor.href : '';
   }
 let feat=heads.find(e=>/^(Tin nổi bật|Đáng chú ý|Featured|Highlights)$/i.test(txt(e)));let nodes=[...all('a[href*="profile_highlight"],a[href*="/stories/highlights/"]')];if(!nodes.length&&feat&&section(feat))nodes.push(section(feat));let urls=[...new Set(nodes.flatMap(n=>all('img,svg image',n).map(src)).filter(u=>/^https:\/\//.test(u||'')))];if(urls.length)media['Tin nổi bật']=urls}
 return {out,media,avatarPage,coverPage};
}
// 0.2.25: trang cá nhân (nhất là chế độ chuyên nghiệp) chỉ cho xem biệt danh và hạng mục trong hộp
// "Giới thiệu về …", mở bằng cách bấm vào tên ở đầu trang. Chỉ mở, đọc rồi đóng; không thao tác gì khác.
async function readProfileDialog(name){
 const pause=ms=>new Promise(r=>setTimeout(r,ms)),vis=e=>!!e?.getClientRects().length,txt=e=>(e?.innerText||'').trim();
 const main=document.querySelector('[role=main],main');if(!main||!name)return null;
 const button=[...main.querySelectorAll('[role=button]')].find(b=>vis(b)&&!b.closest('[role=article],article,[role=feed],[role=dialog]')&&txt(b).replace(/\s+/g,' ').trim()===name&&parseFloat(getComputedStyle(b.querySelector('span')||b).fontSize)>=22);
 if(!button)return null;
 const before=new Set(document.querySelectorAll('[role=dialog]'));button.click();
 let dialog=null;for(let i=0;i<20&&!dialog;i++){await pause(250);dialog=[...document.querySelectorAll('[role=dialog]')].filter(d=>vis(d)&&!before.has(d)&&txt(d).includes(name)).pop()||null;}
 if(!dialog)return null;
 const lines=txt(dialog).split('\n').map(x=>x.trim()).filter(Boolean),out={};
 for(const line of lines){
  let m;
  if((m=line.match(/^(?:Biệt danh|Nickname|Tên khác|Other names?)\s*[:：]\s*(.+)$/i)))out.Nickname=m[1];
  else if((m=line.match(/^(?:Sống (?:tại|ở)|Lives in)\s*[:：]?\s*(.+)$/i)))out['Sống tại']=m[1];
  else if((m=line.match(/^(?:Sinh nhật|Ngày sinh|Birthday)\s*[:：]?\s*(.+)$/i)))out['Ngày sinh']=m[1];
  else if((m=line.match(/^(?:Đã tham gia Facebook|Joined Facebook)\s*[:：]\s*(.+)$/i)))out.joined=m[1];
  else if(/^(?:Người sáng tạo nội dung số|Nhà sáng tạo nội dung số|Digital creator|Content creator|Người của công chúng|Public figure|Blogger|Doanh nhân|Entrepreneur|Nghệ sĩ|Artist)$/i.test(line))out.category=line;
 }
 const close=[...dialog.querySelectorAll('[role=button][aria-label]')].find(b=>/^(?:đóng|close)$/i.test(b.getAttribute('aria-label')));
 if(close)close.click();else document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
 return out;
}
function showCharacter(){let box=$('character');box.replaceChildren();box.hidden=!character;if(!character)return;const add=(tag,s)=>{let e=document.createElement(tag);e.textContent=s;box.append(e);return e};add('h3','Thông tin về Profile này');for(const k of characterFields)add('div',k+': '+(character.out[k]||characterMissing));for(const k of characterMedia){add('strong',k+': ');const warn=k==='Ảnh Avatar'?character.avatarWarning:k==='Ảnh Cover photo'?character.coverWarning:'';if(warn)add('span',warn+' ');let imgs=character.media[k]||[];if(!imgs.length)add('span',characterMissing);for(const src of imgs){let im=add('img','');im.src=src;im.alt=k;im.style='max-height:90px;max-width:180px;vertical-align:middle;margin:4px';}add('br','')}}
async function loadCharacter(id,url){
 const read=async(t,a)=>(await chrome.scripting.executeScript({target:{tabId:t},func:readCharacter,args:[a]}))[0]?.result;
 let base;
 for (let attempt = 0; attempt < 5; attempt++) {
   base = await read(id,false);
   if (base?.out['Tên'] && base.media['Ảnh Avatar']) break;
   if (attempt < 4) await sleep(450);
 }
 if (!base) return;
 character={...base,pics:{},url};showCharacter();
 try{const [box]=await chrome.scripting.executeScript({target:{tabId:id},func:readProfileDialog,args:[base.out['Tên']||'']});const info=box?.result;
  if(info){if(info.Nickname&&!character.out.Nickname)character.out.Nickname=info.Nickname;if(info['Sống tại']&&!character.out['Sống tại'])character.out['Sống tại']=info['Sống tại'];if(info['Ngày sinh']&&!character.out['Ngày sinh'])character.out['Ngày sinh']=info['Ngày sinh'];
   const about=[info.category,info.joined?'Tham gia Facebook: '+info.joined:''].filter(Boolean).join(' · ');if(about&&!character.out['Mô tả'])character.out['Mô tả']=about;showCharacter();}
 }catch{}
 if (base.media['Ảnh Avatar']?.length) {
   try { await resolveAvatar(character); }
   catch { character.avatarWarning = 'Facebook chỉ cung cấp ảnh đại diện xem trước.'; }
   showCharacter();
 }
 // Từ bản 0.2.22 (16/11): ảnh bìa cỡ gốc lấy từ trang ảnh.
 if (base.media['Ảnh Cover photo']?.length) {
   try { await resolveCover(character); }
   catch { character.coverWarning = 'Facebook chỉ cung cấp ảnh bìa xem trước.'; }
   showCharacter();
 }
 let aux;try{for(const path of ['about_overview','about_contact_and_basic_info','about_family_and_relationships','about_details']){
 let u=new URL(url);if(u.pathname==='/profile.php')u.searchParams.set('sk',path);else u.pathname=u.pathname.replace(/\/$/,'')+'/'+path;
 if(!aux)aux=(await chrome.tabs.create({url:u.href,active:false})).id;else await chrome.tabs.update(aux,{url:u.href});
 for(let i=0;i<16;i++){await sleep(350);const t=await chrome.tabs.get(aux);if(t.status==='complete'&&t.url===u.href)break}await sleep(550);
 const data=await read(aux,true);if(data&&(!base.out['Tên']||data.out['Tên']===base.out['Tên']))for(const k of characterFields)if(!character.out[k]&&data.out[k])character.out[k]=data.out[k];
 }}finally{if(aux)await chrome.tabs.remove(aux).catch(()=>{});showCharacter()}
}
async function fetchCharacterPics(){if(!character)return;for(const k of characterMedia){character.pics[k]??=[];for(const src of character.media[k]||[])if(!character.pics[k].some(i=>i.src===src))try{character.pics[k].push({...await (k==='Tin nổi bật'?pic(src):avatarPicture(src)),src})}catch{note('Chưa tải được '+k+'; đã giữ liên kết ảnh.')}}}
function characterRows(c){if(!c)return [];let rows=characterFields.map(k=>({t:k+': '+(c.out[k]||characterMissing)}));for(const k of characterMedia){const warn=k==='Ảnh Avatar'?c.avatarWarning:k==='Ảnh Cover photo'?c.coverWarning:'';rows.push({t:k+':'+(warn?' '+warn:'')});if(k==='Ảnh Avatar'&&c.avatarSource)rows.push({t:'Xem ảnh trong album Facebook',url:c.avatarSource});let urls=c.media[k]||[];if(!urls.length)rows.push({t:characterMissing});for(const src of urls){let im=(c.pics[k]||[]).find(i=>(i.original||i.src)===src);rows.push(im?{t:'',im}:{t:'Mở ảnh trên Facebook',url:src})}}return rows}
