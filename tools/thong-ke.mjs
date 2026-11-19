// Thống kê số bài đã đăng theo từng nick từ CSV tự lưu của FB Desk.
// Chạy: node thong-ke.mjs  (hoặc bấm đúp ThongKe.cmd)
// Đầu ra (UTF-8 có BOM, mở thẳng bằng Excel / nhập vào Google Sheets):
//   ThongKe-TongHop.csv : mỗi nick một dòng
//   ThongKe-ChiTiet.csv : mỗi bài đã lên Facebook một dòng
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = process.argv[2] || path.join(process.env.LOCALAPPDATA, 'FacebookDesk', 'Autosave');
const today = new Date().toLocaleDateString('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'});

function parse(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false; } else field += c; }
    else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const cell = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const vnTime = iso => iso ? new Date(iso).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'}) : '';
const vnDate = iso => iso ? new Date(iso).toLocaleDateString('sv-SE', {timeZone: 'Asia/Ho_Chi_Minh'}) : '';

// Mỗi nick (UID) chỉ lấy file CSV tự lưu mới nhất; bỏ bản .previous, bản lưu theo phiên bản và file rỗng.
const latest = new Map();
// Tên nick lấy từ tên file tự lưu dạng "Tên nick · UID 123…__…csv" (kể cả các bản lưu cũ).
const nickByUid = new Map();
for (const name of fs.readdirSync(source)) {
  const m = name.match(/^(.+?) · UID (\d+)/);
  if (m && !/^Facebook Desk/.test(m[1])) nickByUid.set(m[2], m[1]);
}
for (const name of fs.readdirSync(source)) {
  if (!name.endsWith('.csv') || name.includes('.previous') || name.includes('Bản lưu')) continue;
  const full = path.join(source, name), mtime = fs.statSync(full).mtimeMs;
  const rows = parse(fs.readFileSync(full, 'utf8').replace(/^﻿/, ''));
  if (rows.length < 2) continue;
  const head = rows[0], col = key => head.findIndex(h => h.endsWith('| ' + key));
  const posts = rows.slice(1).filter(r => r[col('record_type')] === 'post' && r[col('status')]);
  if (!posts.length) continue;
  const uid = (posts.find(r => r[col('actor_uid')])?.[col('actor_uid')] || '').replace(/^'/, '') || name;
  const actorName = posts.find(r => r[col('actor_name')])?.[col('actor_name')] || '';
  const nick = nickByUid.get(uid) || (!/^UID \d+$/.test(actorName) && actorName) || name.replace(/__.*$/, '');
  if (!latest.has(uid) || latest.get(uid).mtime < mtime) latest.set(uid, {uid, nick, name, mtime, posts, col});
}

const summary = [], detail = [], everything = [];
const STATUS_VI = {success: 'Đã đăng', unknown: 'Đã bấm Đăng, chờ link', verifying: 'Đang tìm link', running: 'Đang xử lý', failed: 'Lỗi, chưa đăng', queued: 'Chờ đăng', draft: 'Nháp', cancelled: 'Đã hủy'};
for (const {uid, nick, name, mtime, posts, col} of [...latest.values()].sort((a, b) => a.nick.localeCompare(b.nick, 'vi'))) {
  const n = {link: 0, noLink: 0, pending: 0, running: 0, failed: 0, waiting: 0, today: 0};
  for (const r of posts) {
    const status = r[col('status')], url = r[col('post_url')], sent = r[col('published_at')];
    const onFacebook = status === 'success' || status === 'unknown' || status === 'verifying';
    if (status === 'success') url ? n.link++ : n.noLink++;
    else if (status === 'unknown' || status === 'verifying') n.pending++;
    else if (status === 'running') n.running++;
    else if (status === 'failed') n.failed++;
    else if (status === 'queued' || status === 'draft') n.waiting++;
    if (onFacebook && vnDate(sent) === today) n.today++;
    // Toàn bộ bài (thành công lẫn lỗi). Không xuất API key, media base64 hay dữ liệu bình luận.
    everything.push([nick, uid, r[col('post_number')], STATUS_VI[status] || status, vnTime(sent), vnTime(r[col('scheduled_at')]), r[col('image_count')], r[col('video_count')], (r[col('last_error')] || '').replace(/\s+/g, ' ').slice(0, 600), url, r[col('caption')].replace(/\s+/g, ' ').slice(0, 120), r[col('source_post_url')], r[col('post_id')]]);
    if (onFacebook) detail.push([nick, uid, vnTime(sent), status === 'success' ? (url ? 'Đã đăng (có link)' : 'Đã đăng (xác nhận, chưa có link)') : 'Đã bấm Đăng, chờ link', r[col('caption')].replace(/\s+/g, ' ').slice(0, 120), url, r[col('source_post_url')], r[col('post_id')]]);
  }
  summary.push([nick, uid, n.link + n.noLink + n.pending, n.link, n.noLink, n.pending, n.today, n.running, n.failed, n.waiting, posts.length, new Date(mtime).toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'}), name]);
}
const total = summary.reduce((t, r) => r.map((v, i) => typeof v === 'number' ? (t[i] || 0) + v : ''), []);
total[0] = 'TỔNG ' + summary.length + ' nick';

const write = (file, header, rows) => fs.writeFileSync(path.join(here, file), '﻿' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n'), 'utf8');
const summaryTable = {
  header: ['Nick', 'UID', 'Đã lên Facebook', 'Có link', 'Đã đăng, chưa có link', 'Đã bấm Đăng, chờ link', 'Lên FB hôm nay (' + today + ')', 'Đang xử lý', 'Lỗi, chưa đăng', 'Chờ đăng', 'Tổng bài trong hàng', 'CSV lưu lúc', 'File nguồn'],
  rows: [...summary, total]};
const detailTable = {
  header: ['Nick', 'UID', 'Giờ bấm Đăng', 'Trạng thái', 'Caption (120 ký tự)', 'Link bài', 'Bài nguồn', 'Mã bài'],
  rows: detail.sort((a, b) => a[0].localeCompare(b[0], 'vi') || String(b[2]).localeCompare(String(a[2])))};
write('ThongKe-TongHop.csv', summaryTable.header, summaryTable.rows);
write('ThongKe-ChiTiet.csv', detailTable.header, detailTable.rows);
write('ThongKe-TatCa.csv',
  ['Nick', 'UID', 'Bài số', 'Trạng thái', 'Giờ bấm Đăng', 'Giờ hẹn', 'Số ảnh', 'Số video', 'Lỗi gần nhất', 'Link bài', 'Caption (120 ký tự)', 'Bài nguồn', 'Mã bài'],
  everything.sort((a, b) => a[0].localeCompare(b[0], 'vi') || Number(a[2]) - Number(b[2])));

console.log('Nick'.padEnd(28) + 'Đã lên FB  Có link  Chờ link  Lỗi  Chờ đăng');
for (const r of [...summary, total]) console.log(String(r[0]).padEnd(28) + String(r[2]).padStart(8) + String(r[3]).padStart(9) + String(r[5]).padStart(10) + String(r[8]).padStart(5) + String(r[9]).padStart(10));
console.log('\nĐã ghi: ' + path.join(here, 'ThongKe-TongHop.csv') + '\n        ' + path.join(here, 'ThongKe-ChiTiet.csv'));

// Gửi lên Google Sheet qua Apps Script (ThongKe.gs) nếu đã điền ThongKe-config.json.
const configFile = path.join(here, 'ThongKe-config.json');
let config = {};
try { config = JSON.parse(fs.readFileSync(configFile, 'utf8')); } catch {}
if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(config.url || '') || !config.key) {
  console.log('\nChưa gửi lên Google Sheet: điền "url" (ứng dụng web Apps Script) và "key" vào ' + configFile);
} else {
  const at = new Date().toLocaleString('vi-VN', {timeZone: 'Asia/Ho_Chi_Minh'});
  try {
    const r = await fetch(config.url, {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body: JSON.stringify({key: config.key, at, summary: summaryTable, detail: detailTable}), signal: AbortSignal.timeout(90000)});
    const text = await r.text();
    let result; try { result = JSON.parse(text); } catch { result = {ok: false, error: 'Apps Script trả về không phải JSON (HTTP ' + r.status + '). Kiểm tra quyền truy cập "Bất kỳ ai".'}; }
    console.log(result.ok ? '\nĐã gửi lên Google Sheet "' + result.sheet + '": ' + result.nicks + ' dòng tổng hợp, ' + result.posts + ' bài chi tiết.' : '\nGửi Google Sheet thất bại: ' + result.error);
  } catch (error) { console.log('\nGửi Google Sheet thất bại: ' + error.message); }
}
