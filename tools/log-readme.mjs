// Tạo logs/README.md từ 3 file CSV thống kê: bảng theo nick, nhóm lỗi, bài mới nhất.
import fs from 'node:fs';
import path from 'node:path';
const [dir, out] = process.argv.slice(2);
function parse(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f.replace(/\r$/, '')); rows.push(row); row = []; f = ''; } else f += c; }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}
const read = name => parse(fs.readFileSync(path.join(dir, name), 'utf8').replace(/^﻿/, ''));
const md = s => String(s ?? '').replace(/\|/g, '\\|');
const sum = read('ThongKe-TongHop.csv'), all = read('ThongKe-TatCa.csv');
const now = new Date().toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'});
const lines = [`# Log tiến độ đăng bài`, ``, `Cập nhật tự động lúc **${now}** (giờ Việt Nam), lấy từ CSV tự lưu mới nhất của từng nick.`, ``,
  `File dữ liệu: [ThongKe-TongHop.csv](ThongKe-TongHop.csv) (theo nick) · [ThongKe-ChiTiet.csv](ThongKe-ChiTiet.csv) (bài đã lên Facebook) · [ThongKe-TatCa.csv](ThongKe-TatCa.csv) (mọi bài, cả lỗi). Lịch sử các lần cập nhật xem trong git log của thư mục này.`, ``,
  `## Theo nick`, ``, '| ' + [0, 1, 2, 3, 5, 6, 7, 8, 9].map(i => md(sum[0][i])).join(' | ') + ' |', '|' + ' --- |'.repeat(9)];
for (const r of sum.slice(1)) lines.push('| ' + [0, 1, 2, 3, 5, 6, 7, 8, 9].map(i => md(r[i])).join(' | ') + ' |');
// Nhóm lỗi theo loại (bỏ số cụ thể để gom).
const errs = new Map();
for (const r of all.slice(1)) if (r[3] === 'Lỗi, chưa đăng' && r[8]) {
  const key = r[8].replace(/\[UI:[^\]]*\]/g, '').replace(/\d+/g, '#').replace(/\s+/g, ' ').trim().slice(0, 140);
  const e = errs.get(key) || {n: 0, nicks: new Set()}; e.n++; e.nicks.add(r[0]); errs.set(key, e);
}
lines.push('', '## Lỗi chưa đăng, theo nhóm', '', '| Số bài | Lỗi | Nick |', '| --- | --- | --- |');
for (const [k, e] of [...errs].sort((a, b) => b[1].n - a[1].n)) lines.push(`| ${e.n} | ${md(k)} | ${md([...e.nicks].join(', '))} |`);
lines.push('', '## 30 bài bấm Đăng gần nhất', '', '| Giờ | Nick | Trạng thái | Caption | Link |', '| --- | --- | --- | --- | --- |');
const toTime = s => { const m = String(s).match(/(\d+):(\d+):(\d+) (\d+)\/(\d+)\/(\d+)/); return m ? Date.UTC(m[6], m[5] - 1, m[4], m[1], m[2], m[3]) : 0; };
for (const r of all.slice(1).filter(r => r[4]).sort((a, b) => toTime(b[4]) - toTime(a[4])).slice(0, 30))
  lines.push(`| ${md(r[4])} | ${md(r[0])} | ${md(r[3])} | ${md(r[10].slice(0, 60))} | ${r[9] ? '[link](' + r[9] + ')' : ''} |`);
fs.writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log('README:', out, '| nhóm lỗi:', errs.size);
