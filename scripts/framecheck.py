"""motion-review · framecheck.py (not inspect.py: that name shadows the stdlib) — look at an AnimPlayer page the way a reviewer would, headlessly.
  sheet  <t,t,...> [out.png]   contact sheet of frames at those times (use it on every timestamped note, ±0.1s)
  crop   <t> <x,y,w,h> [out]   one frame, cropped (stage px) and upscaled, for detail work
  seam                         pixel diff between the last frame and frame 0 (0 = seamless loop)
  steps  [fps]                 per-frame change across the whole loop; spikes = pops, jumps or hard cuts
usage: python3 tools/framecheck.py sheet 0,1.5,3.2 --url http://localhost:5178/"""
import argparse, asyncio, io, os
from playwright.async_api import async_playwright
from PIL import Image, ImageChops

ap = argparse.ArgumentParser()
ap.add_argument('cmd'); ap.add_argument('arg', nargs='?'); ap.add_argument('arg2', nargs='?'); ap.add_argument('out', nargs='?')
ap.add_argument('--url', default='http://localhost:5178/')
a = ap.parse_args()
URL = a.url + ('&' if '?' in a.url else '?') + 'export'

def mean(d):
    h = d.histogram(); return sum(k * v for k, v in enumerate(h)) / sum(h)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); probe = await b.new_page(); await probe.goto(URL)
        await probe.wait_for_function('window.ready === true', timeout=60000)
        (w, h), dur = await probe.evaluate('window.EXPORT_SIZE'), await probe.evaluate('window.DUR'); await probe.close()
        pg = await b.new_page(viewport={'width': w, 'height': h}); await pg.goto(URL); await pg.wait_for_function('window.ready === true')
        async def shot(t, clip=None):
            await pg.evaluate(f'renderFrame({t})')
            return Image.open(io.BytesIO(await pg.screenshot(clip=clip))).convert('RGB')
        if a.cmd == 'sheet':
            ts = [float(x) for x in a.arg.split(',')]; th = 450; tw = round(w * th / h)
            sheet = Image.new('RGB', (len(ts) * (tw + 8), th + 22), 'white')
            from PIL import ImageDraw; dr = ImageDraw.Draw(sheet)
            for i, t in enumerate(ts):
                sheet.paste((await shot(t)).resize((tw, th)), (i * (tw + 8), 22)); dr.text((i * (tw + 8) + 4, 4), f'{t:.2f}s', fill='black')
            out = a.arg2 or 'inspect-sheet.png'; sheet.save(out); print(out)
        elif a.cmd == 'crop':
            x, y, cw, ch = [float(v) for v in a.arg2.split(',')]
            im = await shot(float(a.arg), {'x': x, 'y': y, 'width': cw, 'height': ch})
            im = im.resize((int(cw * 2), int(ch * 2))); out = a.out or 'inspect-crop.png'; im.save(out); print(out)
        elif a.cmd == 'seam':
            end, start = (await shot(dur - 1e-4)).convert('L'), (await shot(0)).convert('L')
            d = ImageChops.difference(end, start); print(f'seam: mean {mean(d):.3f}, max {max(k for k, v in enumerate(d.histogram()) if v)}  (0 = identical)')
        elif a.cmd == 'steps':
            fps = int(a.arg or 30); prev = None; res = []
            for f in range(round(dur * fps) + 1):
                t = (f / fps) % dur; im = (await shot(t)).convert('L').resize((w // 2, h // 2))
                if prev: res.append((mean(ImageChops.difference(prev, im)), t))
                prev = im
            res.sort(reverse=True); print('largest frame-to-frame changes (mean px diff @ time):')
            for m, t in res[:12]: print(f'  {m:6.2f} @ {t:.3f}s')
        await b.close()
asyncio.run(main())
