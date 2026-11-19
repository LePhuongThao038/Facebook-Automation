import assert from 'node:assert/strict';
import {createAutomation} from '../automation.js';
globalThis.chrome={runtime:{getURL:name=>'chrome-extension://test/'+name},storage:{local:{get:async()=>({})}}};
const d={posts:[],bot:{enabled:true,jobs:[{id:'job',postId:'post',token:'token',state:'running',runnerTabId:7,facebookTabId:9,post:{media:[]}}]}};
let writes=0;const a=createAutomation({db:async()=>d,write:async()=>{writes++;},lock:fn=>fn(),event(){}});const sender={tab:{id:9}};
await a.handle({type:'bot-waiting-submit',jobId:'job',token:'token',waitMs:45000},sender);assert.equal(d.bot.jobs[0].stage,'waiting-submit');assert.ok(d.bot.jobs[0].waitUntil>Date.now()+44000);assert.equal(writes,1);
await assert.rejects(a.handle({type:'bot-waiting-submit',jobId:'job',token:'token',waitMs:45000},{tab:{id:10}}));
const permit={type:'bot-permit',jobId:'job',token:'token',mediaProof:{jobId:'job',token:'token',count:0,images:0,videos:0}};
for(const audienceProof of [undefined,{jobId:'job',token:'token',mode:'other'},{jobId:'other',token:'token',mode:'public'},{jobId:'job',token:'old',mode:'public'}]){await assert.rejects(a.handle({...permit,audienceProof},sender),/chế độ đối tượng/);assert.equal(d.bot.jobs[0].state,'running');assert.equal(d.bot.jobs[0].submittedAt,undefined);}
await a.handle({...permit,audienceProof:{jobId:'job',token:'token',mode:'default'}},sender);assert.equal(d.bot.jobs[0].state,'verifying');assert.ok(!d.bot.jobs[0].clickDispatchedAt,'grant alone must not claim a click');
await a.handle({type:'bot-clicked',jobId:'job',token:'token'},sender);assert.equal(d.bot.jobs[0].stage,'click-dispatched');assert.ok(d.bot.jobs[0].clickDispatchedAt);const before=writes;await a.handle({type:'bot-clicked',jobId:'job',token:'token'},sender);assert.equal(writes,before,'duplicate ack is idempotent');
console.log('PASS publish status: paced waiting, sender scope, reserved permit distinct from actual click-dispatch, idempotent acknowledgement');
