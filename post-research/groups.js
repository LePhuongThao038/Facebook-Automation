function commentGroup(name, messages, post) {
  const words = name.normalize('NFC').toLowerCase().split(/[^\p{L}]+/u);
  const text = messages.join('\n').normalize('NFC').toLowerCase();
  const sales = /dịch vụ|sản phẩm|bán|đặt hàng|chốt đơn|tư vấn|workshop|khóa học|khoá học|báo giá|mở đơn|tuyển sinh/i.test(post);
  if (sales && /giá (?:bao nhiêu|sao|thế nào)|bao tiền|báo giá|xin giá|đặt (?:mua|hàng)|chốt (?:đơn|cho)|xin (?:thông tin|tư vấn)|còn hàng|đăng ký|bên (?:anh|chị|mình) có|mua ở đâu|xin mua/i.test(text)) return 'Khách hàng';
  if (/^(?:mẹ|bố|ba|ông nội|bà nội|ông ngoại|bà ngoại)\s/u.test(words.join(' ')) || /(?:mẹ|bố|ba) (?:hiểu|dặn|nhớ|tự hào về) con|con (?:trai|gái) của (?:mẹ|bố|ba)/u.test(text)) return 'Người thân bậc trên';
  if (/^(?:thầy|sư phụ|cô giáo)\s/u.test(words.join(' ')) || /(?:thầy|sư phụ) (?:dặn|khuyên|mong) (?:em|con|trò)/u.test(text)) return 'Sư phụ';
  const femaleNames = /^(?:thị|thuỳ|thùy|thuý|thúy|huyền|trang|hương|lan|mai|ngọc|thảo|nhung|linh|yến|quỳnh|my|nhi|dung|hạnh|liên|loan|oanh|nga|ngân|diễm|tuyết|chi|trâm|phượng|hồng|diệu|trinh)$/u;
  const female = words[0] === 'chị' || words[0] === 'cô' || (words[0] !== 'anh' && (words.includes('thị') || femaleNames.test(words.at(-1)) || words.some(w => /^(?:huyền|quỳnh|diễm|thùy|thuỳ|thúy|thuý)$/.test(w))));
  if (/^(?:chị|cô)\s/u.test(name.toLowerCase()) || /(?:cho chị|chị (?:chúc|mừng|thấy|nhớ|hỏi))/.test(text)) return 'Đàn chị';
  if (/^anh\s/u.test(name.toLowerCase()) || /(?:cho anh|anh (?:chúc|mừng|nhớ)) (?:em|chú)/.test(text)) return 'Đàn anh';
  if (/(?:giỏi|đẹp|tuyệt|chúc mừng|nhé|nhỉ|cố lên) (?:quá )?(?:em|chú)(?:[\s!.?,]|$)|(?:ông em|em zai)/.test(text)) return female ? 'Đàn chị' : 'Đàn anh';
  if (/(?:^|\s)(?:em|e) (?:thấy|xin|chúc|muốn|hỏi|theo|cảm ơn)|(?:^|\s)(?:anh|chị|thầy|sư phụ)(?:[\s,!.?]|$)| ạ(?:[\s!.?,]|$)/.test(text)) return female ? 'Đàn em nữ' : 'Đàn em nam';
  return female ? 'Bạn nữ' : 'Bạn nam';
}

function groupedComments(post) {
  const comments = post.comments || [];
  const people = new Map(), groups = new Map();
  const identity = c => c.personKey || (c.originalName || c.name).trim().normalize('NFC').toLowerCase();
  const author = c => c.isAuthor || c.name === 'Tác giả';
  for (const c of comments) {
    if (author(c)) continue;
    const key = identity(c);
    if (!people.has(key)) people.set(key, {name:c.name, messages:[]});
    people.get(key).messages.push(c.text);
  }
  for (const person of people.values()) {
    const group = commentGroup(person.name, person.messages, post.body || '');
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(person);
  }
  for (const [group, members] of groups) {
    members.forEach((person, i) => person.label = members.length === 1 ? group : group + ' ' + (i+1));
  }
  return comments.map(c => ({...c, name:author(c) ? 'Tác giả' : people.get(identity(c)).label}));
}

function* researchSections(posts, mode = document.getElementById('commentMode').value) {
  yield {title:'Phần 1 – Bài viết',kind:'posts',items:posts};
  yield {title:'Phần 2 – Bình luận',kind:'comments',items:posts.map(post=>{
    const grouped=groupedComments(post);
    return {...post,comments:(post.comments||[]).map((c,i)=>{
      const original=c.isAuthor||c.name==='Tác giả'?'Tác giả':c.originalName||c.name;
      return {...c,name:mode==='group'?grouped[i].name:mode==='original'?original:grouped[i].name===original?original:grouped[i].name+' ('+original+')'};
    })};
  })};
}
// One shared output contract for Word, clipboard and native Google Docs.
function researchLines(posts,mode,offset=0){
 const lines=[];
 for(const section of researchSections(posts,mode)){
  lines.push({t:section.title,h:true});
  section.items.forEach((post,i)=>{
   const number=offset+i+1;
   if(section.kind==='posts'){
    lines.push({t:'Bài '+number,h:true},{t:'Mã nguồn: '+post.url});
    if(post.location)lines.push({t:'Địa điểm: '+post.location});
    lines.push({t:'Trạng thái caption: '+(post.body?.trim()?'present':post.captionState==='no_caption'?'no_caption':'unreadable')},{t:'Kiểm tra caption: '+JSON.stringify({partial:Boolean(post.captionPartial),evidence:post.captionEvidence||'source-text'})});
    lines.push({t:'Nội dung bài:'},{t:post.body||''});
    for(const im of post.pics||[])lines.push({t:'',im});
    if(post.video){const kind=post.sourceKind==='reel'||/\/reels?\//i.test(post.url)?'reel':'video';lines.push({t:'Loại bài: '+kind},{t:'Media JSON: '+JSON.stringify({schema:'desk.media/1',kind,sourceUrl:post.url})});}
   }else{
    lines.push({t:'Bình luận bài '+number,h:true});
    for(const c of post.comments||[])lines.push({t:c.name+': '+c.text,depth:c.depth||0});
   }
  });
 }
 return lines;
}
