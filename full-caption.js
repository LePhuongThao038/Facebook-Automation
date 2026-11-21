// 3.8.7-cap: lấy lại caption ĐẦY ĐỦ cho bài Post Research đánh dấu "rút gọn" (caption kết thúc bằng "…",
// do đọc từ timeline mà không bấm "Xem thêm"). Trước đây bài bị chặn hẳn; nay bot đọc lại từ bài gốc:
// Reel/video qua Media Bridge (/probe, yt-dlp), ảnh/bài viết bằng phiên đăng nhập của chính nick.
// Chỉ nhận caption bắt đầu ĐÚNG bằng đoạn đã có. Không lấy được thì đăng đoạn đã có, bỏ dấu "…".

const IGNORABLE = /[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\p{Default_Ignorable_Code_Point}\s…]/gu;
export const flatCaption = value => String(value || '').normalize('NFKC').replace(IGNORABLE, '').replace(/\.{3}$/, '').toLowerCase();

// Đoạn caption đã có, bỏ "…", "...", "Xem thêm" ở cuối.
export function truncatedPrefix(text) {
  return String(text || '').replace(/\s*(?:…|\.{3})?\s*(?:xem thêm|see more)?\s*$/i, '').replace(/\s*(?:…|\.{3})\s*$/, '').trimEnd();
}

// Caption lấy về chỉ được nhận khi dài hơn và bắt đầu bằng đúng đoạn đã có (so khớp bỏ emoji/khoảng trắng,
// vì Facebook vẽ emoji bằng ảnh).
export function acceptRecovered(prefix, full) {
  const a = flatCaption(prefix), b = flatCaption(full);
  return a.length >= 4 && b.length > a.length && b.startsWith(a);
}

export function isVideoSource(url) {
  try { const u = new URL(url); return /^\/(?:reels?|videos)\/|\/videos\/|^\/watch\/?$/.test(u.pathname); } catch { return false; }
}

// Chạy trong tab Facebook đang mở bài gốc. Lượt đầu bấm "Xem thêm" của khối chứa đoạn đã có;
// các lượt sau đọc khối caption bắt đầu bằng đoạn đó (khối bình luận bắt đầu bằng tên người, nên bị loại).
export function readFullCaption(request) {
  const flat = value => String(value || '').normalize('NFKC').replace(/[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\p{Default_Ignorable_Code_Point}\s…]/gu, '').replace(/\.{3}$/, '').toLowerCase();
  const want = flat(request.prefix);
  if (want.length < 4) return {error: 'Đoạn caption quá ngắn để đối chiếu.'};
  const head = want.slice(0, 40);
  const visible = el => el.getClientRects().length > 0;
  const textOf = el => {
    const copy = el.cloneNode(true);
    for (const img of copy.querySelectorAll('img[alt]')) img.replaceWith(document.createTextNode(img.alt));
    for (const br of copy.querySelectorAll('br')) br.replaceWith(document.createTextNode('\n'));
    for (const block of copy.querySelectorAll('div,p')) block.append(document.createTextNode('\n'));
    for (const b of copy.querySelectorAll('[role="button"],button')) if (/^(xem thêm|see more|ẩn bớt|see less)$/i.test((b.textContent || '').trim())) b.remove();
    return copy.textContent.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  };
  const blocks = [...document.querySelectorAll('[data-ad-rendering-role="story_message"],[data-ad-preview="message"],[data-ad-comet-preview="message"],div[dir="auto"],span[dir="auto"]')]
    .filter(el => visible(el) && !el.closest('[contenteditable="true"],[role="textbox"],form'));
  const hits = blocks.filter(el => flat(textOf(el)).startsWith(head));
  if (!hits.length) return {found: false, blocks: blocks.length};
  if (request.expand) {
    for (const el of hits) {
      const scope = el.parentElement?.parentElement || el;
      const more = [...scope.querySelectorAll('[role="button"],button')].find(b => visible(b) && /^(xem thêm|see more)$/i.test((b.innerText || '').trim()) && !b.dataset.deskFullCaption);
      if (more) { more.dataset.deskFullCaption = '1'; more.click(); return {expanding: true}; }
    }
  }
  let best = '';
  for (const el of hits) {
    if (el.querySelector('[role="article"],ul,[role="textbox"]')) continue;
    const text = textOf(el);
    if (text.length > 6000 || !flat(text).startsWith(want.slice(0, Math.min(want.length, 200)))) continue;
    if (text.length > best.length) best = text;
  }
  return best ? {found: true, text: best} : {found: false, hits: hits.length};
}
