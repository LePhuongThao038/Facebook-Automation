// 3.8.7: sửa theo báo cáo vận hành 20/11 (docs/BAO-CAO-VAN-HANH-3.8.7-2026-11-20.md). Chạy: node tests/ops-387.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {splitPosts} from '../scenario.js';
import {captionIssue} from '../automation-model.js';
const results=[];
const T=t=>({runs:[{text:t}]});

// Mục 1: Post Research ghi mỗi video một dòng Media JSON với link riêng; FB Desk đọc đủ.
{
 const ctx={console,URL};vm.createContext(ctx);
 vm.runInContext(readFileSync(new URL('../post-research/groups.js',import.meta.url),'utf8')+';this.researchLines=researchLines;',ctx);
 const post={url:'https://www.facebook.com/bacuphom2018/posts/pfbid02eh',body:'Caption',pics:[],comments:[],video:true,sourceKind:'video',
  videoLinks:['https://www.facebook.com/100001935892538/videos/pcb.38315919794722405/916384724525827','https://www.facebook.com/reel/2215910718814116']};
 const lines=[...ctx.researchLines([post],'group')].map(x=>x.t).filter(t=>/^Media JSON:/.test(t||''));
 assert.equal(lines.length,2,lines.join('\n'));
 assert.ok(!lines.some(l=>l.includes('/posts/')),'không được ghi link bài viết');
 const parsed=lines.map(l=>JSON.parse(l.replace(/^Media JSON:\s*/,'')));
 assert.deepEqual(parsed.map(m=>m.kind),['video','reel']);
 results.push('Post Research: bài 4 ảnh + 2 video ghi 2 dòng Media JSON, mỗi dòng là link riêng của video');
 const blocks=[T('Phần 1 – Bài viết'),T('Bài 6'),T('Caption'),T('Trạng thái caption: present'),...lines.map(T)];
 const [p]=splitPosts(blocks,{key:'doc:',url:'https://docs.google.com/document/d/doc/edit'});
 const videos=p.media.filter(m=>m.type==='video');
 assert.equal(videos.length,2);assert.equal(new Set(videos.map(v=>v.id)).size,2);
 assert.match(videos[0].manifest.sourceUrl,/videos\/pcb\./);
 results.push('FB Desk: đọc đủ 2 video từ một bài, id không trùng');
 const legacy={...post,videoLinks:undefined};
 const legacyLines=[...ctx.researchLines([legacy],'group')].map(x=>x.t);
 const one=legacyLines.filter(t=>/^Media JSON:/.test(t||''));
 assert.equal(one.length,0);
 assert.ok(legacyLines.some(t=>/chưa xác nhận link video riêng/.test(t||'')));
 results.push('Không tìm được link video: không xuất Media JSON giả từ link bài viết');
}
// Mục 2: caption nghi là lời trả lời bình luận bị chặn có lý do; sửa caption thì qua.
{
 const flagged={text:'Duy Nguyễn tks bro. Quá hữu ích',captionPartial:true,captionEvidence:'nghi-tra-loi-binh-luan',media:[{type:'image'}]};
 assert.match(captionIssue(flagged),/nghi là lời trả lời bình luận/);
 assert.equal(captionIssue({...flagged,captionPartial:false}),'');
 // 3.8.7-cap: caption rút gọn không còn bị chặn; runner lấy caption đầy đủ trước khi đăng (tests/full-caption-387.mjs).
 assert.equal(captionIssue({text:'Góc sang nhượng:…',captionPartial:true,captionEvidence:'timeline',media:[{type:'image'}]}),'');
 results.push('Caption nghi là trả lời bình luận: chặn với lý do riêng; sửa caption (bỏ cờ) thì được đăng');
}
// Mục 5: không còn nhãn phiên bản viết cứng.
{
 const html=readFileSync(new URL('../dashboard.html',import.meta.url),'utf8'),ui=readFileSync(new URL('../build-info-ui.js',import.meta.url),'utf8');
 assert.ok(!/3\.8\.5 RC11/.test(html));assert.ok(!/startsWith\('3\.8\.5/.test(ui));assert.match(ui,/getManifest\(\)/);
 results.push('Dashboard: tiêu đề, nhãn và hộp kiểm tra lấy phiên bản từ manifest');
}
// Mục 6: tên nick tra theo UID, có tên tự đặt tại máy.
{
 globalThis.chrome={runtime:{getURL:p=>'chrome-extension://x/'+p},storage:{local:{get:async()=>({deskActorNames:{'61593376541721':'Trần Thu An'}})}}};
 globalThis.fetch=async()=>({json:async()=>({profiles:[{uid:'100058731851421',name:'Nguyễn Tùng Giang'}]})});
 const {accountFileLabel}=await import('../csv-autosave.js');
 assert.equal(await accountFileLabel({name:'UID 61593376541721',url:'https://www.facebook.com/profile.php?id=61593376541721'}),'Trần Thu An · UID 61593376541721');
 assert.equal(await accountFileLabel({name:'UID 100058731851421',url:'https://www.facebook.com/profile.php?id=100058731851421'}),'Nguyễn Tùng Giang · UID 100058731851421');
 assert.equal(await accountFileLabel({name:'Tên Thật',url:'https://www.facebook.com/profile.php?id=1'}),'Tên Thật · UID 1');
 results.push('Tên nick: danh bạ theo UID, rồi tên tự đặt tại máy; tên Facebook thật luôn ưu tiên');
}
// Nút "Bật lại tự động hóa": bật xong thì tự mở Media Bridge; tạm dừng thì không; bridge lỗi không chặn việc bật.
{
 const src=readFileSync(new URL('../overview.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('const bridgeNote='),src.indexOf('const refreshAccount='));
 async function run({enabledBefore,healthy,startOk=true,afterStart=true}){
  const els={'run-bridge':{textContent:''},'media-bridge-result':{textContent:''},'run-state':{textContent:''}};
  const sent=[];let started=false;
  const ctx={
   AbortSignal:{timeout:()=>undefined},Date,Math,Error,Promise,setTimeout:(f)=>setTimeout(f,0),
   document:{getElementById:id=>els[id]},
   fetch:async()=>{if(healthy||(started&&afterStart))return {ok:true,json:async()=>({schema:'desk.media/1',maxMB:200})};throw Error('ECONNREFUSED');},
   chrome:{runtime:{sendMessage:async m=>{sent.push(m.type);if(m.type==='desk-toggle')return {ok:true,data:{enabled:m.enabled}};if(m.type==='media-start-video'){started=startOk;return startOk?{ok:true}:{ok:false,error:'Chưa cài bộ nối.'};}}}},
   runButton:{},runEnabled:enabledBefore,showRunControl:()=>{}
  };
  vm.createContext(ctx);
  vm.runInContext('var runEnabled=this.runEnabled,runButton=this.runButton,showRunControl=this.showRunControl;'+block,ctx);
  await ctx.runButton.onclick();
  for(let i=0;i<20;i++)await new Promise(r=>setTimeout(r,1));
  return {sent,note:els['run-bridge'].textContent};
 }
 let r=await run({enabledBefore:false,healthy:false});
 assert.deepEqual(r.sent,['desk-toggle','media-start-video']);assert.match(r.note,/sẵn sàng/);
 r=await run({enabledBefore:false,healthy:true});
 assert.deepEqual(r.sent,['desk-toggle']);assert.match(r.note,/đã chạy/);
 r=await run({enabledBefore:true,healthy:false});
 assert.deepEqual(r.sent,['desk-toggle']);assert.equal(r.note,'');
 r=await run({enabledBefore:false,healthy:false,startOk:false});
 assert.deepEqual(r.sent,['desk-toggle','media-start-video']);assert.match(r.note,/chưa chạy: Chưa cài bộ nối/);
 results.push('Bật lại tự động hóa: tự mở Media Bridge nếu chưa chạy; đang chạy thì thôi; tạm dừng không mở; lỗi chỉ báo, không chặn');
}
// Bản vá: khi native host thiếu, nút bật dùng protocol cục bộ để cài lại đúng extension ID rồi khởi động bridge.
{
 const overview=readFileSync(new URL('../overview.js',import.meta.url),'utf8');
 assert.match(overview,/fbdesk-install:\/\/install\//);
 assert.match(overview,/encodeURIComponent\(chrome\.runtime\.id\)/);
 assert.match(overview,/không mở được|native messaging|bộ nối windows|bộ nối|đăng ký/i);
 const installer=readFileSync(new URL('../Install-Start-Video.ps1',import.meta.url),'utf8');
 assert.match(installer,/RegisterDeskInstallProtocol/);
 assert.match(installer,/fbdesk-install/);
 const protocol=readFileSync(new URL('../Desk-Install-Protocol.ps1',import.meta.url),'utf8');
 assert.match(protocol,/Start-Media-Background\.ps1/);
 assert.match(protocol,/Install-Start-Video\.ps1/);
 results.push('Bản vá: lỗi native host chuyển sang fbdesk-install để đăng ký ID và khởi động bridge');
}
// 0.2.26.1: quét link video/reel không phụ thuộc aria-label của ô media.
{
 const scan=readFileSync(new URL('../post-research/scan.js',import.meta.url),'utf8');
 assert.match(scan,/0\.2\.26\.1/);
 assert.match(scan,/getAttribute\('href'\)/);
 assert.ok(scan.includes('/(?:videos|reels?)')||scan.includes('/videos/'));
 results.push('Post Research 0.2.26.1: thu thập link /videos/, /reel/, /watch?v= rộng hơn');
}
// 0.2.26.2: fallback đọc JSON/script cho bài Facebook không đưa link video ra DOM.
{
 const scan=readFileSync(new URL('../post-research/scan.js',import.meta.url),'utf8');
 assert.match(scan,/0\.2\.26\.2/);
 assert.match(scan,/sourcePayload/);
 assert.ok(scan.includes('sourcePayload.matchAll'));
 results.push('Post Research 0.2.26.2: đọc link/video_id trong JSON/script fallback');
}
// 0.2.26.3: không xuất link bài viết thành Media JSON video.
{
 const manifest=JSON.parse(readFileSync(new URL('../post-research/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.version,'0.2.26.7');
 const groups=readFileSync(new URL('../post-research/groups.js',import.meta.url),'utf8');
 assert.match(groups,/chưa xác nhận link video riêng/);
 results.push('Post Research 0.2.26.3: chặn Media JSON giả từ /posts/');
}
// 0.2.26.4: bài ảnh không giữ media video sai từ lượt quét trước.
{
 const {refreshSourceMedia}=await import('../source-media.js');
 const old={id:'new-year',state:'draft',media:[{type:'image',url:'1'},{type:'image',url:'2'},{type:'video',url:'old'},{type:'video',manifest:{sourceUrl:'https://www.facebook.com/posts/pfbid-old'}}],sourceKind:'video',original:{media:[{type:'video'}]}};
 const next={sourceKind:'post',missingVideo:false,sourceImageCount:2,media:[{type:'image',url:'1'},{type:'image',url:'2'}]};
 const d={posts:[old],bot:{enabled:true,jobs:[]}};
 assert.equal(refreshSourceMedia(d,old,next),'refreshed');
 assert.deepEqual(old.media.map(m=>m.type),['image','image']);
 assert.equal(old.sourceKind,'post');
 assert.equal(old.missingVideo,false);
 const scenario=readFileSync(new URL('../scenario.js',import.meta.url),'utf8');
 assert.match(scenario,/articleSource/);
 results.push('0.2.26.4: nhận bài /posts/ là ảnh, dọn media video dư thừa');
}
// 0.2.26.5: bài ảnh không được xuất Media JSON dù post.video bị đánh dấu sai.
{
 const ctx={console,URL};vm.createContext(ctx);
 vm.runInContext(readFileSync(new URL('../post-research/groups.js',import.meta.url),'utf8')+';this.researchLines=researchLines;',ctx);
 const post={url:'https://www.facebook.com/yenzo22501/posts/pfbid0vzGk',body:'Chúc mừng năm mới cả nhà',pics:['1','2'],video:true,sourceKind:'video',videoLinks:[]};
 const lines=[...ctx.researchLines([post],'group')].map(x=>x.t);
 assert.equal(lines.filter(t=>/^Media JSON:/.test(t||'')).length,0);
 assert.ok(lines.some(t=>/bài có ảnh, chưa xác nhận video/.test(t||'')));
 const manifest=JSON.parse(readFileSync(new URL('../post-research/manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.version,'0.2.26.7');
 results.push('0.2.26.7: bài ảnh không xuất Media JSON video');
}
console.log('PASS ops-387');for(const x of results)console.log(' ✓',x);
