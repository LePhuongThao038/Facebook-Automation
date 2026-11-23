// Hồ sơ khách hàng (Post Research): chấm NHÂN KHẨU + 7 TRỤC tính cách/mua hàng từ trang cá nhân công khai của khách đã liên hệ.
// Trục 8 "Đã bị đối thủ tiếp cận" do agent khác làm: chỉ khai báo chỗ trống (EXTERNAL_AXES) và cách nạp (mergeExternal).
// Nguyên tắc: chỉ dùng thông tin công khai; mỗi điểm có bằng chứng; thiếu dữ liệu thì để null ("chưa đủ dữ liệu"), không gán đại;
// không suy đoán và không dùng làm bằng chứng các chủ đề nhạy cảm (sức khỏe, tôn giáo, chính trị, xu hướng tính dục).
globalThis.customerModel=(()=>{
 const SCHEMA='desk.customer-profile/1';
 const fold=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().replace(/\s+/g,' ').trim();
 // Từ khóa so khớp theo ranh giới từ. GIỮ DẤU khi bài viết có dấu: bỏ dấu làm từ khác nghĩa trùng nhau
 // ("lừa đảo" thành "lua dao" chứa "dao" = "đạo"; "đang" thành "dang" = "đảng"). Chỉ khi người viết gõ không dấu mới so bản bỏ dấu.
 const lower=s=>String(s||'').normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g,' ').trim();
 const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const bound=w=>new RegExp('(^|[^\\p{L}\\p{N}])'+esc(w)+'(?=$|[^\\p{L}\\p{N}])','u');
 const words=list=>list.map(x=>Array.isArray(x)?x:[x,1]).map(([w,k])=>({w,re:bound(lower(w)),reFold:bound(fold(w)),k}));
 const hasMarks=t=>/[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i.test(t);
 const match=(x,t)=>hasMarks(t)?x.re.test(lower(t)):x.reFold.test(fold(t));
 const SENSITIVE=words(['bệnh','ung thư','điều trị','bệnh viện','mang thai','có bầu','sảy thai','trầm cảm','thuốc','phật giáo','công giáo','tin lành','nhà thờ','đi chùa','cầu nguyện','đạo','đảng','chính phủ','biểu tình','bầu cử','chính trị','lgbt','đồng tính','gay','les','chuyển giới']);
 const AXES=[
  {id:'need_urgency',label:'Mức cần gấp',
   definition:'Khách đang chủ động tìm, hỏi hoặc so sánh một sản phẩm/dịch vụ trong thời gian gần đây.',
   low:'Không thấy dấu hiệu đang tìm mua gì.',high:'Vừa đăng hỏi, xin gợi ý hoặc nói cần gấp, nhất là đúng lĩnh vực của bạn.',
   cues:words([['cần tìm',2],['đang tìm',2],['ai biết',1.5],['ai có',1],['xin review',2],['xin tư vấn',2],['tư vấn giúp',2],['giới thiệu giúp',2],['recommend',1.5],['muốn mua',2],['định mua',2],['mua ở đâu',2],['ở đâu',1],['cần gấp',3],['gấp',1],['có ai',1],['help',1],['cứu',1],['nên mua',1.5],['nên chọn',1.5]])},
  {id:'spending_power',label:'Khả năng chi trả',
   definition:'Dấu hiệu công khai về mức chi tiêu: công việc, chỗ ở, du lịch, đồ dùng.',
   low:'Đang tìm việc, than hết tiền, sinh viên chưa đi làm.',high:'Chức vụ quản lý/chủ doanh nghiệp, du lịch nước ngoài thường xuyên, đồ dùng cao cấp.',
   cues:words([['du lịch',1],['resort',1.5],['khách sạn',1],['bay',0.5],['nhật bản',1],['hàn quốc',1],['singapore',1],['châu âu',1.5],['paris',1.5],['dubai',1.5],['iphone',0.5],['macbook',1],['mercedes',2],['bmw',2],['lexus',2],['porsche',2.5],['louis vuitton',2],['gucci',2],['chanel',2],['hermes',2.5],['rolex',2.5],['biệt thự',2],['penthouse',2],['golf',2],['vinhomes',1],['giám đốc',2],['ceo',2],['founder',2],['chủ doanh nghiệp',2],['trưởng phòng',1.5],['manager',1],['bác sĩ',1],['luật sư',1]]),
   anti:words([['thất nghiệp',2],['tìm việc',1.5],['xin việc',1.5],['hết tiền',2],['cháy túi',2],['nợ',1],['vay',1],['thiếu tiền',2],['nghèo',1.5]])},
  {id:'price_sensitivity',label:'Nhạy cảm giá',
   definition:'Mức khách quan tâm tới giá, khuyến mãi và so giá trước khi mua.',
   low:'Không nhắc giá; ưu tiên chất lượng, thương hiệu.',high:'Hay săn sale, mã giảm giá, hỏi giá, so giá giữa nhiều nơi.',
   cues:words([['sale',1.5],['săn sale',2],['giảm giá',2],['voucher',2],['mã giảm',2],['freeship',2],['flash sale',2],['khuyến mãi',1.5],['rẻ',1.5],['giá rẻ',2],['bao nhiêu',1],['giá',0.7],['so giá',2],['đắt',1.5],['hời',1.5],['tiết kiệm',1],['thanh lý',1.5],['pass lại',1.5]])},
  {id:'skepticism',label:'Mức hoài nghi',
   definition:'Mức khách cần bằng chứng, review thật và hay cảnh giác trước khi tin người bán.',
   low:'Dễ tin, mua theo cảm hứng, không nhắc review.',high:'Từng than bị lừa, bóc phốt, đòi review thật, cảnh giác hàng giả.',
   cues:words([['lừa',2],['lừa đảo',2.5],['scam',2.5],['bóc phốt',2.5],['phốt',2],['cảnh giác',2],['review thật',2],['uy tín',1],['hàng giả',2],['fake',1.5],['thất vọng',1.5],['không như quảng cáo',2.5],['kém chất lượng',2],['đừng mua',2],['tránh xa',2],['chất lượng kém',2]])},
  {id:'depth_need',label:'Cần tư vấn sâu',
   definition:'Mức khách muốn hiểu kỹ: hỏi chi tiết, đọc và viết dài, quan tâm chuyên môn.',
   low:'Bài ngắn, ít hỏi; cần câu trả lời gọn.',high:'Viết dài, hỏi "tại sao/so sánh", chia sẻ kinh nghiệm, trình độ học vấn cao.',
   cues:words([['tại sao',1.5],['vì sao',1.5],['so sánh',2],['kinh nghiệm',1.5],['phân tích',2],['chi tiết',1],['cách nào',1],['ưu nhược',2],['thông số',2],['nghiên cứu',1.5],['tìm hiểu',1.5]])},
  {id:'influence',label:'Mức ảnh hưởng',
   definition:'Số người theo dõi và mức tương tác trên bài của khách.',
   low:'Dưới vài trăm người theo dõi, bài ít tương tác.',high:'Hàng chục nghìn người theo dõi trở lên, bài có nhiều cảm xúc và bình luận.'},
  {id:'activity',label:'Độ hoạt động',
   definition:'Khách đăng bài gần đây và đều đặn đến mức nào (khả năng thấy và trả lời tin nhắn).',
   low:'Bài gần nhất đã lâu (vài tháng trở lên).',high:'Đăng nhiều bài trong 30 ngày qua, bài gần nhất trong vài ngày.'}
 ];
 // Trục do agent khác cung cấp. Chỉ hiển thị khi đã nạp dữ liệu hợp lệ (mergeExternal).
 const EXTERNAL_AXES=[{id:'competitor_exposure',label:'Đã bị đối thủ tiếp cận',owner:'agent khác (trục 8)',
  definition:'Mức khách đã bị các bên bán hàng khác tiếp cận trên bài công khai (đếm và phân loại bình luận chào hàng; không lưu danh tính các tài khoản đó).'}];
 const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));
 const sensitive=t=>SENSITIVE.some(x=>match(x,t));
 const hits=(t,list)=>(list||[]).filter(x=>match(x,t));
 const snippet=(t,max=140)=>{const s=String(t||'').replace(/\s+/g,' ').trim();return s.length>max?s.slice(0,max-1)+'…':s;};
 // "1,2K" "87K" "3,4 triệu" "1.234" -> số
 function count(v){const s=fold(v).trim();const m=s.match(/^(\d+(?:[.,]\d+)?)\s*(nghin|trieu|k|n|tr|m)?(?![a-z])/);if(!m)return null;let n=m[2]?parseFloat(m[1].replace(',','.')):parseFloat(m[1].replace(/[.,]/g,''));if(!Number.isFinite(n))return null;if(/^(k|n|nghin)$/.test(m[2]||''))n*=1e3;if(/^(tr|trieu|m)$/.test(m[2]||''))n*=1e6;return Math.round(n);}
 const confidence=n=>n>=4?'cao':n>=2?'trung bình':n>=1?'thấp':'không có';
 // Điểm từ bằng chứng từ khóa: tổng trọng số có giảm dần theo độ cũ, đổi sang 0..100 bằng hàm bão hòa.
 const saturate=(x,half)=>100*(1-Math.exp(-x/half));
 const recencyWeight=d=>d==null?0.6:d<=30?1:d<=90?0.7:d<=365?0.4:0.2;
 function keywordAxis(axis,posts,extraCues=[],aboutText=''){
  const ev=[];let pos=0,neg=0;
  const cues=[...(axis.cues||[]),...extraCues];
  posts.forEach((p,i)=>{if(sensitive(p.text))return;const h=hits(p.text,cues),a=hits(p.text,axis.anti);const w=recencyWeight(p.ageDays);
   if(h.length){const s=h.reduce((t,x)=>t+x.k,0)*w;pos+=s;ev.push({post:i,text:snippet(p.text),why:'có: '+h.map(x=>x.w).join(', '),weight:+s.toFixed(2)});}
   if(a.length){const s=a.reduce((t,x)=>t+x.k,0)*w;neg+=s;ev.push({post:i,text:snippet(p.text),why:'ngược: '+a.map(x=>x.w).join(', '),weight:-(+s.toFixed(2))});}});
  if(aboutText){const h=hits(aboutText,cues),a=hits(aboutText,axis.anti);if(h.length){const s=h.reduce((t,x)=>t+x.k,0);pos+=s;ev.push({post:-1,text:snippet(aboutText),why:'Giới thiệu có: '+h.map(x=>x.w).join(', '),weight:s});}if(a.length){const s=a.reduce((t,x)=>t+x.k,0);neg+=s;ev.push({post:-1,text:snippet(aboutText),why:'Giới thiệu ngược: '+a.map(x=>x.w).join(', '),weight:-s});}}
  ev.sort((x,y)=>Math.abs(y.weight)-Math.abs(x.weight));
  return {pos,neg,evidence:ev.slice(0,5),n:ev.length};
 }
 function scoreAxes(input){
  const posts=(input.posts||[]).filter(p=>p&&String(p.text||p.media||'').trim()!==''||p?.ageDays!=null);
  const usable=posts.filter(p=>!sensitive(p.text));
  const aboutText=(input.about||[]).flatMap(t=>t.sections||[]).map(s=>s.title+': '+s.values.join(' · ')).join(' | ');
  const product=String(input.productKeywords||'').split(/[,;\n]+/).map(s=>s.trim()).filter(s=>s.length>=2).slice(0,30);const productCues=words(product.map(s=>[s,2.5]));
  const out={};
  for(const axis of AXES){
   let score=null,ev=[],n=0,note='';
   if(axis.id==='influence'){
    const f=input.header?.followers??null,reacts=usable.map(p=>p.reactions).filter(Number.isFinite),avg=reacts.length?reacts.reduce((a,b)=>a+b,0)/reacts.length:null;
    if(f!=null||avg!=null){const fs=f!=null?clamp((Math.log10(Math.max(f,1))-2)*25):null,es=avg!=null?clamp((Math.log10(Math.max(avg,1)))*30):null;score=fs!=null&&es!=null?clamp(fs*0.6+es*0.4):fs??es;
     if(f!=null)ev.push({post:-1,text:f.toLocaleString('vi-VN')+' người theo dõi',why:'số người theo dõi',weight:fs});if(avg!=null)ev.push({post:-1,text:'Trung bình '+Math.round(avg).toLocaleString('vi-VN')+' cảm xúc/bài ('+reacts.length+' bài)',why:'tương tác',weight:es});n=ev.length;}
   }else if(axis.id==='activity'){
    const ages=posts.map(p=>p.ageDays).filter(Number.isFinite);
    if(ages.length){const last=Math.min(...ages),month=ages.filter(d=>d<=30).length;score=clamp(Math.max(0,100-last*1.2)*0.5+Math.min(month,12)/12*100*0.5);
     ev.push({post:-1,text:'Bài gần nhất: '+(last<1?'hôm nay':last+' ngày trước'),why:'độ mới',weight:last},{post:-1,text:month+' bài trong 30 ngày (trên '+ages.length+' bài đã đọc)',why:'tần suất',weight:month});n=2;}
   }else{
    const r=keywordAxis(axis,usable,axis.id==='need_urgency'?productCues:[],axis.id==='spending_power'||axis.id==='depth_need'?aboutText:'');n=r.n;ev=r.evidence;
    if(axis.id==='depth_need'&&usable.length){const lens=usable.map(p=>String(p.text||'').length),avg=lens.reduce((a,b)=>a+b,0)/lens.length,q=usable.filter(p=>/\?/.test(p.text||'')).length;
     r.pos+=Math.max(0,(avg-150)/150)+q*0.3;ev.push({post:-1,text:'Độ dài bài trung bình '+Math.round(avg)+' ký tự; '+q+' bài có câu hỏi',why:'cách viết',weight:+(Math.max(0,(avg-150)/150)+q*0.3).toFixed(2)});n++;
     if(/dai hoc|thac si|tien si|cao hoc|university|master/.test(fold(aboutText))){r.pos+=1.5;ev.push({post:-1,text:'Học vấn công khai: đại học trở lên',why:'học vấn',weight:1.5});n++;}}
    // Không có bằng chứng thì không gán đại: dưới 10 bài -> "chưa đủ dữ liệu"; từ 10 bài trở lên mà không thấy dấu hiệu -> thấp (10), tin cậy thấp.
    if(n>0){
     if(axis.id==='spending_power'){score=clamp(50+saturate(r.pos,3)/2-saturate(r.neg,2)/2);}
     else score=clamp(saturate(Math.max(0,r.pos-r.neg),axis.id==='depth_need'?3:4));
    }else if(usable.length>=10&&axis.id!=='spending_power'){score=10;note='Không thấy dấu hiệu trong '+usable.length+' bài đã đọc.';}
    else note='Không thấy dấu hiệu trong '+usable.length+' bài đã đọc; chưa đủ để kết luận.';
   }
   if(score==null)note=note||'Chưa đủ dữ liệu công khai.';
   out[axis.id]={score,confidence:score==null?'không có':axis.id==='influence'||axis.id==='activity'?'cao':n?confidence(n):'thấp',evidence:ev,note};
  }
  return out;
 }
 // Nhân khẩu: chỉ lấy từ thông tin công khai, ghi rõ nguồn. Ước tính (vd. tuổi theo năm tốt nghiệp) được đánh dấu là ước tính.
 function demographics(input,now=new Date()){
  const secs=(input.about||[]).flatMap(t=>(t.sections||[]).map(s=>({tab:t.tab,...s})));
  const pick=re=>secs.find(s=>re.test(fold(s.title)));
  const rows=[];const add=(key,label,value,source,estimate=false)=>{if(value)rows.push({key,label,value:String(value).slice(0,200),source,estimate});};
  const g=pick(/^(gioi tinh|gender)$/);add('gender','Giới tính',g?.values[0],'Giới thiệu › '+(g?.tab||''));
  const b=pick(/^(ngay sinh|sinh nhat|birthday|nam sinh|birth year)$/);
  if(b){const y=(b.values.join(' ').match(/(19|20)\d{2}/)||[])[0];add('age','Tuổi',y?(now.getFullYear()-Number(y))+' tuổi (sinh năm '+y+')':b.values[0],'Giới thiệu › '+(b.tab||''));}
  else{const hs=secs.find(s=>/trung hoc|high school/.test(fold(s.title))&&/tot nghiep nam (\d{4})|class of (\d{4})/.test(fold(s.values.join(' '))));
   if(hs){const y=Number((fold(hs.values.join(' ')).match(/tot nghiep nam (\d{4})|class of (\d{4})/)||[]).slice(1).find(Boolean));if(y>1950&&y<=now.getFullYear()+1)add('age','Tuổi','khoảng '+(now.getFullYear()-y+18)+' (ước tính theo năm tốt nghiệp THPT '+y+')','Giới thiệu › '+(hs.tab||''),true);}}
  const live=pick(/^(song tai|tinh\/thanh pho hien tai|thanh pho hien tai|current city|dia chi|vi tri)$/);add('lives','Sống tại',live?.values[0],'Giới thiệu › '+(live?.tab||''));
  const home=pick(/^(que quan|hometown)$/);add('hometown','Quê quán',home?.values[0],'Giới thiệu › '+(home?.tab||''));
  const work=pick(/^(cong viec|work|noi lam viec)$/);add('work','Công việc',work?.values[0],'Giới thiệu › '+(work?.tab||''));
  const edu=pick(/^(dai hoc|cao hoc|university|college|truong dai hoc)$/)||pick(/^(trung hoc|truong trung hoc|high school)$/);add('education','Học vấn',edu?.values[0],'Giới thiệu › '+(edu?.tab||''));
  const rel=pick(/^(moi quan he|tinh trang moi quan he|relationship)$/);add('relationship','Tình trạng quan hệ',rel?.values[0],'Giới thiệu › '+(rel?.tab||''));
  const cat=pick(/^(hang muc|category)$/);add('category','Hạng mục',cat?.values.join(', '),'Giới thiệu › '+(cat?.tab||''));
  if(input.header?.followers!=null)add('followers','Người theo dõi',input.header.followers.toLocaleString('vi-VN'),'Đầu trang cá nhân');
  if(input.header?.friends!=null)add('friends','Bạn bè',input.header.friends.toLocaleString('vi-VN'),'Đầu trang cá nhân');
  return rows;
 }
 function buildProfile(input,now=new Date()){
  if(!input?.url)throw Error('Thiếu link trang cá nhân.');
  return {schema:SCHEMA,id:input.id||crypto.randomUUID(),url:input.url,name:String(input.name||'').slice(0,120),analyzedAt:now.toISOString(),
   postsRead:(input.posts||[]).length,productKeywords:String(input.productKeywords||'').slice(0,300),
   demographics:demographics(input,now),axes:scoreAxes(input),manual:{},notes:'',external:input.external||{}};
 }
 // Agent trục 8 nạp kết quả theo định dạng: {schema:'desk.customer-axis/1', axis:'competitor_exposure', url, score:0..100|null,
 // evidence:[{text,why}], source, at}. url phải trùng hồ sơ. Không nhận danh tính bên thứ ba (tên/link tài khoản khác).
 function mergeExternal(profile,payload){
  if(payload?.schema!=='desk.customer-axis/1')throw Error('Sai định dạng trục ngoài (cần desk.customer-axis/1).');
  const def=EXTERNAL_AXES.find(a=>a.id===payload.axis);if(!def)throw Error('Trục ngoài không được khai báo: '+payload.axis);
  const norm=u=>{try{const x=new URL(u);const id=x.searchParams.get('id');return x.pathname==='/profile.php'&&id?'id:'+id:x.pathname.replace(/\/+$/,'').toLowerCase();}catch{return '';}};
  if(!norm(payload.url)||norm(payload.url)!==norm(profile.url))throw Error('Kết quả trục ngoài thuộc trang khác.');
  const score=payload.score==null?null:Number(payload.score);if(score!=null&&!(score>=0&&score<=100))throw Error('Điểm trục ngoài phải từ 0 đến 100.');
  const evidence=(payload.evidence||[]).slice(0,10).map(e=>({text:snippet(String(e.text||'').replace(/https?:\/\/\S+/g,'[link]')),why:String(e.why||'').slice(0,120)}));
  return {...profile,external:{...profile.external,[def.id]:{score:score==null?null:clamp(score),evidence,source:String(payload.source||'').slice(0,80),at:String(payload.at||new Date().toISOString()).slice(0,40)}}};
 }
 // Giá trị hiển thị: chỉnh tay (nếu có) ưu tiên hơn điểm tự động; giữ nguyên điểm tự động để đối chiếu.
 function axisValue(profile,id){const m=profile.manual?.[id];if(m&&Number.isFinite(m.score))return {score:m.score,manual:true};const a=profile.axes?.[id]??profile.external?.[id];return {score:a?.score??null,manual:false};}
 return {SCHEMA,AXES,EXTERNAL_AXES,fold,count,sensitive,scoreAxes,demographics,buildProfile,mergeExternal,axisValue};
})();
