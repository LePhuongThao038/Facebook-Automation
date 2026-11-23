// Sinh customer-profile/KHAI-NIEM.md từ concepts.js + customer-model.js (một nguồn duy nhất).
// Chạy: node customer-profile/build-glossary.mjs      (tests/customer-profile.mjs kiểm tra tệp luôn khớp)
import {readFileSync,writeFileSync} from 'node:fs';
import vm from 'node:vm';
const here=new URL('./',import.meta.url);
export function loadSources(){
 const ctx={crypto:globalThis.crypto,console,URL};vm.createContext(ctx);
 for(const f of ['customer-model.js','concepts.js'])vm.runInContext(readFileSync(new URL(f,here),'utf8'),ctx);
 return {M:ctx.customerModel,C:ctx.customerConcepts};
}
export function buildGlossary({M,C}){
 const L=[];const p=s=>L.push(s);
 const item=e=>{if(e.definition)p(e.definition+'\n');if(e.signs?.length)p('- **Dấu hiệu nhận biết:** '+e.signs.join('; ')+'.');if(e.example)p('- **Ví dụ:** '+e.example);if(e.notConfused)p('- **Không nhầm với:** '+e.notConfused);if(e.signs?.length||e.example||e.notConfused)p('');};
 p('# Khái niệm và mốc chuẩn phân loại khách hàng');p('');
 p('> Tệp này được SINH TỰ ĐỘNG từ `customer-profile/concepts.js` và `customer-profile/customer-model.js` (phiên bản khái niệm '+C.version+'). Muốn sửa định nghĩa thì sửa `concepts.js` rồi chạy `node customer-profile/build-glossary.mjs`. Giao diện (nút "?") và bộ chấm điểm dùng đúng các định nghĩa này.');p('');
 p('Người và agent dùng tệp này làm **mốc chuẩn** khi đọc hồ sơ hoặc phân loại tay. Chỉ dùng thông tin **công khai** của khách **đã liên hệ**.');p('');
 p('## Khái niệm chung');p('');
 for(const g of C.general){p('### '+g.term);p('');item(g);}
 p('## Radar 1: Nhân khẩu');p('');
 p('Mỗi trục là một **thang đo** 0–100, chia thành các mức. Mức có tên trùng Sheet "Nhân cách" (Tuổi, Thu nhập, Đẳng cấp) dùng để điền Sheet.');p('');
 for(const a of M.DEMO_AXES){const c=C.axes[a.id]||{};
  p('### '+a.label+(a.sheet?' (cột Sheet: '+a.sheet+')':''));p('');p((c.definition||a.definition)+'\n');
  p('| Mức | Điểm | Mô tả ngắn |');p('|---|---|---|');for(const [lo,hi,name,short] of a.bands)p('| '+name+' | '+lo+'–'+hi+' | '+(short||'')+' |');p('');
  for(const [,, name] of a.bands){const lv=c.levels?.[name];if(!lv)continue;p('#### '+name);p('');item(lv);}
 }
 p('## Radar 2: Tính cách');p('');
 p('Chấm theo **cách viết trên bài công khai**, không phải chẩn đoán tâm lý. Mốc chung: **0–20** gần như không thấy · **21–54** có thể hiện · **55–100** nét nổi bật. Bốn nét đầu là nhóm "Cá tính" của Sheet.');p('');
 for(const a of M.TRAIT_AXES){const c=C.axes[a.id]||{};
  p('### '+a.label+(a.sheet?' (nhóm Cá tính trong Sheet)':''));p('');item({...c,definition:c.definition||a.definition});
  p('- **Điểm thấp:** '+a.low);p('- **Điểm cao:** '+a.high);p('');}
 p('## Radar 3: 8 trục mua hàng (agent khác)');p('');
 p('Không chấm trong extension này. Agent phụ trách gửi kết quả theo định dạng `'+M.BUYING_SCHEMA+'` (xem README); định nghĩa từng trục lấy từ trường `definition` trong kết quả đó và hiện ở nút "?" của trục.');p('');
 p('## Quy tắc điền Sheet "Nhân cách"');p('');for(const r of C.sheetRules)p('- '+r);p('');
 return L.join('\n');
}
if(import.meta.url===`file:///${process.argv[1]?.replace(/\\/g,'/')}`||process.argv[1]?.endsWith('build-glossary.mjs')){
 writeFileSync(new URL('KHAI-NIEM.md',here),buildGlossary(loadSources()),'utf8');console.log('Đã sinh customer-profile/KHAI-NIEM.md');
}
