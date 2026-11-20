"""Loopback video downloader for the Post Research extension."""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ORIGIN = "chrome-extension://eohaljnaeegaegeplcanfklhaoafhhcm"
SLOT = threading.Lock()


def valid_post(url):
    parsed = urlsplit(url)
    return (parsed.scheme == "https" and parsed.netloc in
            {"facebook.com", "www.facebook.com", "m.facebook.com", "web.facebook.com"}
            and re.fullmatch(r"/(?:[\w.-]+/(?:posts|videos)/[\w:-]+|(?:reels?|videos)/\d+|watch|(?:permalink|story|photo)\.php|photo|share/[rv]/[\w-]+)/?", parsed.path))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def allowed(self):
        return (self.headers.get("Origin") == ORIGIN and self.path == "/video" and
                self.headers.get("Host") == "127.0.0.1:47833")

    def headers_for(self, code, mime, size):
        self.send_response(code)
        self.send_header("Access-Control-Allow-Origin", ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Type", mime)
        self.send_header("Content-Length", str(size))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()

    def error(self, code, message):
        data = message.encode("utf-8")
        self.headers_for(code, "text/plain; charset=utf-8", len(data))
        self.wfile.write(data)

    def do_OPTIONS(self):
        self.headers_for(204 if self.allowed() else 403, "text/plain", 0)

    def do_POST(self):
        if not self.allowed():
            return self.error(403, "Forbidden")
        try:
            size = int(self.headers.get("Content-Length", 0))
            if not 0 < size <= 8192:
                raise ValueError()
            url = json.loads(self.rfile.read(size))["url"]
            if not isinstance(url, str) or not valid_post(url):
                raise ValueError()
        except (ValueError, TypeError, KeyError):
            return self.error(400, "Link bài Facebook không hợp lệ.")
        if not SLOT.acquire(blocking=False):
            return self.error(409, "Đang tải một video khác. Thử lại sau.")
        try:
            with tempfile.TemporaryDirectory() as tmp:
                command = [sys.executable, "-m", "yt_dlp", "--ignore-config", "--no-playlist",
                           "--playlist-end", "1", "--no-progress", "--socket-timeout", "20",
                           "--retries", "1", "--max-filesize", "300M",
                           "-f", "best[ext=mp4][vcodec!=none][acodec!=none]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]",
                           "--merge-output-format", "mp4", "-o", "video.%(ext)s", "--", url]
                result = subprocess.run(command, cwd=tmp, stdout=subprocess.DEVNULL,
                                        stderr=subprocess.DEVNULL, timeout=240)
                file = Path(tmp, "video.mp4")
                if result.returncode or not file.exists() or not 0 < file.stat().st_size <= 300*1024**2:
                    return self.error(422, "Chưa tải được MP4 công khai từ bài này (quyền xem, nguồn tải hoặc dung lượng).")
                with file.open("rb") as stream:
                    self.headers_for(200, "video/mp4", file.stat().st_size)
                    shutil.copyfileobj(stream, self.wfile)
        except subprocess.TimeoutExpired:
            self.error(504, "Facebook tải video quá lâu.")
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            SLOT.release()


if __name__ == "__main__":
    # imageio-ffmpeg bundles the Windows binary under a versioned name.
    import imageio_ffmpeg
    with tempfile.TemporaryDirectory() as tools:
        shutil.copyfile(imageio_ffmpeg.get_ffmpeg_exe(), Path(tools, "ffmpeg.exe"))
        os.environ["PATH"] = tools + os.pathsep + os.environ.get("PATH", "")
        with ThreadingHTTPServer(("127.0.0.1", 47833), Handler) as server:
            print("Video connector ready. Keep this window open.", flush=True)
            server.serve_forever()
