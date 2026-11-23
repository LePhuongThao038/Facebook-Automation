// 3.8.7: lệch ngẫu nhiên theo giây khi xếp lịch đăng (tránh nhịp cố định đúng N phút, giây :00 dễ bị checkpoint).
// Chạy: node tests/jitter-387.mjs
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {assignSlots,maxJitterSeconds,jitterSeconds,canClaim,submitWaitMs,DEFAULT_JITTER_SECONDS} from '../posting-plan.js';
import {maxJitterFor} from '../schedule-dial.js';
const results=[];
// Bộ sinh số giả ngẫu nhiên có hạt để kết quả lặp lại được.
const seeded=seed=>()=>((seed=(seed*1664525+1013904223)%4294967296)/4294967296);
const now=Date.parse('2026-11-23T10:00:00+07:00'),gap=3*60000;
// Giới hạn: tối đa = nửa khoảng cách − 30 giây; khớp giữa lịch và đồng hồ.
assert.equal(maxJitterSeconds(gap),60);assert.equal(maxJitterSeconds(60000),0);assert.equal(maxJitterSeconds(2*60000),30);assert.equal(maxJitterSeconds(60*60000),1770);
for(const m of [1,2,3,5,10,60])assert.equal(maxJitterFor(m),maxJitterSeconds(m*60000));
assert.equal(jitterSeconds(gap,500),60);assert.equal(jitterSeconds(gap,-5),0);assert.equal(jitterSeconds(gap,'abc'),0);assert.equal(DEFAULT_JITTER_SECONDS,45);
results.push('Giới hạn lệch = nửa khoảng cách − 30 giây (cách 3 phút: ±60 giây; cách 1 phút: không lệch); đồng hồ và lịch dùng cùng giới hạn');
// Xếp 40 bài, cách 3 phút, lệch ±45 giây, bắt đầu 10:30.
const startAt=Date.parse('2026-11-23T10:30:00+07:00');
const items=Array.from({length:40},(_,i)=>({id:'p'+i,mode:'default',time:''}));
const slots=assignSlots(items,[],now,gap,startAt,45,seeded(7));
const t=slots.map(s=>Date.parse(s.dueAt));
assert.ok(t[0]>=startAt,'bài đầu không sớm hơn giờ bắt đầu');
for(let i=0;i<t.length;i++){const base=startAt+i*gap;assert.ok(Math.abs(t[i]-base)<=45000||(i===0&&t[0]>=startAt),'bài '+i+' lệch quá ±45 giây');}
for(let i=1;i<t.length;i++){assert.ok(t[i]-t[i-1]>=60000,'hai bài liền nhau phải cách ≥ 60 giây');assert.ok(t[i]>t[i-1],'giữ thứ tự');}
const gaps=new Set(t.slice(1).map((x,i)=>Math.round((x-t[i])/1000)));assert.ok(gaps.size>=20,'khoảng cách thực tế phải đa dạng: '+gaps.size);
const onZero=t.filter(x=>new Date(x).getSeconds()===0&&new Date(x).getMilliseconds()===0).length;assert.ok(onZero<=2,'không dồn vào giây :00 ('+onZero+')');
assert.ok(slots.every(s=>s.minGapMs===gap-2*45000&&s.jitterSeconds===45));
results.push('40 bài cách 3 phút ±45 giây: bài đầu không sớm hơn giờ bắt đầu, mỗi bài lệch trong ±45 giây, luôn cách nhau ≥ 60 giây, giữ thứ tự, khoảng cách thực tế đa dạng, không đăng đúng giây :00');
// Không lệch (0) thì giữ nguyên nhịp cũ.
const fixed=assignSlots(items.slice(0,3),[],now,gap,startAt,0);
assert.deepEqual(fixed.map(s=>Date.parse(s.dueAt)),[startAt,startAt+gap,startAt+2*gap]);assert.ok(fixed.every(s=>s.minGapMs===gap));
results.push('Lệch = 0: giữ đúng nhịp cũ (tương thích)');
// Bài có giờ cụ thể trong Docs: giữ nguyên giờ, không lệch.
const ex=assignSlots([{id:'e',mode:'explicit',time:'10/01/2027 15:00'},{id:'d',mode:'default',time:''}],[],now,gap,0,45,seeded(3));
assert.equal(Date.parse(ex[0].dueAt),Date.parse('2027-01-10T15:00:00+07:00'));
results.push('Bài có giờ cụ thể trong Docs: giữ đúng giờ người dùng đặt');
// Lúc chạy: bài lệch SỚM không bị kéo về mốc "đúng 3 phút sau bài trước".
{const prev={id:'a',submittedAt:new Date(startAt).toISOString()};const j={id:'b',scheduleMode:'default',minGapMs:gap-2*45000,dueAt:new Date(startAt+gap-40000).toISOString()};
 const at=startAt+gap-40000;assert.equal(submitWaitMs(j,[prev,j],at),0,'đúng mốc lệch sớm thì được bấm');assert.ok(canClaim(j,[prev,j],at));
 const old={...j,minGapMs:gap};assert.equal(submitWaitMs(old,[prev,old],at),40000,'(bản cũ sẽ bắt chờ thêm 40 giây)');}
{const prev={id:'a',submittedAt:new Date(startAt).toISOString()};const j={id:'c',scheduleMode:'default',minGapMs:gap-2*45000,jitterSeconds:45,dueAt:new Date(startAt+gap+30000).toISOString()};
 const early=startAt+gap+30000-80000;assert.ok(canClaim(j,[prev,j],early),'được mở bài sớm để chuẩn bị');assert.equal(submitWaitMs(j,[prev,j],early),80000,'nhưng chỉ bấm Đăng đúng mốc ngẫu nhiên');}
results.push('Lúc chạy: bài lệch sớm được bấm đúng mốc ngẫu nhiên (bản cũ kéo về đúng 3 phút); vẫn mở bài sớm để chuẩn bị, chỉ bấm đúng mốc');
// Story cũng nhận lệch ngẫu nhiên; chạy thử thì không lệch.
const auto=readFileSync(new URL('../automation.js',import.meta.url),'utf8');
assert.match(auto,/const jitter=mode==='dry'\?0:jitterSeconds\(minutes\*60000,msg\.jitterSeconds\?\?DEFAULT_JITTER_SECONDS\)/);
assert.match(auto,/dueAt:Math\.max\(start,start\+i\*minutes\*60000\+jitterOffsetMs\(jitter\)\)/);
results.push('Story: mỗi tin lệch ngẫu nhiên, tin đầu không sớm hơn giờ bắt đầu; chạy thử không lệch');
// Đồng hồ: ô lệch ngẫu nhiên, tự giới hạn theo khoảng cách, gửi kèm khi xếp lịch.
let require=createRequire(import.meta.url);
try{require.resolve('playwright');}catch{require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');}
const {chromium}=require('playwright');const root=new URL('../',import.meta.url);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const p=await (await browser.newContext({viewport:{width:900,height:460}})).newPage();
 await p.route('https://desk.test/**',r=>{const path=new URL(r.request().url()).pathname.slice(1);if(path==='index.html')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"><head><meta charset="utf-8"><link rel="stylesheet" href="v2.css"><link rel="stylesheet" href="studio.css"></head><body><div id="d"></div></body></html>'});try{return r.fulfill({contentType:path.endsWith('.css')?'text/css':'text/javascript',body:readFileSync(new URL(path,root))});}catch{return r.fulfill({status:404,body:''});}});
 await p.goto('https://desk.test/index.html');
 await p.evaluate(async()=>{const {createScheduleDial}=await import('/schedule-dial.js');const now=new Date(2026,10,23,10,0,0).getTime();window.dial=createScheduleDial(document.getElementById('d'),{minutes:3,now:()=>now});});
 assert.equal((await p.evaluate(()=>dial.value())).jitterSeconds,45);
 assert.match(await p.textContent('.dial-preview'),/lệch ngẫu nhiên ±45 giây/);
 await p.fill('.dial-jitter input','200');assert.equal((await p.evaluate(()=>dial.value())).jitterSeconds,60);assert.match(await p.textContent('.dial-jitter small'),/tối đa 60 giây/);
 await p.evaluate(()=>dial.setMinutes(1));assert.equal((await p.evaluate(()=>dial.value())).jitterSeconds,0);assert.match(await p.textContent('.dial-jitter small'),/không lệch được/);
 const v2=readFileSync(new URL('../v2.js',import.meta.url),'utf8');assert.match(v2,/jitterSeconds:dial\.value\(\)\.jitterSeconds/);
 results.push('Đồng hồ: ô "Lệch ngẫu nhiên ± giây" (mặc định 45), tự giới hạn theo khoảng cách, hiện trong dòng xem trước và gửi kèm khi xếp lịch');
}finally{await browser.close();}
console.log('PASS jitter-387');for(const x of results)console.log(' ✓',x);
