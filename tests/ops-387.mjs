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
 const ctx={console};vm.createContext(ctx);
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
 const one=[...ctx.researchLines([legacy],'group')].map(x=>x.t).filter(t=>/^Media JSON:/.test(t||''));
 assert.equal(one.length,1);assert.match(one[0],/\/posts\//);
 results.push('Không tìm được link video: vẫn ghi link bài như cũ (FB Desk tìm mã video, không được thì dừng trước Bridge)');
}
// Mục 2: caption nghi là lời trả lời bình luận bị chặn có lý do; sửa caption thì qua.
{
 const flagged={text:'Duy Nguyễn tks bro. Quá hữu ích',captionPartial:true,captionEvidence:'nghi-tra-loi-binh-luan',media:[{type:'image'}]};
 assert.match(captionIssue(flagged),/nghi là lời trả lời bình luận/);
 assert.equal(captionIssue({...flagged,captionPartial:false}),'');
 assert.match(captionIssue({text:'Góc sang nhượng:…',captionPartial:true,captionEvidence:'timeline',media:[{type:'image'}]}),/rút gọn/);
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
console.log('PASS ops-387');for(const x of results)console.log(' ✓',x);
