export function gatewayOrigin(value){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('Nhập tên miền HTTPS riêng của gateway, không kèm đường dẫn.');
 return url.origin;
}
export async function teamCall(route,body={}){
 const {deskGateway:g}=await chrome.storage.local.get('deskGateway');
 if(!g?.token)throw Error('Chưa cấu hình mã máy trong Cài đặt GPT.');
 const response=await fetch(gatewayOrigin(g.origin)+'/'+route,{method:'POST',redirect:'error',credentials:'omit',headers:{Authorization:'Bearer '+g.token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(95000)});
 const data=await response.json();if(!response.ok)throw Error(data.error||'Gateway HTTP '+response.status);return data;
}
