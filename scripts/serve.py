"""motion-review · serve.py — static server for an animation page.
- Threaded, with HTTP Range support (<video> seeking needs it; python -m http.server can't do either).
- Local-only /api/export: POST starts export.py, GET reports progress. Refused through tunnels (Cloudflare headers).
usage: python3 tools/serve.py [port] [page-path]      e.g. python3 tools/serve.py 5178 /index.html
Serves the current working directory."""
import json, os, re, subprocess, sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.getcwd()
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5178
PAGE = sys.argv[2] if len(sys.argv) > 2 else '/'
PROGRESS = os.path.join(ROOT, 'exports', '.progress')
job = None

class Handler(SimpleHTTPRequestHandler):
    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code); self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body))); self.end_headers(); self.wfile.write(body)

    def _status(self):
        try:
            with open(PROGRESS) as f: st = json.load(f)
        except Exception: st = {'state': 'idle', 'progress': 0}
        st['running'] = job is not None and job.poll() is None
        if not st['running'] and st.get('state') in ('rendering', 'encoding'): st['state'] = 'error'; st['error'] = 'export stopped'
        return st

    def do_GET(self):
        if self.path.startswith('/api/export'): return self._json(200, self._status())
        return super().do_GET()

    def do_POST(self):
        global job
        if not self.path.startswith('/api/export'): return self._json(404, {'error': 'not found'})
        if self.headers.get('Cf-Connecting-Ip') or self.headers.get('Cf-Ray'):
            return self._json(403, {'error': 'Export runs on the machine serving this page. Open it on localhost to export.'})
        if job is not None and job.poll() is None: return self._json(409, self._status())
        os.makedirs(os.path.dirname(PROGRESS), exist_ok=True)
        with open(PROGRESS, 'w') as f: json.dump({'state': 'rendering', 'progress': 0}, f)
        job = subprocess.Popen([sys.executable, os.path.join(HERE, 'export.py'), '--url', f'http://localhost:{PORT}{PAGE}'], cwd=ROOT)
        return self._json(202, self._status())

    def send_head(self):
        rng = self.headers.get('Range')
        path = self.translate_path(self.path)
        if not rng or not os.path.isfile(path): return super().send_head()
        m = re.match(r'bytes=(\d*)-(\d*)', rng); size = os.path.getsize(path)
        start = int(m.group(1)) if m.group(1) else size - int(m.group(2))
        end = min(int(m.group(2)) if m.group(1) and m.group(2) else size - 1, size - 1)
        f = open(path, 'rb'); f.seek(start)
        self.send_response(206)
        self.send_header('Content-Type', self.guess_type(path))
        self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length', str(end - start + 1))
        self.end_headers(); self._remaining = end - start + 1
        return f

    def copyfile(self, src, dst):
        n = getattr(self, '_remaining', None)
        if n is None: return super().copyfile(src, dst)
        while n > 0:
            chunk = src.read(min(65536, n))
            if not chunk: break
            dst.write(chunk); n -= len(chunk)

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes'); self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, *a): pass

print(f'Serving {ROOT} at http://localhost:{PORT}{PAGE}')
ThreadingHTTPServer(('', PORT), Handler).serve_forever()
