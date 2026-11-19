// Keep original source text separate from labels generated for the selection list.
globalThis.researchCaption = (()=>{
 const normalize=s=>String(s||'').normalize('NFKC').replace(/[\u200b-\u200f\ufeff]/g,'').replace(/\s+/g,' ').trim();
 const clean=s=>String(s||'').replace(/(?:\s|\u00a0)*(?:xem thêm|see more)\s*$/i,'').trim();
 const comment=e=>{for(let p=e;p;p=p.parentElement){if(p.matches?.('[data-commentid],[data-comment-id]'))return true;if(p.matches?.('article,[role="article"]')&&/^(?:bình luận(?:\s|$)|phản hồi|đáp lại|comment(?:\s|$)|reply|replied)/i.test(p.getAttribute('aria-label')||''))return true;}return false;};
 function text(element){
  if(!element)return '';const clone=element.cloneNode(true);
  for(const e of clone.querySelectorAll('button,[role="button"],[role="menu"],[contenteditable="true"],script,style'))e.remove();
  for(const image of clone.querySelectorAll('img'))image.replaceWith(image.alt||'');
  const walk=node=>{if(node.nodeType===3)return node.nodeValue;if(node.nodeType!==1)return '';if(node.tagName==='BR')return '\n';const value=[...node.childNodes].map(walk).join('');return /^(DIV|P|LI)$/.test(node.tagName)?value+'\n':value;};
  return clean(walk(clone).replace(/\n{3,}/g,'\n\n'));
 }
 function read(scope){
  const postKey=raw=>{try{const u=new URL(raw,location.href);const id=u.searchParams.get('story_fbid')||u.searchParams.get('v')||u.searchParams.get('fbid')||u.pathname.match(/\/(?:posts|reels?|videos)\/([^/]+)/)?.[1];return id?'post:'+id:u.origin+u.pathname.replace(/\/$/,'');}catch{return '';}};
  const articles=[...scope.querySelectorAll('article,[role="article"]')].filter(e=>!comment(e));
  const matching=articles.filter(e=>[...e.querySelectorAll('a[href]')].some(a=>postKey(a.href)===postKey(location.href)));
  if(matching.length===1)scope=matching[0];else if(articles.length===1)scope=articles[0];
  const ambiguous=articles.length>1&&matching.length!==1;
  const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
  const blocked=e=>comment(e)||!!e.closest('button,[role="button"],h1,h2,h3,h4,h5,h6,[role="heading"],[role="navigation"],[role="menu"],[contenteditable="true"]');
  const explicit=[...scope.querySelectorAll('[data-ad-preview="message"],[data-ad-comet-preview="message"],[data-ad-rendering-role="story_message"],[data-testid="post_message"]')].filter(e=>visible(e)&&!blocked(e)&&(!ambiguous||!e.closest('article,[role="article"]')));
  const candidates=explicit.map(e=>({text:text(e),partial:/\bsee more\s*$|xem thêm\s*$/i.test(e.innerText||''),method:'message'})).filter(c=>c.text);
  if(candidates.length){const longest=candidates.sort((a,b)=>b.text.length-a.text.length)[0];return longest;}
  if(ambiguous)return {text:'',partial:false,method:'ambiguous'};
  // A real post may be an article. Exclude comment articles, not every article.
  const author=[...scope.querySelectorAll('h2 a,h3 a,h4 a,[role="heading"] a')].map(e=>normalize(e.innerText));
  // 0.2.22: chữ giao diện Facebook (logo, nhãn Reel, nhãn tác giả của bình luận) không phải caption.
  const controls=/^(?:facebook|reels?|thước phim|videos?|watch|của tác giả|ảnh của tác giả|âm thanh gốc|original audio|xem thêm|see more|like|thích|comment|bình luận|share|chia sẻ|reply|phản hồi|send|gửi|follow|theo dõi|following|đang theo dõi|tác giả|author|see translation|xem bản dịch|most relevant|phù hợp nhất|all comments|tất cả bình luận|\d+(?:[.,]\d+)?\s*(?:bình luận|comments?|shares?|lượt chia sẻ|reactions?|lượt thích|giờ|phút|ngày|hours?|minutes?|days?|h|m|d)|public|công khai|friends|bạn bè)$/i;
  const fallback=[...scope.querySelectorAll('div[dir="auto"],span[dir="auto"]')].filter(e=>visible(e)&&!blocked(e)&&!e.closest('a,time')&&!e.querySelector('h1,h2,h3,h4,[role="heading"],button,[role="button"],[contenteditable="true"]'));
  const outer=fallback.filter(e=>!fallback.some(other=>other!==e&&other.contains(e)));
  const values=outer.map(e=>({text:text(e),partial:/\bsee more\s*$|xem thêm\s*$/i.test(e.innerText||''),method:'text-block'})).filter(c=>c.text&&!controls.test(normalize(c.text))&&!author.includes(normalize(c.text)));
  // The first non-control text block precedes reactions/comments, including short captions/emoji.
  return values[0]||{text:'',partial:false,method:'missing'};
 }
 function choose(detail,preview){
  const a=typeof detail==='string'?{text:clean(detail),partial:false}:detail||{text:''};
  const b=typeof preview==='string'?{text:clean(preview),partial:false}:preview||{text:''};
  if(!a.text)return {...b,fallback:Boolean(b.text)};if(!b.text)return {...a,fallback:false};
  const x=normalize(a.text),y=normalize(b.text);
  if(x===y)return {...(a.partial&&!b.partial?b:a),fallback:false};
  if(y.startsWith(x)&&y.length>x.length)return {...b,fallback:true};
  return {...a,fallback:false}; // Never concatenate two differing candidates or AI-generated titles.
 }
 return {text,read,choose,normalize,clean,isComment:comment};
})();
