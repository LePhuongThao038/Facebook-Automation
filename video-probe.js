import {MEDIA_LIMIT_MB} from './media-transfer.js';
// [3.6.2-video] Module mới. Xem CHANGES-3.6.2-VIDEO.md.
// Hỏi Media Bridge dung lượng video (không tải) để bỏ qua bài vượt 200 MB trước khi tải.
// Không đụng tới facebook-bot.js / automation.js / runner.js.
export const PROBE_KEY = 'deskVideoProbe200';
const BRIDGE = 'http://127.0.0.1:47833';
const KEEP_MS = 24 * 3600 * 1000;
const MB = 1024 * 1024;

export const mb = bytes => (Number.isFinite(bytes) && bytes > 0 ? (bytes / MB).toFixed(1) + ' MB' : 'chưa rõ dung lượng');

// Thông báo phải chứa "vượt 200 MB" để automation.js coi là lỗi không tự thử lại.
export const tooBigMessage = result => 'Video vượt 200 MB (' + mb(result?.bytes) + '); bỏ qua bài này, không tự thử lại.';

export function videoManifests(post) {
  return (post?.media || []).filter(m => m?.manifest && m.manifest.schema === 'desk.media/1' && ['video', 'reel'].includes(m.manifest.kind));
}

async function readStore(storage) {
  try { return (await storage.get(PROBE_KEY))[PROBE_KEY] || {}; } catch { return {}; }
}
async function saveResult(storage, url, result, now) {
  try {
    const store = await readStore(storage);
    for (const [key, value] of Object.entries(store)) if (!(now - (value?.at || 0) <= KEEP_MS)) delete store[key];
    store[url] = { status: result.status, bytes: result.bytes ?? null, exact: !!result.exact, at: now, maxMB: result.maxMB };
    await storage.set({ [PROBE_KEY]: store });
  } catch {}
}

// Trả về {status:'ok'|'unknown'|'too_big'|'error'|'unsupported', bytes?, error?}.
// 'unsupported' = bridge cũ (3.6.1) chưa có /probe hoặc bridge chưa chạy: để luồng cũ xử lý.
export async function probeVideo(manifest, { fetchImpl = fetch, signal, storage = globalThis.chrome?.storage?.local, now = Date.now() } = {}) {
  let r;
  try {
    r = await fetchImpl(BRIDGE + '/probe', {
      method: 'POST', credentials: 'omit', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schema: manifest.schema, kind: manifest.kind, sourceUrl: manifest.sourceUrl }),
      signal: signal || AbortSignal.timeout(90000),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    return { status: 'unsupported', error: 'Chưa kết nối được Media Bridge.' };
  }
  if (r.status === 403 || r.status === 404) return { status: 'unsupported', error: 'Media Bridge bản cũ, chưa có kiểm tra dung lượng.' };
  if (!r.ok) return { status: 'error', error: (await r.text().catch(() => '')).slice(0, 300) || 'HTTP ' + r.status };
  let result;
  try { result = await r.json(); } catch { return { status: 'error', error: 'Media Bridge trả dữ liệu không hợp lệ.' }; }
  if (!['ok', 'unknown', 'too_big', 'error'].includes(result?.status)) return { status: 'error', error: 'Media Bridge trả trạng thái lạ.' };
  if (storage && result.status !== 'error') await saveResult(storage, manifest.sourceUrl, result, now);
  return result;
}

// Gọi trong mediaFile() trước /prepare. Chỉ chặn khi CHẮC CHẮN vượt 200 MB; mọi trường hợp khác để /prepare xử lý
// (bridge vẫn giới hạn cứng 200 MB khi tải).
export async function guardVideoSize(manifest, options = {}) {
  const storage = options.storage === undefined ? globalThis.chrome?.storage?.local : options.storage;
  const now = options.now ?? Date.now();
  if (storage) {
    const saved = (await readStore(storage))[manifest.sourceUrl];
    if (saved?.status === 'too_big' && saved.maxMB === MEDIA_LIMIT_MB && saved.exact && Number(saved.bytes)>MEDIA_LIMIT_MB*MB && now - saved.at <= KEEP_MS) throw Error(tooBigMessage(saved));
  }
  const result = await probeVideo(manifest, { ...options, storage, now });
  if (result.status === 'too_big' && result.exact && Number(result.bytes)>MEDIA_LIMIT_MB*MB && result.maxMB===MEDIA_LIMIT_MB) throw Error(tooBigMessage(result));
  return result;
}

// Kiểm tra trước tất cả bài video chưa đăng. Chạy lần lượt (nhẹ, không tải file).
export async function probeAllVideos(posts, options = {}) {
  const rows = [];
  for (const post of posts || []) {
    if (['success', 'running', 'unknown', 'partial'].includes(post?.state) || post?.postUrl) continue;
    for (const m of videoManifests(post)) {
      const result = await probeVideo(m.manifest, options);
      rows.push({ postId: post.id, number: post.number || null, title: String(post.title || '').slice(0, 80), sourceUrl: m.manifest.sourceUrl, ...result });
      if (result.status === 'unsupported') return { rows, unsupported: true };
    }
  }
  return { rows, unsupported: false };
}
