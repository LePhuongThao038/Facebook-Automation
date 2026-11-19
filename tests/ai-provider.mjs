import test from 'node:test';
import assert from 'node:assert/strict';
import {apiConfig,buildRequest,keyMatches,responseText,parseJSON,generateText,providerModels} from '../ai-provider.js';
import {exportProgressV3} from '../progress-v3.js';
import {readProgressFile} from '../csv-progress.js';
import {splitPosts,docsSource} from '../scenario.js';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
test('API protocol, endpoint and model are independent; accepts slash and free model suffix',()=>{
 const r=buildRequest({apiProtocol:'compatible',apiBaseUrl:'https://example.com/api/v1/chat/completions/',model:'vendor/model:free'},'FAKE','test');
 assert.equal(r.url,'https://example.com/api/v1/chat/completions');assert.equal(r.body.model,'vendor/model:free');assert.equal(r.headers.Authorization,'Bearer FAKE');assert.ok(!r.url.includes('FAKE'));assert.ok(!r.body.response_format);
});
test('reject credential URLs, queries, HTTP and unknown protocols',()=>{for(const apiBaseUrl of ['http://host/v1','https://user:pass@host/v1','https://host/v1?key=secret','https://host/v1#secret'])assert.throws(()=>apiConfig({apiBaseUrl}));assert.throws(()=>apiConfig({apiProtocol:'unknown'}));});
test('legacy key only binds to old Gemini API, not new host or other protocol',()=>{
 assert.ok(keyMatches(null,{}));assert.ok(!keyMatches(null,{apiProtocol:'compatible'}));assert.ok(!keyMatches('gemini|https://generativelanguage.googleapis.com/v1beta',{apiProtocol:'gemini',apiBaseUrl:'https://example.com/v1beta'}));
});
test('Gemini and Claude have native request and response adapters',()=>{
 assert.equal(buildRequest({model:'gemini-example'},'FAKE','Hi').headers['x-goog-api-key'],'FAKE');
 const r=buildRequest({apiProtocol:'anthropic',model:'claude-example'},'FAKE','Hi');assert.equal(r.url,'https://api.anthropic.com/v1/messages');assert.equal(r.body.max_tokens,8192);
 assert.equal(responseText('anthropic',{stop_reason:'end_turn',content:[{type:'text',text:'OK'}]}),'OK');
 assert.equal(responseText('gemini',{candidates:[{finishReason:'STOP',content:{parts:[{thought:true,text:'secret'},{text:'OK'}]}}]}),'OK');
 assert.throws(()=>responseText('compatible',{choices:[{finish_reason:'length',message:{content:'{}'}}]}));
 assert.throws(()=>responseText('anthropic',{stop_reason:'max_tokens',content:[]}));
});
test('strict JSON parse fails without writing a partial or malformed draft',()=>{assert.deepEqual(parseJSON('```json\n{"ok":true}\n```'),{ok:true});for(const s of ['[]','null','Bad {"ok":true}','{"ok":'])assert.throws(()=>parseJSON(s));});
test('requests omit cookies, block redirects, sanitize provider errors and do not retry charges',async()=>{
 const real=globalThis.fetch;let calls=0;globalThis.chrome={permissions:{contains:async()=>true}};
 try{globalThis.fetch=async(url,opts)=>{calls++;assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');return {ok:false,status:429,json:async()=>({error:'FAKE private provider response'})};};
 await assert.rejects(generateText({apiProtocol:'compatible',model:'model'},'FAKE','Hello'),/429/);assert.equal(calls,1);
 globalThis.fetch=async()=>({ok:true,json:async()=>({choices:[{finish_reason:'stop',message:{content:'{"ok":true}'}}]})});assert.deepEqual(await generateText({apiProtocol:'compatible',model:'model'},'FAKE','Hello',{}),{ok:true});
 globalThis.fetch=async()=>({ok:true,json:async()=>({data:[{id:'vendor/model:free'}]})});assert.equal((await providerModels({apiProtocol:'compatible'},'FAKE'))[0].id,'vendor/model:free');
 globalThis.chrome.permissions.contains=async()=>false;await assert.rejects(generateText({apiProtocol:'compatible',model:'model'},'FAKE','Hello'),/cấp quyền/);
 }finally{globalThis.fetch=real;}
});
test('new CSV roundtrip and old v3 backward compatibility',async()=>{
 const d={settings:{mode:'manual',model:'vendor/model:free',apiProtocol:'compatible',apiBaseUrl:'https://example.com/v1',apiJsonMode:true},posts:[]};
 const csv=await exportProgressV3(d),parsed=readProgressFile(csv);assert.equal(parsed.profile.api_protocol,'compatible');assert.equal(parsed.profile.api_base_url,'https://example.com/v1');
 const oldCSV=await fs.readFile(new URL('./fixtures/legacy-progress-v3.csv',import.meta.url),'utf8');assert.equal(readProgressFile(oldCSV).profile.api_model,'gemini-example');
});
test('thread metadata cannot become spoken comments in structured Docs',()=>{
 const lines=['Phần 1 – Bài viết','Bài 1','Mã nguồn: https://www.facebook.com/example/posts/123','Trạng thái caption: present','Nội dung bài:','Caption','Phần 2 – Bình luận','Bình luận bài 1','Bạn nam 2 (Example): Hello','Liên kết hội thoại: {"kind":"comment","commentId":"1"}','Tình trạng hội thoại: {"complete":false}'];
 const posts=splitPosts(lines.map(text=>({runs:[{text}]})),docsSource('https://docs.google.com/document/d/example/edit'));assert.equal(posts[0].comments.length,1);assert.equal(posts[0].text,'Caption');
});
test('posting/media/autosave/mascot and manual send barriers preserved',async()=>{
 const hashes=JSON.parse(await fs.readFile(new URL('./fixtures/base-384-preserved-hashes.json',import.meta.url),'utf8'));
 for(const [file,expected] of Object.entries(hashes))assert.equal(createHash('sha256').update(await fs.readFile(new URL('../'+file,import.meta.url))).digest('hex'),expected,file);
});
