// 3.8.7: nhịp 3 phút tính giữa hai lần bấm Đăng; caption là chữ giao diện Facebook không được đăng.
// Chạy: node tests/fixes-387.mjs
import assert from 'node:assert/strict';
import {canClaim,submitWaitMs,CLAIM_LEAD_MS} from '../posting-plan.js';
import {cleanCaption,isUiCaption} from '../scenario.js';
import {captionIssue,mediaOnlyPost} from '../automation-model.js';
import {splitPosts} from '../scenario.js';
import {parseCommentLines} from '../cross-comment-model.js';
const results=[];
const T0=Date.parse('2026-11-19T09:00:00Z'),GAP=180000;
const job=(id,dueOffset,extra={})=>({id,state:'queued',scheduleMode:'default',minGapMs:GAP,dueAt:new Date(T0+dueOffset).toISOString(),...extra});

// Bài trước bấm Đăng lúc T0. Bài sau đến lượt lúc T0+3'.
{
 const prev=job('a',0,{state:'success',submittedAt:new Date(T0).toISOString()}),next=job('b',GAP);
 assert.equal(canClaim(next,[prev,next],T0+GAP-CLAIM_LEAD_MS-1000),false,'chưa tới lúc chuẩn bị');
 assert.equal(canClaim(next,[prev,next],T0+GAP-CLAIM_LEAD_MS),true,'được mở bài sớm để chuẩn bị');
 assert.equal(submitWaitMs(next,[prev,next],T0+GAP-30000),30000,'nút Đăng chờ đúng mốc 3 phút');
 assert.equal(submitWaitMs(next,[prev,next],T0+GAP+5000),0,'đã quá mốc: bấm ngay');
 results.push('mở bài sớm '+CLAIM_LEAD_MS/1000+' giây để chuẩn bị, bấm Đăng đúng mốc 3 phút sau lần trước');
}
// Hàng chờ bị trễ: dueAt đã qua, khoảng cách vẫn tính từ lần bấm trước.
{
 const prev=job('a',0,{state:'unknown',submittedAt:new Date(T0+600000).toISOString()}),next=job('b',GAP);
 assert.equal(canClaim(next,[prev,next],T0+600000+60000),false);
 assert.equal(canClaim(next,[prev,next],T0+600000+GAP-CLAIM_LEAD_MS),true);
 assert.equal(submitWaitMs(next,[prev,next],T0+600000+GAP-CLAIM_LEAD_MS),CLAIM_LEAD_MS);
 results.push('hàng chờ trễ: vẫn giữ tối thiểu 3 phút giữa hai lần đăng');
}
// Đăng ngay (giãn cách 60 giây) và hẹn giờ: không mở sớm.
{
 const now=job('n',0,{scheduleMode:'now',minGapMs:60000});
 assert.equal(canClaim(now,[now],T0-1000),false);
 assert.equal(submitWaitMs(now,[now],T0),0);
 const manual=job('m',GAP,{scheduleMode:'manual',minGapMs:0});
 assert.equal(canClaim(manual,[manual],T0+GAP-10000),false);
 results.push('đăng ngay / hẹn giờ cụ thể: giữ nguyên hành vi cũ');
}
// Caption là chữ giao diện.
{
 for(const t of ['Facebook','facebook','của tác giả','Reels','Âm thanh gốc'])assert.equal(isUiCaption(t),true,t);
 for(const t of ['Hi','Facebook là nơi mình gặp nhau','Clean girlll ✨','Tháng 4 của em❤️'])assert.equal(isUiCaption(t),false,t);
 const photo=cleanCaption({number:23,text:'của tác giả',blocks:[{runs:[{text:'của tác giả'}]}],sourceCaption:'của tác giả',sourceCaptionState:'present',sourceKind:'post',media:[{type:'image'}],titleAuto:true,title:'của tác giả',contentSchema:2});
 assert.equal(photo.text,'');assert.equal(photo.captionState,'no_caption');assert.equal(captionIssue(photo),'');assert.equal(mediaOnlyPost(photo),true);
 results.push('bài ảnh caption "của tác giả": đăng ảnh, không kèm chữ');
 const reel=cleanCaption({number:17,text:'Facebook',blocks:[{runs:[{text:'Facebook'}]}],sourceCaption:'Facebook',sourceCaptionState:'present',sourceKind:'reel',media:[{type:'video',manifest:{kind:'reel',sourceUrl:'https://www.facebook.com/reel/1640085867682202/'}}],contentSchema:2});
 assert.equal(reel.captionSuspect,'Facebook');assert.equal(reel.text,'Facebook');
 results.push('Reel caption "Facebook": đánh dấu để đọc lại caption thật qua Media Bridge trước khi đăng');
 const edited=cleanCaption({text:'Facebook',captionEdited:true,blocks:[{runs:[{text:'Facebook'}]}],sourceKind:'post',media:[{type:'image'}]});
 assert.equal(edited.text,'Facebook');
 results.push('caption người dùng tự sửa thành "Facebook": giữ nguyên');
}
// Phân nhánh comment: thụt lề trong Docs (depth) -> comment cha.
{
 const T=t=>({runs:[{text:t}]}),D=(t,depth)=>({runs:[{text:t}],depth});
 const blocks=[T('Phần 1 – Bài viết'),T('Bài 1'),T('Caption thử'),T('Trạng thái caption: present'),T('Phần 2 – Bình luận'),T('Bình luận bài 1'),
  T('Bạn nữ (Pham Huyen Trang): Chúc em iu năm mới'),D('Tác giả: cảm ơn chị',1),D('Bạn nữ (Pham Huyen Trang): Hẹn năm mới gặp nhaa',2),
  T('Bạn nam (Nguyễn Văn Hùng): Chúc mừng'),D('Tác giả: cảm ơn anh',1),D('Bạn nam 2 (Tạ Quang Ninh): chuẩn',1)];
 const [p]=splitPosts(blocks,{key:'doc:',url:'https://docs.google.com/document/d/doc/edit'});
 assert.deepEqual(p.commentDepths,[0,1,2,0,1,1]);
 const e=parseCommentLines(p.comments,p.commentDepths).map(x=>[x.id,x.parentId]);
 assert.deepEqual(e,[['dong-1',''],['dong-2','dong-1'],['dong-3','dong-2'],['dong-4',''],['dong-5','dong-4'],['dong-6','dong-4']]);
 results.push('Docs thụt lề 0/1/2: reply gắn đúng comment cha, kể cả reply của reply và 2 reply cùng cha');
 const flat=parseCommentLines(['Bạn nữ (A B): x','Tác giả: y']).map(x=>x.parentId);
 assert.deepEqual(flat,['','']);
 results.push('Docs cũ không có thụt lề: giữ hành vi cũ (không tự đoán comment cha)');
}
console.log('PASS fixes-387');for(const x of results)console.log(' ✓',x);
