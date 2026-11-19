"""Local JSON -> MP4 bridge. Only explicitly paired Chrome extensions may call it.

[3.6.2-video] File nay da duoc viet lai tu ban 3.6.1. Xem CHANGES-3.6.2-VIDEO.md.
Thay doi chinh:
  - /probe: hoi thong tin video (khong tai) de biet co vua 200 MB khong.
  - Chon ban MP4 <= 200 MB, --max-filesize 200M: khong tai file qua co.
  - Nhieu profile xu ly song song (mac dinh 2, doc media-bridge-settings.json).
  - Cache MP4 ngan han de thu lai khong tai lai; cung link chi tai 1 lan.
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qsl, urlsplit

MAX_MB = 200
MAX_OUTPUT = MAX_MB * 1024 * 1024
# [3.6.2-video] Format: uu tien ban mp4 co am thanh va biet dung luong <= 200 MB,
# sau do ban uoc luong <= 200 MB, cuoi cung la ban chua biet dung luong (gioi han
# cung bang --max-filesize). Khong lay ban lon nhat roi moi loai.
FORMAT = '/'.join([
    # 3.8.6.3: ban "hd"/"sd" cua Facebook la MP4 H.264 + AAC co san am thanh (da kiem tra),
    # Facebook nhan tot khi tai len. Ban DASH thuong la AV1, Facebook co the tu choi.
    # 3.8.7: da gap Reel co ca ban hd cung la AV1 (reel 1640085867682202); prepare_mp4 tu chuyen
    # moi ban khong phai H.264 sang H.264, nen thu tu uu tien nay van an toan.
    'hd[ext=mp4]', 'sd[ext=mp4]',
    'best[ext=mp4][vcodec!=none][acodec!=none][filesize<=200M]',
    'best[ext=mp4][vcodec!=none][acodec!=none][filesize_approx<=200M]',
    'bestvideo[ext=mp4][filesize<=190M]+bestaudio[ext=m4a][filesize<=10M]',
    'best[ext=mp4][vcodec!=none][acodec!=none][filesize<=?200M][filesize_approx<=?200M]',
    'bestvideo[ext=mp4][filesize<=?190M][filesize_approx<=?190M]+bestaudio[ext=m4a][filesize<=?10M][filesize_approx<=?10M]',
    # 3.8.6: Facebook thuong khong ghi vcodec/acodec cho ban hd/sd, va co luc chi co DASH
    # khong phai m4a. Cac lua chon duoi day van bi gioi han boi --max-filesize 200M.
    'best[ext=mp4][filesize<=?200M][filesize_approx<=?200M]',
    'bestvideo[filesize<=?190M][filesize_approx<=?190M]+bestaudio',
    'best[filesize<=?200M][filesize_approx<=?200M]',
])
ANY_FORMAT = 'best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best'
YTDLP_TIMEOUT = 840
FFMPEG_TIMEOUT = 120
TRANSCODE_TIMEOUT = 600
PROBE_TIMEOUT = 60
QUEUE_WAIT = 25       # giay cho luot trong bridge truoc khi tra 409 de extension hoi lai
CACHE_TTL = 45 * 60   # giay
CACHE_MAX_FILES = 12

ALLOWED_ORIGINS = set()
ALLOWED_PATHS = ('/prepare', '/health', '/probe')


def validate_manifest(value):
    if not isinstance(value, dict) or value.get('schema') != 'desk.media/1' or value.get('kind') not in ('video', 'reel'):
        raise ValueError('Media JSON khong dung schema desk.media/1.')
    url = value.get('sourceUrl', '')
    if not isinstance(url, str):
        raise ValueError('Media JSON thieu sourceUrl.')
    parsed = urlsplit(url)
    if parsed.scheme != 'https' or parsed.netloc not in ('www.facebook.com', 'facebook.com', 'm.facebook.com', 'web.facebook.com'):
        raise ValueError('Nguon video phai la link Facebook HTTPS.')
    album_video = re.fullmatch(r'/[\w.-]+/videos/pcb\.\d+/(\d+)/?', parsed.path)
    if album_video:
        url = 'https://www.facebook.com/watch/?v=' + album_video.group(1)
        parsed = urlsplit(url)
    if not re.fullmatch(r'/(?:[\w.-]+/(?:posts|videos)/[\w:-]+|(?:reels?|videos)/[\w.-]+|watch|(?:permalink|story)\.php|share/[prv]/[\w-]+)/?', parsed.path):
        raise ValueError('Can link bai video/Reel cu the, khong phai trang ca nhan.')
    if parsed.path.rstrip('/') == '/watch' and not re.fullmatch(r'\d+', dict(parse_qsl(parsed.query)).get('v', '')):
        raise ValueError('Link watch thieu ma video.')
    return {'schema': 'desk.media/1', 'kind': value['kind'], 'sourceUrl': url}


def ytdlp_base():
    return [sys.executable, '-m', 'yt_dlp', '--ignore-config', '--no-playlist', '--playlist-end', '1',
            '--no-progress', '--socket-timeout', '20', '--retries', '1']


def _size_of(info):
    """Tra ve (bytes, exact) cua ban duoc chon tu output yt-dlp -j; (None, False) neu khong biet."""
    parts = info.get('requested_formats') or [info]
    total, exact = 0, True
    for part in parts:
        if part.get('filesize'):
            total += int(part['filesize'])
        elif part.get('filesize_approx'):
            total += int(part['filesize_approx'])
            exact = False
        else:
            return None, False
    return total, exact


def probe(manifest, run=subprocess.run):
    """[3.6.2-video] Hoi thong tin video, KHONG tai. Ket qua:
    status = 'ok' (vua 200 MB) | 'unknown' (khong biet dung luong, se gioi han khi tai)
           | 'too_big' (moi ban deu vuot 200 MB) | 'error' (khong doc duoc video)."""
    manifest = validate_manifest(manifest)

    def ask(fmt):
        result = run(ytdlp_base() + ['-j', '-f', fmt, '--', manifest['sourceUrl']],
                     stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=PROBE_TIMEOUT)
        out = result.stdout.decode('utf-8', 'replace') if isinstance(result.stdout, bytes) else (result.stdout or '')
        err = result.stderr.decode('utf-8', 'replace') if isinstance(result.stderr, bytes) else (result.stderr or '')
        info = None
        if not result.returncode:
            for line in out.splitlines():
                line = line.strip()
                if line.startswith('{'):
                    info = json.loads(line)
                    break
        return info, err

    info, err = ask(FORMAT)
    if info:
        size, exact = _size_of(info)
        status = 'unknown' if size is None else ('ok' if size <= MAX_OUTPUT else 'too_big' if exact else 'unknown')
        return {'status': status, 'bytes': size, 'exact': exact, 'duration': info.get('duration'), 'maxMB': MAX_MB, **caption_of(info)}
    if 'requested format' not in err.lower() and 'format is not available' not in err.lower():
        return {'status': 'error', 'error': 'Khong doc duoc video cong khai.', 'maxMB': MAX_MB}
    # Khong co ban nao lot bo loc 200 MB: kiem tra video co ton tai va lay dung luong de bao.
    info, _ = ask(ANY_FORMAT)
    if not info:
        return {'status': 'error', 'error': 'Khong doc duoc video cong khai.', 'maxMB': MAX_MB}
    size, exact = _size_of(info)
    return {'status': 'too_big' if exact and size is not None and size > MAX_OUTPUT else 'unknown', 'bytes': size, 'exact': exact, 'duration': info.get('duration'), 'maxMB': MAX_MB, **caption_of(info)}


def caption_of(info):
    """3.8.7: caption cong khai cua video/Reel (yt-dlp doc tu trang cong khai). FB Desk dung khi Post Research
    ghi nham chu giao dien (vd. 'Facebook') vao cho caption."""
    description = info.get('description')
    return {'caption': description.strip() if isinstance(description, str) else '', 'captionKnown': isinstance(description, str)}


def prepare_mp4(manifest, directory, run=subprocess.run, ffmpeg='ffmpeg'):
    manifest = validate_manifest(manifest)
    command = ytdlp_base() + ['--max-filesize', '%dM' % MAX_MB, '-f', FORMAT,
                              '--merge-output-format', 'mp4', '-o', 'source.%(ext)s', '--', manifest['sourceUrl']]
    result = run(command, cwd=directory, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=YTDLP_TIMEOUT)
    source, output = Path(directory, 'source.mp4'), Path(directory, 'ready.mp4')
    err = result.stderr.decode('utf-8', 'replace') if isinstance(getattr(result, 'stderr', None), bytes) else str(getattr(result, 'stderr', '') or '')
    if 'larger than max-filesize' in err.lower():
        raise ValueError('Video vượt 200 MB; bỏ qua bài này. Không tự giảm chất lượng video.')
    if 'requested format' in err.lower() or 'format is not available' in err.lower():
        raise ValueError('Khong tim duoc dinh dang video phu hop; khong ket luan video qua lon.')
    if result.returncode or not source.exists():
        raise ValueError('Khong lay duoc video cong khai. Khong dung cookie/token de vuot quyen xem.')
    if source.stat().st_size > MAX_OUTPUT:
        raise ValueError('Video vượt 200 MB; bỏ qua bài này. Không tự giảm chất lượng video.')
    result = run([ffmpeg, '-nostdin', '-y', '-i', str(source), '-map', '0:v:0', '-map', '0:a:0?', '-c', 'copy', '-movflags', '+faststart', str(output)], cwd=directory, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=FFMPEG_TIMEOUT)
    if result.returncode or not output.exists() or not output.stat().st_size:
        raise ValueError('Khong dung duoc MP4 hop le; chua dang bai.')
    if output.stat().st_size > MAX_OUTPUT:
        raise ValueError('MP4 vượt 200 MB của kênh upload hiện tại. Chưa đăng; không tự giảm chất lượng video.')
    # 3.8.7: Facebook hien phat Reels/video bang AV1 (ca ban hd/sd), nen yt-dlp tai ve MP4 AV1.
    # Trinh tai len trang ca nhan khong on dinh voi AV1, nen chuyen sang H.264 + AAC (giu do phan giai).
    codec = video_codec(output, run=run, ffmpeg=ffmpeg)
    if codec and codec != 'h264':
        converted = Path(directory, 'ready-h264.mp4')
        result = run([ffmpeg, '-nostdin', '-y', '-i', str(output), '-map', '0:v:0', '-map', '0:a:0?', '-c:v', 'libx264', '-preset', 'veryfast',
                      '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', str(converted)],
                     cwd=directory, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=TRANSCODE_TIMEOUT)
        if result.returncode or not converted.exists() or not converted.stat().st_size:
            raise ValueError('Khong chuyen duoc video %s sang H.264; chua dang bai.' % codec)
        if converted.stat().st_size > MAX_OUTPUT:
            raise ValueError('MP4 H.264 vượt 200 MB của kênh upload hiện tại. Chưa đăng bài này.')
        output = converted
    return output


def video_codec(path, run=subprocess.run, ffmpeg='ffmpeg'):
    """Ten codec video dau tien theo ffmpeg ('h264', 'av1', 'vp9', 'hevc'...); '' neu khong doc duoc."""
    try:
        result = run([ffmpeg, '-hide_banner', '-nostdin', '-i', str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=30)
    except Exception:
        return ''
    err = result.stderr.decode('utf-8', 'replace') if isinstance(getattr(result, 'stderr', None), bytes) else str(getattr(result, 'stderr', '') or '')
    match = re.search(r'Stream #\S+.*?: Video: (\w+)', err)
    return match.group(1).lower() if match else ''


class MediaCache:
    """[3.6.2-video] Cache MP4 da dung theo sha256(sourceUrl). Song song toi da `slots`
    luot tai; cung mot link chi tai 1 lan (luot sau doi va dung lai file)."""

    def __init__(self, root, slots=2, ttl=CACHE_TTL, max_files=CACHE_MAX_FILES, clock=time.time):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)
        self.concurrency = max(1, int(slots))
        self.slots = threading.BoundedSemaphore(self.concurrency)
        self.ttl, self.max_files, self.clock = ttl, max_files, clock
        self.guard = threading.Lock()
        self.key_locks = {}
        self.probes = {}

    def key(self, url):
        # 3.8.7: doi ten bo nho dem khi doi dinh dang dau ra (AV1 -> H.264), khong dung lai tep cu.
        return hashlib.sha256(('h264:' + url).encode('utf-8')).hexdigest()[:32]

    def path(self, url):
        return self.root / (self.key(url) + '.mp4')

    def cleanup(self):
        now = self.clock()
        files = sorted(self.root.glob('*.mp4'), key=lambda p: p.stat().st_mtime)
        for index, file in enumerate(files):
            if now - file.stat().st_mtime > self.ttl or len(files) - index > self.max_files:
                try:
                    file.unlink()
                except OSError:
                    pass
        for part in self.root.glob('*.part-*'):
            if now - part.stat().st_mtime > 600:
                try:
                    shutil.rmtree(part, ignore_errors=True)
                except OSError:
                    pass

    def _lock_for(self, url):
        with self.guard:
            return self.key_locks.setdefault(self.key(url), threading.Lock())

    def fresh(self, url):
        file = self.path(url)
        return file if file.exists() and self.clock() - file.stat().st_mtime <= self.ttl and file.stat().st_size else None

    def get(self, manifest, build, wait=QUEUE_WAIT):
        """Tra ve Path MP4. build(manifest, directory) -> Path. None neu het luot cho (goi lai sau)."""
        manifest = validate_manifest(manifest)
        url = manifest['sourceUrl']
        self.cleanup()
        hit = self.fresh(url)
        if hit:
            return hit
        key_lock = self._lock_for(url)
        if not key_lock.acquire(timeout=wait):
            return None
        try:
            hit = self.fresh(url)
            if hit:
                return hit
            if not self.slots.acquire(timeout=wait):
                return None
            try:
                work = Path(tempfile.mkdtemp(prefix=self.key(url) + '.part-', dir=self.root))
                try:
                    built = build(manifest, str(work))
                    target = self.path(url)
                    os.replace(built, target)
                    return target
                finally:
                    shutil.rmtree(work, ignore_errors=True)
            finally:
                self.slots.release()
        finally:
            key_lock.release()

    def probe(self, manifest, ask):
        manifest = validate_manifest(manifest)
        url = manifest['sourceUrl']
        with self.guard:
            saved = self.probes.get(url)
        if saved and self.clock() - saved[0] <= self.ttl:
            return saved[1]
        result = ask(manifest)
        if result.get('status') != 'error':
            with self.guard:
                self.probes[url] = (self.clock(), result)
        return result


CACHE = None
FFMPEG = 'ffmpeg'


def paired_origins():
    # The native host atomically updates this file when another paired profile starts.
    origins = set(ALLOWED_ORIGINS)
    try:
        config = json.loads(Path(__file__).with_name('media-bridge-config.json').read_text(encoding='utf-8-sig'))
        for extension_id in config.get('extensionIds', []):
            if isinstance(extension_id, str) and re.fullmatch('[a-p]{32}', extension_id):
                origins.add('chrome-extension://' + extension_id)
    except (OSError, ValueError, TypeError, AttributeError):
        pass
    return origins


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def allowed(self):
        # Privileged extension GET fetches can omit Origin. Health is read-only
        # and exposes no user data. Keep Origin mandatory for media operations
        # and reject explicit unpaired origins even on health.
        if self.command == 'GET' and self.path == '/health' and self.headers.get('Origin') is None:
            return self.headers.get('Host') == '127.0.0.1:47833'
        return self.headers.get('Origin') in paired_origins() and self.headers.get('Host') == '127.0.0.1:47833' and self.path in ALLOWED_PATHS

    def headers_for(self, code, mime, size):
        self.send_response(code)
        if self.headers.get('Origin') in paired_origins():
            self.send_header('Access-Control-Allow-Origin', self.headers['Origin'])
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Type', mime)
        self.send_header('Content-Length', str(size))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()

    def error(self, code, message):
        data = str(message).encode('utf-8')
        self.headers_for(code, 'text/plain; charset=utf-8', len(data))
        self.wfile.write(data)

    def send_json(self, code, value):
        data = json.dumps(value, ensure_ascii=False).encode('utf-8')
        self.headers_for(code, 'application/json; charset=utf-8', len(data))
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.headers_for(204 if self.allowed() else 403, 'text/plain', 0)

    def do_GET(self):
        if not self.allowed() or self.path != '/health':
            return self.error(403, 'Extension chua duoc ghep noi.')
        self.send_json(200, {'ok': True, 'schema': 'desk.media/1', 'maxMB': MAX_MB,
                             'concurrency': CACHE.concurrency if CACHE else 1, 'probe': True})

    def read_manifest(self):
        size = int(self.headers.get('Content-Length', 0))
        if not 0 < size <= 65536:
            raise ValueError('Media JSON qua lon.')
        return validate_manifest(json.loads(self.rfile.read(size)))

    def do_POST(self):
        if not self.allowed() or self.path not in ('/prepare', '/probe'):
            # Doc bo body (<= 64 KB) de tra 403 ro rang thay vi cat ngang ket noi.
            try:
                pending = int(self.headers.get('Content-Length', 0))
                if 0 < pending <= 65536:
                    self.rfile.read(pending)
            except (ValueError, OSError):
                pass
            return self.error(403, 'Extension chua duoc ghep noi voi Media Bridge.')
        try:
            manifest = self.read_manifest()
        except (ValueError, TypeError, KeyError) as error:
            return self.error(400, error)
        if self.path == '/probe':
            try:
                return self.send_json(200, CACHE.probe(manifest, probe))
            except (subprocess.TimeoutExpired, OSError, ValueError) as error:
                return self.send_json(200, {'status': 'error', 'error': str(error)[:300], 'maxMB': MAX_MB})
        try:
            output = CACHE.get(manifest, lambda m, d: prepare_mp4(m, d, ffmpeg=FFMPEG))
            if output is None:
                return self.error(409, 'Dang dung MP4 cho profile khac. Thu lai sau.')
            self.headers_for(200, 'video/mp4', output.stat().st_size)
            with output.open('rb') as stream:
                shutil.copyfileobj(stream, self.wfile)
        except (BrokenPipeError, ConnectionResetError):
            pass
        except (ValueError, subprocess.TimeoutExpired, OSError, ImportError) as error:
            self.error(422, str(error)[:300])


def read_settings(folder):
    """[3.6.2-video] media-bridge-settings.json (tuy chon): {"concurrency": 2}.
    Tach khoi media-bridge-config.json vi Start-Media.ps1 ghi de file do."""
    try:
        value = json.loads(Path(folder, 'media-bridge-settings.json').read_text(encoding='utf-8-sig'))
        return max(1, min(4, int(value.get('concurrency', 2))))
    except (OSError, ValueError, TypeError, AttributeError):
        return 2


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--allow-extension', action='append', required=True)
    parser.add_argument('--concurrency', type=int, default=None)
    arguments = parser.parse_args()
    for extension in arguments.allow_extension:
        if not re.fullmatch('[a-p]{32}', extension):
            parser.error('Extension ID khong hop le.')
        ALLOWED_ORIGINS.add('chrome-extension://' + extension)
    slots = arguments.concurrency or read_settings(Path(__file__).resolve().parent)
    cache_root = Path(os.environ.get('LOCALAPPDATA') or tempfile.gettempdir(), 'FacebookDeskMedia', 'cache')
    CACHE = MediaCache(cache_root, slots=max(1, min(4, slots)))
    CACHE.cleanup()
    # yt-dlp needs an ffmpeg executable available by name when merging streams.
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory() as binaries:
        shutil.copyfile(FFMPEG, Path(binaries, 'ffmpeg.exe'))
        os.environ['PATH'] = binaries + os.pathsep + os.environ.get('PATH', '')
        print('Media Bridge ready at 127.0.0.1:47833 (song song %d, cache %s). Keep this window open.' % (CACHE.concurrency, cache_root), flush=True)
        ThreadingHTTPServer(('127.0.0.1', 47833), Handler).serve_forever()
