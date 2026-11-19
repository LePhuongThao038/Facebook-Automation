import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);const {chromium}=createRequire(process.env.USERPROFILE+'/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/package.json')('playwright');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try{
 const page=await browser.newPage();const source=readFileSync('media-transfer.js','utf8');
 await page.route('**/*',route=>route.fulfill({contentType:route.request().url().endsWith('.js')?'text/javascript':'text/html',body:route.request().url().endsWith('.js')?source:'<main>Local test</main>'}));await page.goto('https://fbdesk.test/');
 const result=await page.evaluate(async()=>{
  const m=await import('/media-transfer.js');const size=65*1024*1024+17;const blob=new Blob([new Uint8Array(size-1),new Uint8Array([123])],{type:'video/mp4'});
  const file=await m.storeTransfer(blob,{name:'large.mp4',type:'video/mp4'},'job:token');let denied=false;try{await m.transferChunk(file.transferId,0,'wrong');}catch{denied=true;}
  document.documentElement.dataset.facebookDeskJob='job';document.documentElement.dataset.facebookDeskToken='token';let largest=0;
  for(let index=0;index<file.chunks;index++){const part=await m.transferChunk(file.transferId,index,'job:token');largest=Math.max(largest,part.base64.length);const staged=m.stageMediaChunk({file,index,base64:part.base64,jobId:'job',token:'token'});if(!staged.ok)throw Error(staged.error);}
  const record=globalThis.__deskStagedFiles.get(file.transferId);const built=new File(record.parts,file.name,{type:file.type});const last=new Uint8Array(await built.slice(-1).arrayBuffer())[0];
  const stopped=m.stageMediaChunk({file,index:0,base64:'AA==',jobId:'job',token:'old'});
  await m.releaseTransfers('job:token');let removed=false;try{await m.transferChunk(file.transferId,0,'job:token');}catch{removed=true;}
  return {size:built.size,expected:size,last,denied,removed,stopped:!stopped.ok,largest,descriptor:JSON.stringify(file).length};
 });
 assert.equal(result.size,result.expected);assert.equal(result.last,123);assert.ok(result.denied&&result.removed&&result.stopped);assert.ok(result.largest<1500000);assert.ok(result.descriptor<1024);console.log('PASS real browser: 65 MiB file reconstructed exactly through 1 MiB messages, owner/stop guards, IndexedDB cleanup');
}finally{await browser.close();}
