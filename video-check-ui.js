// [3.6.2-video] Module mới. Nút "Kiểm tra dung lượng video" trong mục Media Bridge.
import { mb } from './video-probe.js';

const $ = id => document.getElementById(id);
const LABEL = { ok: 'Vừa 200 MB', unknown: 'Chưa rõ dung lượng (sẽ giới hạn 200 MB khi tải)', too_big: 'Vượt 200 MB, sẽ bỏ qua', error: 'Không đọc được video' };

async function request(type, values = {}) {
  const r = await chrome.runtime.sendMessage({ type, ...values });
  if (!r?.ok) throw Error(r?.error || 'Extension chưa phản hồi. Thử tải lại.');
  return r.data;
}

function render(box, data) {
  box.replaceChildren();
  if (data.unsupported) {
    box.textContent = 'Media Bridge chưa trả thông tin kiểm tra dung lượng. Bấm Start Video ngay trong mục này, chờ báo kết nối rồi kiểm tra lại.';
    return;
  }
  if (!data.rows.length) {
    box.textContent = 'Không có bài video nào chưa đăng.';
    return;
  }
  const count = status => data.rows.filter(r => r.status === status).length;
  const summary = document.createElement('p');
  summary.textContent = `${data.rows.length} video: ${count('ok')} vừa, ${count('unknown')} chưa rõ, ${count('too_big')} vượt 200 MB, ${count('error')} lỗi đọc.`;
  const list = document.createElement('ul');
  for (const row of data.rows) {
    const item = document.createElement('li');
    const name = (row.number ? 'Bài ' + row.number + ' · ' : '') + (row.title || 'Không tên');
    item.textContent = `${name}: ${LABEL[row.status] || row.status}` + (row.bytes ? ' · ' + mb(row.bytes) : '') + (row.status === 'error' && row.error ? ' · ' + row.error : '');
    if (row.status === 'too_big' || row.status === 'error') item.style.fontWeight = '600';
    list.append(item);
  }
  box.append(summary, list);
}

$('video-probe-all')?.addEventListener('click', async event => {
  const button = event.currentTarget, box = $('video-probe-result');
  button.disabled = true;
  box.textContent = 'Đang hỏi thông tin từng video (không tải)…';
  try { render(box, await request('video-probe-all')); }
  catch (error) { box.textContent = error.message; }
  finally { button.disabled = false; }
});
