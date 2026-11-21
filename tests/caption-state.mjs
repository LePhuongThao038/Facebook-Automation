import assert from 'node:assert/strict';
import {cleanCaption,setManualCaption,splitPosts} from '../scenario.js';
import {createJob} from '../automation-model.js';
for(const value of [false,'false','FALSE','0',0,undefined]){
 const post={text:'Có caption…',blocks:[{runs:[{text:'Có caption…'}]}],captionPartial:value};
 cleanCaption(post);assert.equal(post.captionPartial,false);assert.equal(post.captionState,'present');
}
const blocks=partial=>['Phần 1 — Bài viết','Bài 1','Trạng thái caption: present','Kiểm tra caption: '+JSON.stringify({partial,evidence:'message'}),'Nội dung','Caption đang có…','Phần 2 — Bình luận','Bình luận bài 1','Comment mẫu'].map(text=>({runs:[{text}]}));
const source={key:'test',url:'https://docs.google.com/document/d/test/edit'};
const post=splitPosts(blocks(true),source)[0];
assert.equal(post.captionPartial,true);assert.equal(post.text,'Caption đang có…');assert.equal(post.comments.length,1);
assert.equal(splitPosts(blocks('false'),source)[0].captionPartial,false);
const actor={url:'https://www.facebook.com/profile.php?id=100001',name:'Test'};
// 3.8.7-cap: caption rút gọn được vào hàng chờ; runner lấy caption đầy đủ trước khi đăng.
assert.doesNotThrow(()=>createJob(post,{},actor,[]));
setManualCaption(post,post.text);assert.equal(post.captionPartial,true,'saving unchanged text cannot silently clear source warning');
setManualCaption(post,'Caption đã sửa hoàn chỉnh #hashtag');
assert.equal(post.text,'Caption đã sửa hoàn chỉnh');assert.equal(post.captionPartial,false);
assert.equal(post.sourceCaption,'Caption đang có…');assert.equal(post.sourceCaptionPartial,true);
assert.equal(post.captionEdited,true);assert.equal(createJob(post,{},actor,[]).state,'queued');
const empty=splitPosts(blocks(true),source)[0];setManualCaption(empty,'');assert.equal(empty.captionPartial,true);
console.log('PASS caption: false strings, real partial preserved, ellipsis alone allowed, structured import, explicit edit clears stale flag and allows job, original caption preserved, empty/unchanged edits retain block');
