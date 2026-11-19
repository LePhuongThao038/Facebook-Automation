import http from 'node:http';

const origin = 'chrome-extension://eohaljnaeegaegeplcanfklhaoafhhcm';
const actions = ['wait_for_feed', 'restore_focus', 'reapply_date', 'reopen_timeline', 'stop'];
let busy = false;
const server = http.createServer(async (req, res) => {
  const reply = (code, value) => {
    res.writeHead(code, {'Content-Type':'application/json', 'Access-Control-Allow-Origin':origin, 'Cache-Control':'no-store'});
    res.end(JSON.stringify(value));
  };
  if (req.headers.origin !== origin || req.url !== '/recover' || req.headers.host !== '127.0.0.1:47832') return reply(403, {});
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST','Access-Control-Allow-Headers':'Content-Type'});
    return res.end();
  }
  if (req.method !== 'POST' || req.headers['content-type'] !== 'application/json') return reply(400, {});
  if (busy) return reply(429, {});
  busy = true;
  try {
    let body = '';
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 512) return reply(413, {});
    }
    const {attempts, count, hasDate, responsive} = JSON.parse(body);
    if (attempts !== 3 || !Number.isSafeInteger(count) || count < 0 || typeof hasDate !== 'boolean' || typeof responsive !== 'boolean') return reply(400, {});
    if (!process.env.OPENAI_API_KEY) return reply(503, {error:'Chưa cấu hình OPENAI_API_KEY trên máy.'});
    const choices = actions.filter(action=>hasDate || action !== 'reapply_date');
    const response = await fetch('https://api.openai.com/v1/responses', {
      method:'POST', headers:{Authorization:'Bearer '+process.env.OPENAI_API_KEY,'Content-Type':'application/json'},
      signal:AbortSignal.timeout(45000),
      body:JSON.stringify({model:'gpt-6-astra',store:false,reasoning:{effort:'low'},max_output_tokens:1000,
        instructions:'Choose one recovery action for a stalled Facebook timeline. Three local attempts already tried scrolling, restoring focus, and applying an available date filter. Prefer a viable continuation. Stop if none is useful.',
        input:JSON.stringify({count,hasDate,responsive}),
        text:{format:{type:'json_schema',name:'recovery',strict:true,schema:{type:'object',properties:{action:{type:'string',enum:choices}},required:['action'],additionalProperties:false}}}})
    });
    if (!response.ok) return reply(502,{error:'OpenAI trả về HTTP '+response.status});
    const result=await response.json();
    const message=result.output?.flatMap(item=>item.content||[]).find(item=>item.type==='output_text');
    const {action}=JSON.parse(message?.text||'{}');
    if (!choices.includes(action)) return reply(502,{error:'Astra chưa chọn được thao tác hợp lệ.'});
    reply(200,{action});
  } catch { reply(502,{error:'Không nhận được phản hồi hợp lệ từ Astra.'}); }
  finally { busy=false; }
});
server.listen(47832,'127.0.0.1',()=>console.log('Astra connector ready on 127.0.0.1:47832'));
