// Text APIs only. No provider can change the app's review/send permissions.
const defaults={gemini:'https://generativelanguage.googleapis.com/v1beta',compatible:'https://api.openai.com/v1',anthropic:'https://api.anthropic.com/v1'};
export function apiConfig(settings={}){
 const protocol=settings.apiProtocol||'gemini';
 if(!Object.hasOwn(defaults,protocol))throw Error('Kiểu API chưa được hỗ trợ.');
 let u;try{u=new URL(settings.apiBaseUrl||defaults[protocol]);}catch{throw Error('Địa chỉ API không hợp lệ.');}
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw Error('API cần địa chỉ HTTPS, không chứa key, tham số hoặc mật khẩu.');
 u.pathname=u.pathname.replace(/\/+$/,'').replace(/\/(?:chat\/completions|messages|models)$/,'');
 const base=u.href.replace(/\/$/,'');
 return {protocol,base,origin:u.origin+'/*',binding:protocol+'|'+base};
}
export function validModel(value,protocol){
 const model=String(value||'').trim();
 if(!model||model.length>200||!(/^[\w./:@+-]+$/).test(model)||(protocol==='gemini'&&!/^[\w.-]+$/.test(model)))throw Error('Nhập đúng mã model do nhà cung cấp công bố.');
 return model;
}
export function keyMatches(binding,settings){const c=apiConfig(settings);return binding?binding===c.binding:c.binding==='gemini|'+defaults.gemini;}
export function buildRequest(settings,key,prompt,schema){
 const c=apiConfig(settings),model=validModel(settings.model,c.protocol);
 if(!key)throw Error('Chưa có API key cho địa chỉ API này.');
 const headers={'Content-Type':'application/json'};let path,body;
 const input=schema?prompt+'\nChỉ trả một đối tượng JSON, không markdown. Cấu trúc yêu cầu: '+JSON.stringify(schema):prompt;
 if(c.protocol==='gemini'){
  headers['x-goog-api-key']=key;path='/models/'+encodeURIComponent(model)+':generateContent';
  body={contents:[{role:'user',parts:[{text:input}]}],...(schema?{generationConfig:{responseMimeType:'application/json',responseSchema:schema}}:{})};
 }else if(c.protocol==='anthropic'){
  headers['x-api-key']=key;headers['anthropic-version']='2023-06-01';headers['anthropic-dangerous-direct-browser-access']='true';
  path='/messages';body={model,max_tokens:8192,messages:[{role:'user',content:input}]};
 }else{
  headers.Authorization='Bearer '+key;path='/chat/completions';body={model,messages:[{role:'user',content:input}],stream:false};
  if(schema&&settings.apiJsonMode)body.response_format={type:'json_object'};
 }
 return {url:c.base+path,headers,body};
}
export function responseText(protocol,data){
 if(protocol==='gemini'){
  const c=data.candidates?.[0];if(!c||c.finishReason&&c.finishReason!=='STOP')throw Error('AI chưa trả nội dung hoàn chỉnh.');
  return (c.content?.parts||[]).filter(p=>!p.thought).map(p=>p.text||'').join('');
 }
 if(protocol==='anthropic'){
  if(data.stop_reason!=='end_turn')throw Error('AI chưa kết thúc câu trả lời.');
  return (data.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('');
 }
 const c=data.choices?.[0];if(!c||c.finish_reason!=='stop'||c.message?.refusal)throw Error('AI chưa trả nội dung hoàn chỉnh hoặc đã từ chối yêu cầu.');
 return typeof c.message?.content==='string'?c.message.content:(c.message?.content||[]).filter(p=>p.type==='text').map(p=>p.text).join('');
}
export function parseJSON(text){
 const clean=String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'');
 try{const value=JSON.parse(clean);if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw Error('AI chưa trả đối tượng JSON hợp lệ. Không thay đổi bản nháp.');}
}
async function request(settings,path,key,body){
 const c=apiConfig(settings);
 if(!key)throw Error('Nhập API key của nhà cung cấp đã chọn.');
 if(!await chrome.permissions.contains({origins:[c.origin]}))throw Error('Chưa cấp quyền kết nối API. Mở Cài đặt rồi bấm Kiểm tra kết nối.');
 let res;try{res=await fetch(c.base+path,{method:body?'POST':'GET',headers:body?.headers||(c.protocol==='gemini'?{'x-goog-api-key':key}:c.protocol==='anthropic'?{'x-api-key':key,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'}:{Authorization:'Bearer '+key}),...(body?{body:JSON.stringify(body.body)}:{}),credentials:'omit',redirect:'error',signal:AbortSignal.timeout(90000)});}catch{throw Error('Không kết nối được API. Kiểm tra địa chỉ, mạng và quyền truy cập.');}
 if(!res.ok)throw Error(res.status===429?'API hết hạn mức hoặc đang giới hạn tốc độ (429).':res.status===401||res.status===403?'API key không hợp lệ hoặc thiếu quyền ('+res.status+').':res.status===402?'Tài khoản API chưa đủ số dư (402).':res.status===404?'Không tìm thấy model hoặc địa chỉ API (404).':'API trả lỗi HTTP '+res.status+'. Không tự gửi lại để tránh tính phí lặp.');
 try{return await res.json();}catch{throw Error('API không trả dữ liệu JSON.');}
}
export async function generateText(settings,key,prompt,schema){
 const req=buildRequest(settings,key,prompt,schema),c=apiConfig(settings);
 const data=await request(settings,req.url.slice(c.base.length),key,req);
 const text=responseText(c.protocol,data);if(!text.trim())throw Error('AI trả nội dung trống.');return schema?parseJSON(text):text;
}
export async function providerModels(settings,key){
 const c=apiConfig(settings),data=await request(settings,c.protocol==='gemini'?'/models?pageSize=1000':'/models',key);
 const rows=c.protocol==='gemini'?(data.models||[]).filter(m=>m.supportedGenerationMethods?.includes('generateContent')):data.data||data.models||[];
 if(!Array.isArray(rows))throw Error('API không có danh sách model chuẩn. Bạn có thể nhập mã model trực tiếp.');
 return rows.map(m=>({id:String(m.id||m.name||'').replace(/^models\//,''),name:String(m.displayName||m.display_name||m.id||m.name||'')})).filter(m=>m.id).slice(0,2000);
}
