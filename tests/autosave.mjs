import assert from 'node:assert/strict';
import {createCSVAutosave,nativeSaveCSV,safeCSVName} from '../csv-autosave.js';
import {guardVideoSize} from '../video-probe.js';
const state={deskV2:{posts:[{id:'one',title:'Caption',text:'Nội dung 😊',sourceCaption:'Nội dung 😊',state:'draft',media:[],comments:[]}],sources:[],logs:[],settings:{},bot:{jobs:[],actor:{url:'https://www.facebook.com/profile.php?id=123',name:'Phi Yến'}}},deskAutosaveDirty:'revision1',deskAutosaveContext:{title:'Tab · Phi Yến'}};
let listener,alarm,nativeCSV='',commits=[],calls=[];
globalThis.chrome={storage:{local:{async get(keys){return Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(k=>[k,state[k]]));},async set(value){Object.assign(state,value);},async remove(key){delete state[key];}},onChanged:{addListener(fn){listener=fn;}}},alarms:{onAlarm:{addListener(fn){alarm=fn;}},async create(){}},runtime:{connectNative(){let message,disconnect;let text='',name='';return {onMessage:{addListener(fn){message=fn;}},onDisconnect:{addListener(fn){disconnect=fn;}},postMessage(value){calls.push(value.action);if(value.action==='csv-begin'){name=value.name;text='';}if(value.action==='csv-chunk')text+=value.text;if(value.action==='csv-commit'){nativeCSV=text;commits.push({name,text});}queueMicrotask(()=>message({ok:true,path:'C:/Autosave/'+name+'.csv'}));},disconnect(){}};}}};
const save=createCSVAutosave();await new Promise(r=>setImmediate(r));await save.flush();
assert.ok(state.deskAutosaveStatus.ok);assert.match(nativeCSV,/Nội dung 😊/);assert.match(commits[0].name,/Phi Yến/);assert.ok(!state.deskAutosaveDirty);assert.ok(state.deskAutosaveProfile);
const stable=state.deskAutosaveProfile;
state.deskV2.posts[0].state='success';listener({deskV2:{newValue:state.deskV2}},'local');await new Promise(r=>setImmediate(r));await save.flush();assert.equal(state.deskAutosaveProfile,stable);assert.match(nativeCSV,/success/);assert.ok(commits.length===2);
assert.equal(safeCSVName('A/B:C*?'),'A_B_C__');
// Expired 25 MB verdict must not block a 100 MB file under the new policy.
const storage={async get(){return {deskVideoProbe200:{url:{status:'too_big',bytes:100*1024*1024,exact:true,maxMB:25,at:Date.now()}}};},async set(){}};
await guardVideoSize({sourceUrl:'url'},{storage,fetchImpl:async()=>({ok:true,json:async()=>({status:'ok',bytes:100*1024*1024,exact:true,maxMB:200})})});
// A CSV can be much larger than the native message ceiling; split it.
calls=[];await nativeSaveCSV('😊'.repeat(40000),'Large tab',stable);assert.ok(calls.filter(x=>x==='csv-chunk').length>=3);
console.log('PASS autosave: saved progress, stable profile filename, terminal update, chunked Unicode CSV, old 25 MB verdict invalidation');
