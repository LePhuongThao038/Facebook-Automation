import vm from 'node:vm';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root='./';
const source=readFileSync(root+'start-video-ui.js','utf8');
async function ui(mode){
 const elements=Object.fromEntries(['media-start-video','media-bridge-result','media-start-id'].map(id=>[id,{addEventListener(_,fn){this.click=fn;}}]));
 let calls=0,healthCalls=0;
 const context={document:{getElementById:id=>elements[id]},chrome:{runtime:{id:'a'.repeat(32),async sendMessage(message){calls++;assert.deepEqual(JSON.parse(JSON.stringify(message)),{type:'media-start-video'});return mode==='error'?{ok:false,error:'Install-Start-Video.cmd'}:{ok:true,data:{ok:true}};}}},AbortSignal,Date,Error,setTimeout,fetch:async()=>{healthCalls++;if(mode!=='warm'&&healthCalls===1)throw Error('offline');return {ok:true,json:async()=>({schema:'desk.media/1',maxMB:25})};}};
 vm.runInNewContext(source,context);
 assert.equal(elements['media-start-id'].value,'a'.repeat(32));
 await elements['media-start-video'].click();
 assert.equal(elements['media-start-video'].disabled,false);
 assert.equal(calls,1);
 assert.match(elements['media-bridge-result'].textContent,mode==='error'?/Install-Start-Video/:/sẵn sàng/);
}
await ui('warm');await ui('cold');await ui('error');
const bg=readFileSync(root+'background.js','utf8');
const start=bg.indexOf(" if(msg.type==='media-start-video'){");
const end=bg.indexOf(" if(msg.type?.startsWith('comment-'))",start);
let nativeCalls=0;
const chrome={runtime:{id:'a'.repeat(32),getURL:name=>'chrome-extension://'+'a'.repeat(32)+'/'+name,async sendNativeMessage(host,data){nativeCalls++;assert.equal(host,'com.facebookdesk.media');assert.deepEqual(data,{action:'start'});return {ok:true};}}};
const handler=new Function('chrome',`return async (msg,sender)=>{${bg.slice(start,end)}}`)(chrome);
await assert.rejects(handler({type:'media-start-video'},{id:chrome.runtime.id,url:'https://www.facebook.com/'}));
assert.equal(nativeCalls,0);
await handler({type:'media-start-video'},{id:chrome.runtime.id,url:chrome.runtime.getURL('dashboard.html')});
assert.equal(nativeCalls,1);
console.log('PASS Start Video UI warm/cold/error, ID display, dashboard-only launch and fixed native action');
