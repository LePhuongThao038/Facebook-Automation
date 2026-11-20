// 3.8.7-story: hàng chờ xử lý lượt Story (dùng chung cổng cấp quyền với bài viết). Chạy: node tests/story-automation-387.mjs
import assert from 'node:assert/strict';
import {createAutomation} from '../automation.js';
import {createStoryJob} from '../story-model.js';
globalThis.chrome={runtime:{getURL:name=>'chrome-extension://test/'+name},storage:{local:{get:async()=>({})}}};
const actor={url:'https://www.facebook.com/profile.php?id=100001',name:'Thu Trà'};
const story={id:'st1',kind:'image',name:'a.jpg',media:[{type:'image',storyFileId:'f1'}]};
const j=createStoryJob(story,actor,[],{dueAt:Date.now(),scheduleMode:'now'});
Object.assign(j,{state:'running',runnerTabId:7,facebookTabId:9,mediaProofId:'proof-1'});
const d={posts:[],stories:[story],logs:[],bot:{enabled:true,jobs:[j]}};
const events=[];const a=createAutomation({db:async()=>d,write:async()=>{},lock:fn=>fn(),event:(_,p,status,message)=>events.push({title:p.title,status,message})});
const fb={tab:{id:9}},runner={tab:{id:7},url:'chrome-extension://test/runner.html'};
const results=[];
// Quyền bấm: phải có bằng chứng tải đúng 1 ảnh của lượt này.
const permit={type:'bot-permit',jobId:j.id,token:j.token,audienceProof:{jobId:j.id,token:j.token,mode:'default'}};
await assert.rejects(a.handle({...permit,mediaProof:{jobId:j.id,token:j.token,count:0,images:0,videos:0,proofId:''}},fb),/chưa xác nhận đủ media/);
await assert.rejects(a.handle({...permit,mediaProof:{jobId:j.id,token:j.token,count:1,images:1,videos:0,proofId:'khác'}},fb),/chưa xác nhận đủ media/);
assert.equal(j.state,'running');
await a.handle({...permit,mediaProof:{jobId:j.id,token:j.token,count:1,images:1,videos:0,proofId:'proof-1'}},fb);
assert.equal(j.state,'verifying');assert.ok(j.submittedAt);
results.push('Quyền bấm "Chia sẻ lên tin": cần bằng chứng tải đúng 1 ảnh của lượt; ghi submittedAt trước khi bấm');
// Story không có permalink: "Đã đăng" khi Facebook nhận tin (published), không cần link.
await assert.rejects(a.handle({type:'runner-finish',jobId:j.id,token:j.token,result:{state:'success',url:'',published:false}},runner),/Thiếu bằng chứng/);
await a.handle({type:'runner-finish',jobId:j.id,token:j.token,result:{state:'success',url:'',published:true,message:'Đã đăng Story'}},runner);
assert.equal(j.state,'success');assert.equal(d.posts.length,0);assert.ok(events.some(e=>e.status==='success'&&/^Story · /.test(e.title)));
results.push('Đã đăng Story khi Facebook nhận tin (không cần link); không tạo bài viết nào trong danh sách bài');
// Lượt Story cần đối soát: người dùng xác nhận bằng tay; lượt khác/đã xong thì từ chối.
const k=createStoryJob({...story,id:'st2'},actor,[],{dueAt:Date.now()});Object.assign(k,{state:'unknown',submittedAt:new Date().toISOString()});d.bot.jobs.push(k);
await a.handle({type:'bot-story-confirm',jobId:k.id},{});assert.equal(k.state,'success');assert.equal(k.manualReconciliation,true);
await assert.rejects(a.handle({type:'bot-story-confirm',jobId:k.id},{}),/không cần xác nhận/);
results.push('Lượt Story "cần xác nhận": xác nhận tay sau khi thấy tin; không xác nhận lại lượt đã xong');
console.log('PASS story-automation-387');for(const x of results)console.log(' ✓',x);
