"""motion-review · export.py — frame-exact MP4 of an AnimPlayer page.
Renders every frame in headless Chromium via window.renderFrame(t) at 2× (supersampled), then encodes H.264
with AVFoundation (encode.swift — no ffmpeg needed). Frame size comes from the page (window.EXPORT_SIZE).
usage: python3 tools/export.py [--url http://localhost:5178/] [--fps 60] [--scale 2] [--out exports/name.mp4]
Needs: pip install playwright && playwright install chromium; Xcode command line tools (swift)."""
import argparse, asyncio, json, os, shutil, subprocess, tempfile, time
from playwright.async_api import async_playwright

ap = argparse.ArgumentParser()
ap.add_argument('--url', default='http://localhost:5178/')
ap.add_argument('--fps', type=int, default=60)
ap.add_argument('--scale', type=int, default=2)
ap.add_argument('--out', default=None)
a = ap.parse_args()
ROOT = os.getcwd(); HERE = os.path.dirname(os.path.abspath(__file__))
OUT = a.out or os.path.join(ROOT, 'exports', f'export-{time.strftime("%Y%m%d-%H%M%S")}.mp4')
PROGRESS = os.path.join(ROOT, 'exports', '.progress')
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True); os.makedirs(os.path.dirname(PROGRESS), exist_ok=True)
def report(**kw):
    with open(PROGRESS, 'w') as f: json.dump(kw, f)

async def render(frames):
    url = a.url + ('&' if '?' in a.url else '?') + 'export'
    async with async_playwright() as p:
        b = await p.chromium.launch()
        probe = await b.new_page(); await probe.goto(url); await probe.wait_for_function('window.ready === true', timeout=60000)
        w, h = await probe.evaluate('window.EXPORT_SIZE'); dur = await probe.evaluate('window.DUR'); await probe.close()
        pg = await b.new_page(viewport={'width': w, 'height': h}, device_scale_factor=a.scale)
        await pg.goto(url); await pg.wait_for_function('window.ready === true', timeout=60000)
        n = round(dur * a.fps)
        for i in range(n):
            await pg.evaluate(f'renderFrame({i / a.fps})')
            await pg.screenshot(path=os.path.join(frames, f'{i:05d}.png'))
            if i % 5 == 0: report(state='rendering', progress=i / n * 0.9)
        await b.close()
        return w, h

frames = tempfile.mkdtemp(prefix='motion-review-')
try:
    report(state='rendering', progress=0)
    w, h = asyncio.run(render(frames))
    report(state='encoding', progress=0.92)
    r = subprocess.run(['swift', os.path.join(HERE, 'encode.swift'), frames, OUT, str(a.fps), str(w), str(h)], capture_output=True, text=True)
    if r.returncode != 0 or 'ok' not in r.stdout: raise RuntimeError(r.stdout + r.stderr)
    report(state='done', progress=1, file=os.path.relpath(OUT, ROOT)); print(OUT)
except Exception as e:
    report(state='error', progress=0, error=str(e)[-400:]); raise
finally:
    shutil.rmtree(frames, ignore_errors=True)
