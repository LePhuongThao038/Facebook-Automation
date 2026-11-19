// 3.8.7: đồng hồ xoay hẹn giờ đăng. Chạy: node tests/dial-387.mjs [thư-mục-ảnh]
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {previewTimes,formatGap} from '../schedule-dial.js';
let require=createRequire(import.meta.url);
try{require.resolve('playwright');}catch{require=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json');}
const {chromium}=require('playwright');
const shots=process.argv[2]||'';
const results=[];
// Thuần logic
assert.deepEqual(previewTimes({startAt:0,minutes:7},3,1000),[1000,1000+420000,1000+840000]);
assert.equal(formatGap(135),'2 giờ 15 phút');assert.equal(formatGap(60),'1 giờ');assert.equal(formatGap(4),'4 phút');
results.push('tính giờ xem trước và chữ khoảng cách');

const root=new URL('../',import.meta.url);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const ctx=await browser.newContext({viewport:{width:900,height:420}});const p=await ctx.newPage();
 await p.route('https://desk.test/**',r=>{const path=new URL(r.request().url()).pathname.slice(1);
  if(path==='index.html')return r.fulfill({contentType:'text/html',body:'<!doctype html><html lang="vi"><head><meta charset="utf-8"><link rel="stylesheet" href="v2.css"><link rel="stylesheet" href="studio.css"></head><body style="background:var(--canvas);padding:16px"><div id="d"></div></body></html>'});
  try{return r.fulfill({contentType:path.endsWith('.css')?'text/css':'text/javascript',body:readFileSync(new URL(path,root))});}catch{return r.fulfill({status:404,body:''});}});
 await p.goto('https://desk.test/index.html');
 // Giờ giả cố định 10:00:00 để kết quả ổn định.
 await p.evaluate(async()=>{const {createScheduleDial}=await import('/schedule-dial.js');const now=new Date(2026,10,19,10,0,0).getTime();window.changes=[];window.dial=createScheduleDial(document.getElementById('d'),{minutes:3,now:()=>now,onChange:v=>window.changes.push(v)});window.dial.setCount(5);});
 const val=()=>p.evaluate(()=>window.dial.value());
 assert.equal((await val()).minutes,3);
 const box=await p.locator('.dial-face').boundingBox();const cx=box.x+box.width/2,cy=box.y+box.height/2,R=box.width*0.4;
 // Cuộn chuột lên 4 nấc: 3 -> 7 phút
 await p.mouse.move(cx,cy);for(let i=0;i<4;i++){await p.mouse.wheel(0,-100);}
 assert.equal((await val()).minutes,7);results.push('cuộn chuột: 3 → 7 phút (không còn mốc cố định)');
 // Kéo trọn 1 vòng theo chiều kim đồng hồ: +60 phút
 const at=deg=>[cx+R*Math.sin(deg*Math.PI/180),cy-R*Math.cos(deg*Math.PI/180)];
 await p.mouse.move(...at(0));await p.mouse.down();for(let d=10;d<=360;d+=10)await p.mouse.move(...at(d));await p.mouse.up();
 assert.equal((await val()).minutes,67);results.push('kéo trọn 1 vòng: +60 phút (7 → 67 phút = 1 giờ 7 phút)');
 // Kéo ngược nửa vòng: -30 phút
 await p.mouse.move(...at(0));await p.mouse.down();for(let d=-10;d>=-180;d-=10)await p.mouse.move(...at(d));await p.mouse.up();
 assert.equal((await val()).minutes,37);results.push('kéo ngược nửa vòng: −30 phút');
 // Bàn phím
 await p.locator('.dial-face').focus();await p.keyboard.press('PageUp');await p.keyboard.press('ArrowDown');
 assert.equal((await val()).minutes,46);results.push('phím PageUp (+10) / mũi tên (−1)');
 // Không cho khoảng cách < 1 phút
 await p.keyboard.press('Home');await p.keyboard.press('ArrowDown');assert.equal((await val()).minutes,1);results.push('giới hạn dưới 1 phút');
 await p.evaluate(()=>window.dial.setMinutes(5));
 // Giờ bắt đầu: quay tới 10:45, không quay lùi về quá khứ
 await p.getByRole('radio',{name:'Giờ bắt đầu'}).click();
 assert.equal((await val()).startAt,0);
 await p.mouse.move(...at(0));await p.mouse.down();for(let d=-10;d>=-90;d-=10)await p.mouse.move(...at(d));await p.mouse.up();
 assert.equal((await val()).startAt,0,'không lùi về quá khứ');
 await p.mouse.move(...at(0));await p.mouse.down();for(let d=10;d<=270;d+=10)await p.mouse.move(...at(d));await p.mouse.up();
 const v=await val();assert.equal(new Date(v.startAt).getHours(),10);assert.equal(new Date(v.startAt).getMinutes(),45);
 const text=await p.locator('.dial-preview').innerText();assert.match(text,/5 bài · Bắt đầu hôm nay 10:45, mỗi bài cách 5 phút → 10:45 · 10:50 · 10:55 · 11:00 …/,text);
 results.push('giờ bắt đầu: quay ¾ vòng = 10:45, xem trước 10:45 · 10:50 · 10:55 · 11:00; không lùi về quá khứ');
 // Quay tiếp qua 12 giờ: kim giờ sang giờ kế
 await p.mouse.move(...at(270));await p.mouse.down();for(let d=280;d<=450;d+=10)await p.mouse.move(...at(d));await p.mouse.up();
 assert.equal(new Date((await val()).startAt).getHours(),11);results.push('quay qua số 12: sang 11 giờ');
 assert.equal(await p.locator('.dial-face').getAttribute('role'),'slider');
 if(shots){for(const theme of ['aurora','sakura','midnight']){await p.evaluate(t=>document.documentElement.dataset.theme=t,theme);await p.waitForTimeout(600);await p.locator('.dial').screenshot({path:shots+'/dial-'+theme+'.png'});}}
 await ctx.close();
 console.log('PASS dial-387');for(const x of results)console.log(' ✓',x);
}finally{await browser.close();}
