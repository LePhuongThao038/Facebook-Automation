import assert from 'node:assert/strict';
class Element{
 constructor(id=''){this.id=id;this.style={};this.textContent='';this.handlers={};this.disabled=false;this.children=[];}
 addEventListener(type,fn){this.handlers[type]=fn;}
 async click(){return this.handlers.click?.();}
 append(...nodes){this.children.push(...nodes);for(const node of nodes)if(node.id)elements.set(node.id,node);}
 remove(){this.removed=true;}
 showModal(){this.open=true;}
 close(){this.open=false;}
 setAttribute(){}focus(){}select(){}
}
const elements=new Map(['autosave-status','autosave-action-status','autosave-location','autosave-now','autosave-folder','autosave-copy-path','autosave-download','account-name'].map(id=>[id,new Element(id)]));
elements.get('autosave-location').textContent='%LOCALAPPDATA%\\FacebookDesk\\Autosave';
elements.get('account-name').textContent='Đang kiểm tra…';
globalThis.document={title:'Facebook Desk',getElementById:id=>elements.get(id),createElement:()=>new Element(),body:new Element()};
globalThis.MutationObserver=class{observe(){}};
globalThis.window={addEventListener(){}};
let copied='',failure=true,saved={ok:true,path:'C:\\Users\\Admin\\AppData\\Local\\FacebookDesk\\Autosave\\Tab.csv',at:new Date().toISOString()},requests=[];
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{clipboard:{writeText:async text=>{copied=text;}}}});
globalThis.chrome={storage:{local:{get:async()=>({deskAutosaveStatus:{ok:false,error:'Access to the specified native messaging host is forbidden.'}})},onChanged:{addListener(){}}},runtime:{id:'kfljghhbogbcnklfbmmdaaoadllaeglo',sendMessage:async({type})=>{
 requests.push(type);
 if(type==='autosave-context')return {ok:true,data:true};
 if(type==='autosave-flush')return {ok:true,data:saved};
 if(type==='autosave-download')return {ok:true,data:'caption,status\r\nhello,draft'};
 if(failure)return {ok:false,error:'Access to the specified native messaging host is forbidden.'};
 return {ok:true,data:{ok:true,path:'C:\\Users\\Admin\\AppData\\Local\\FacebookDesk\\Autosave'}};
}}};
await import('../autosave-ui-v2.js');await new Promise(r=>setImmediate(r));
assert.match(elements.get('autosave-status').textContent,/CSV ngoài máy chưa ghi được/);
await elements.get('autosave-folder').click();
assert.match(elements.get('autosave-action-status').textContent,/Chưa mở được thư mục/);assert.ok(!elements.get('autosave-folder').disabled);
const help=elements.get('autosave-help');assert.ok(help.open);assert.match(help.children.find(e=>e.value)?.value,/kfljghhbogbcnklfbmmdaaoadllaeglo/);
await elements.get('autosave-copy-path').click();assert.match(copied,/LOCALAPPDATA/);
failure=false;await elements.get('autosave-folder').click();assert.match(elements.get('autosave-action-status').textContent,/Đã yêu cầu Windows mở/);assert.match(elements.get('autosave-location').textContent,/C:\\Users\\Admin/);
await elements.get('autosave-now').click();assert.match(elements.get('autosave-action-status').textContent,/Đã ghi CSV thành công/);assert.ok(!elements.get('autosave-location').textContent.endsWith('.csv'));
saved={ok:false,error:'Access to the specified native messaging host is forbidden.'};await elements.get('autosave-now').click();assert.match(elements.get('autosave-action-status').textContent,/Chưa ghi được/);
const realTimer=globalThis.setTimeout;globalThis.setTimeout=()=>0;
try{await elements.get('autosave-download').click();}finally{globalThis.setTimeout=realTimer;}
assert.ok(requests.includes('autosave-download'));assert.ok(document.body.children.some(e=>e.download==='Facebook Desk.csv'));assert.match(elements.get('autosave-action-status').textContent,/trình tải xuống/);
console.log('PASS autosave UI: native failure has inline recovery, prefilled ID, visible/copyable path, real open request, truthful save result, CSV download without native host, buttons restored');
