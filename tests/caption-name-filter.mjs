import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterCaptionName,applyCaptionNames} from '../caption-name-filter.js';
import {createJob} from '../automation-model.js';
import {createAutomation} from '../automation.js';
const registry=JSON.parse(readFileSync('DANH-BA-TU-SHEET.json','utf8'));
const profiles=registry.profiles.filter(p=>p.uid&&p.enabled!==false);
let cases=0;
for(const profile of profiles){
 const text=`😊 ${profile.source.originalName}: xin chào! ${profile.source.originalName.toUpperCase()} nhé.`;
 const post={sourceUrl:profile.source.docsUrl,text,sourceCaption:text,blocks:[{runs:[{text}]}],media:[{type:'image',url:'https://example.org/image.jpg'}]};
 const media=structuredClone(post.media);const out=filterCaptionName(post,registry);
 assert.equal(out.count,2);assert.equal(post.text,`😊 ${profile.name}: xin chào! ${profile.name} nhé.`);assert.equal(post.sourceCaption,text);assert.deepEqual(post.media,media);assert.equal(filterCaptionName(post,registry).count,0);cases++;
}
const p=profiles[0],name=p.source.originalName,clone=p.name;
const split=name.indexOf(' ')+1;
const post={id:'p',state:'draft',sourceUrl:p.source.docsUrl,text:name,sourceCaption:name,blocks:[{runs:[{text:name.slice(0,split),bold:true},{text:name.slice(split),italic:true},{text:' 💖',underline:true}]}],media:[]};
filterCaptionName(post,registry);assert.equal(post.text,clone+' 💖');assert.equal(post.blocks[0].runs[0].bold,true);assert.equal(post.blocks[0].runs[2].underline,true);cases++;
const from='Nguyễn Nam',to='Trần Bắc';const r={profiles:[{uid:'100001',name:to,source:{originalName:from,docsUrl:'https://docs.google.com/document/d/test/edit'}}]};
const make=text=>({id:'p',state:'draft',sourceKey:'test:',text,blocks:[{runs:[{text}]}],media:[]});
let q=make(`“${from}”, ${from.toUpperCase()}! Nguyễn NamAn / AnNguyễn Nam. https://example.org/${from} ${from}@example.org`);
assert.equal(filterCaptionName(q,r).count,2);assert.ok(q.text.includes('Nguyễn NamAn / AnNguyễn Nam'));assert.ok(q.text.includes('https://example.org/'+from));assert.ok(q.text.includes(from+'@example.org'));cases++;
q=make('Nguyễn Nam');q.blocks=[{runs:[{text:'Nguyễn Nam'.normalize('NFD')}]}];filterCaptionName(q,r);assert.equal(q.text,to);cases++;
q=make(from);applyCaptionNames({posts:[q]},r);applyCaptionNames({posts:[q]},r);assert.equal(q.captionNameFilter.count,1);assert.equal(q.text,to);cases++;
q=make(from);q.state='success';applyCaptionNames({posts:[q]},r);assert.equal(q.text,from);cases++;
q=make(from);applyCaptionNames({posts:[q],bot:{jobs:[{postId:'p',state:'running'}]}},r);assert.equal(q.text,from);cases++;
assert.equal(filterCaptionName(make('Bài lạ'),{profiles:[]}).status,'unmapped');cases++;
const overlaps={profiles:[{...r.profiles[0],name:from+' An'}]};q=make(from);filterCaptionName(q,overlaps);assert.equal(q.text,from+' An');assert.equal(filterCaptionName(q,overlaps).count,0);cases++;
assert.throws(()=>filterCaptionName(make(from),{profiles:[...r.profiles,...r.profiles]}),/nhiều clone/);cases++;
assert.throws(()=>filterCaptionName(make(from),r,[],{url:'https://www.facebook.com/profile.php?id=100002'}),/UID/);cases++;
q=make('Nam');const short={profiles:[{...r.profiles[0],source:{...r.profiles[0].source,originalName:'Nam'}}]};applyCaptionNames({posts:[q]},short);assert.equal(q.captionNameFilter.status,'blocked');assert.throws(()=>createJob(q,{}, {url:'https://www.facebook.com/profile.php?id=100001',name:'Clone'},[]),/một từ/);cases++;
// Verify the final posting gate also catches an old queue snapshot with the source name.
const job={id:'job',postId:'p',token:'token',state:'running',facebookTabId:9,post:make(from),actor:{url:'https://www.facebook.com/profile.php?id=100001',name:to}};
const d={posts:[],bot:{enabled:true,jobs:[job]}};globalThis.chrome={runtime:{getURL:n=>'chrome-extension://test/'+n},storage:{local:{get:async()=>({deskPersonas:r})}}};
const service=createAutomation({db:async()=>d,write:async()=>{},lock:fn=>fn(),event(){}});
const permit={type:'bot-permit',jobId:'job',token:'token',mediaProof:{jobId:'job',token:'token',count:0,images:0,videos:0},audienceProof:{jobId:'job',token:'token',mode:'public'}};
await assert.rejects(service.handle(permit,{tab:{id:9}}),/vẫn còn tên/);assert.equal(job.submittedAt,undefined);cases++;
filterCaptionName(job.post,r);await service.handle(permit,{tab:{id:9}});assert.equal(job.state,'verifying');cases++;
console.log(`PASS ${cases} caption identity cases: 15 source→clone mappings, case/Unicode/boundaries, split rich runs, URLs, media/source preservation, no repeat edits, protected history, ambiguous mapping, UID mismatch, short name hold and final permit.`);
