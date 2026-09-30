# Techniques (copy-ready)

Patterns that came out of real review rounds. Each fixes a specific note a reviewer gave.

## Phase helpers

```js
function bezier(x1, y1, x2, y2) { /* see assets/template.html */ }
const seg = (t, a, b, ease) => ease(Math.min(1, Math.max(0, (t - a) / (b - a))));   // 0…1 inside [a, b]
const mix = (a, b, p) => a + (b - a) * p;
const mixR = (a, b, p) => ({ x: mix(a.x, b.x, p), y: mix(a.y, b.y, p), w: mix(a.w, b.w, p), h: mix(a.h, b.h, p), r: mix(a.r, b.r, p) });
// Chained phases: mixR(mixR(A, B, e1), C, e2) — valid even when phases overlap.
```

Curves that read as premium: moves `bezier(.6,0,.1,1)`, build beats `(.5,0,.1,1)`, UI swaps `(.65,0,.1,1)`,
entrances `(.23,1,.32,1)`, opacity `(.45,0,.55,1)`, drift `linear`.

## Rounded crop that shrinks (never resize the box)

Keep the element at its largest size and animate a clip; resizing boxes snaps to pixels.

```js
const inset = (outer, r) => `inset(${r.y - outer.y}px ${outer.x + outer.w - r.x - r.w}px ${outer.y + outer.h - r.y - r.h}px ${r.x - outer.x}px round ${r.r}px)`;
el.style.clipPath = inset(FULL, mixR(FULL, BUTTON, e));
```

## Camera locked on the subject (crop closes in, nothing slides)

"The crop pulls the video up" = image and crop scale about different points. Pin the subject's point on screen:

```js
const FACE = { u: 0.645, v: 0.5 };           // subject in the media (fractions)
const ANCHOR = { x: 835, y: 600 };           // where it stays on screen, full-bleed → button
const iw = mix(W_FULL, ZOOM * button.w, e);  // media width; height from its native ratio (never stretch)
const ix = ANCHOR.x - FACE.u * iw, iy = ANCHOR.y - FACE.v * iw / RATIO;
media.style.transform = `translate3d(${ix}px, ${iy}px, 0) scale(${iw / W_ELEMENT})`;
```
Choose ANCHOR so the subject ends clear of any centred label. Push-ins/drift also scale about the anchor.

## Film that glides to a stop

Slowing a `<video>` steps unevenly and jumps on pause. Pre-decode the few frames of the slow-down and blend:

```js
async function decode(src, t0, n, fps) {           // ImageBitmaps for n frames from t0
  const v = Object.assign(document.createElement('video'), { src, muted: true, preload: 'auto' });
  await new Promise(r => v.addEventListener('loadedmetadata', r, { once: true }));
  const out = [];
  for (let k = 0; k < n; k++) {
    await new Promise(r => { v.addEventListener('seeked', r, { once: true }); v.currentTime = t0 + (k + 0.5) / fps; });
    out.push(await createImageBitmap(v));
  }
  return out;
}
// clip position: 1× until S0, then cubic ease-out to rest over D (velocity-continuous): pos = S0c + D * (1 - (1 - u) ** 3) / 3
function drawBlend(ctx, frames, f) {                // f = fractional frame index
  const k = Math.floor(f), a = f - k;
  ctx.globalAlpha = 1; ctx.drawImage(frames[k], 0, 0);
  if (a > 0.001 && frames[k + 1]) { ctx.globalAlpha = a; ctx.drawImage(frames[k + 1], 0, 0); }
}
```
Hand off from the live `<video>` to the canvas over ~150ms while both are still moving at 1×.

## Choosing clip in-points

"Show it a second after the stripe faces camera" — find the moment, don't guess:
`python3 tools/framecheck.py clip assets/vial.mp4 24` (contact sheet with timestamps), then set the clip offset.
Park the video on its in-point until it appears so nothing jumps on reveal.

## Menu → menu swap

Never exit-then-enter (empty frame = "flash"), never 50/50 crossfade photos (double exposure).

```js
// outgoing: small drift opposite to travel, dims under the wipe
out.style.transform = `translate3d(${-dir * 28 * eo}px,0,0)`; out.style.opacity = 1 - seg(t, a + .05 * span, a + .6 * span, fade);
// incoming (per block, 60ms stagger, starts 0.1s after the card begins resizing): soft-edged mask sweep + parallax
const edge = e * (w + F), F = Math.min(72, w * .16);
el.style.maskImage = `linear-gradient(${dir < 0 ? 90 : 270}deg, #000 ${edge - F}px, transparent ${edge}px)`;
el.style.transform = `translate3d(${dir * 28 * (1 - e)}px,0,0)`;
```
`dir` = the side the nav highlight is heading toward. The card edge (a clip on the content layer) masks the travel.

## Seamless loop

End on exactly frame one: same geometry and scale, and matching velocity for anything moving. A constant-speed
push (`scale = K - PUSH * t` from t = 0, and `K + PUSH * (DUR - t)` as the loop lands) carries straight through.
If two renders of the same frame differ slightly (e.g. a stage-space cover vs. the live scene), keep the cover up
for ~0.5s and dissolve it while both are still. Verify: `framecheck.py seam` → mean ≈ 0.

## Squircles (Figma corner smoothing)

`clip-path: path(squircle(x, y, w, h, r, 0.6))` — port of figma-squircle with "preserve smoothing". Draw strokes
as a matching SVG path (inset box-shadows follow border-radius, not the squircle). Animated clips (crop, card,
nav highlight, wipes, loop reveal) all go through the same function so the corners stay continuous in motion.

## Shadows

Very large blurs (≈400px) get clipped by Chrome with a hard edge, and re-blurring every frame drops frames.
Bake the shadow once into a small canvas (quarter resolution, `shadowBlur` drawn off-canvas) and only
`transform`/`opacity` it; crossfade two baked plates if the blur radius changes between states.

## Video sync

Use `player.drive(video, clipTime, rate, live)`. Never seek a playing video to fix drift (visible hitch) — it nudges
`playbackRate` ±6%. Pause videos nobody can see (e.g. covered by a reveal) to save decode.
