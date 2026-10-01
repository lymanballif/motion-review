---
name: motion-review
description: Build and review timeline animations (loops, showreel and case-study motion, marketing and social animations) with a review harness — play/pause, timecode, beat-labelled scrubber, ½× and ¼× speed, timestamped notes a reviewer can copy and paste back, and a frame-exact 60fps MP4 export. Use when building a keyframed or looping animation someone will review, when the user wants to leave or send timestamped animation notes, when notes arrive in the form "3.61s — …", or when an animation needs exporting to video (Instagram, case studies).
---

# Motion review

A kit for making time-based animations that people can review precisely. Two drop-in files give any page a
deterministic clock and a review bar; three scripts serve, inspect and export it. The workflow it enables:

1. You build the animation as **one pure function of time**, `render(t)`, on a fixed artboard.
2. The reviewer scrubs, slows it to ½× or ¼×, presses **N** to note a moment, previews it as an Instagram post (**I**),
   and pastes you `12.34s — note` lines.
3. You map each timestamp to a named phase, look at those exact frames headlessly, fix, and verify.
4. **Export MP4** renders every frame exactly (no dropped frames, videos frame-accurate) at 2× and encodes H.264.

## Files

| Path | What it is |
| --- | --- |
| `assets/anim-player.js` | `AnimPlayer.create({ duration, size, render, beats, keyframes })` — clock, loop, pause, seek, speed, URL params, `drive()` for `<video>`, export hooks |
| `assets/review-bar.js` | `ReviewBar.mount(player, { storageKey, instagram })` + `ReviewBar.fit(stage)` — the whole review UI (styles injected, no dependencies) |
| `assets/template.html` | Minimal working page wiring both, with the stage-fit pattern |
| `scripts/serve.py` | Threaded static server with Range requests (needed for video) and the local-only `/api/export` endpoint |
| `scripts/export.py` + `encode.swift` | Frame-exact render (Playwright) → H.264 MP4 via AVFoundation (no ffmpeg) |
| `scripts/framecheck.py` | `sheet`, `crop`, `seam`, `steps`, `clip` — frames at timestamps, loop seam, pops, and video contact sheets for picking in-points |
| `references/notes-workflow.md` | How to turn timestamped notes into precise changes — read before acting on notes |
| `references/techniques.md` | Copy-ready code for the patterns below (shrinking crops, subject-locked zoom, film glide-to-stop, menu wipes, seamless loops, squircles, baked shadows) |

## Setup in a project

`SKILL_DIR` is wherever this skill is installed (e.g. `~/.claude/skills/motion-review`).

```bash
mkdir -p vendor/motion-review tools
cp "$SKILL_DIR"/assets/{anim-player,review-bar}.js vendor/motion-review/
cp "$SKILL_DIR"/scripts/* tools/
cp "$SKILL_DIR"/assets/template.html index.html   # only for a new page
python3 tools/serve.py 5178                        # then open http://localhost:5178
```

Needs Python Playwright (`pip install playwright && playwright install chromium`) for inspect/export, and
Xcode command line tools (`swift`) for encoding. For a preview pane, point a launch config at `tools/serve.py`.
To share for review, tunnel the port (e.g. `cloudflared tunnel --url http://localhost:5178`); export is refused
through the tunnel on purpose (it renders on this machine). Notes live in each viewer's localStorage — remote
reviewers use **Copy all** and send the text.

## Building the animation (the contract)

- **Fixed artboard** (`#stage`, e.g. 1080×1350 for a 4:5 post), `position: absolute`. Call `ReviewBar.fit(stage)` once:
  it scales the artboard into the free space (above the two-row bar, beside the notes panel when it's open, or inside
  the Instagram post preview) and re-fits on resize and toggles. `?actual` renders 1:1.
- **`render(t)` must be pure**: everything derives from `t` — no CSS transitions, no `setTimeout`, no accumulated state.
  That is what makes scrubbing, slow motion, notes and frame-exact export trustworthy.
- **Name the phases** in one table, `const T = { photoToItem: [0.5, 1.75], … }`, and give the player `beats` from it.
  Every retime then happens in one place, and notes map to names.
- Progress per phase: `seg(t, a, b, ease)` → 0…1, then `mix(from, to, p)`. Chain phases by nesting mixes.
- Media: `<video>` elements are moved with `player.drive(video, clipTimeAt(t), rate, live)` — plays natively while
  live (rate-nudged, never seeked mid-play), seeks exactly when paused or exporting.
- Start with `player.start([extraPromises])` after fonts/images/videos (it waits for those it can see).

## Motion craft that held up in review

- Animate only `transform`, `opacity`, `clip-path`, `filter`; resizing boxes snaps to pixels and reads as jitter.
- Premium easing = gentle departure, long landing: moves `cubic-bezier(.6,0,.1,1)`, entrances `(.23,1,.32,1)`.
  Strong symmetric in-outs create "dead" time at both ends; overlap phases by ~0.1–0.3s for fluidity.
- Holds should still be alive: slow linear drift (≈3% scale) on photography, films keep playing.
- Scaling a crop and its image about **different origins** reads as the image sliding; anchor both on the subject.
- Swaps: never exit-then-enter (empty frame = "flash"); never 50/50 crossfade photos (double exposure). A
  directional, softly feathered mask wipe from the side the nav is heading, with ~28px parallax, reads premium.
- Stopping a film smoothly: don't slow the `<video>` (browsers step and jump). Pre-decode the few frames of the
  slow-down and blend neighbours on a canvas at an eased clip position.
- Seamless loop: end on exactly frame one — same geometry, same scale, and matching velocity if something is
  moving (e.g. a constant-speed push that continues through t=0). Verify with `framecheck.py seam` (mean ≈ 0).
- Headless rendering must use full Chromium (`channel='chromium'`, new headless): Playwright's default headless shell
  silently drops `backdrop-filter`, so frosted/glass elements export unblurred. The scripts already do this.
- Very large box-shadow blurs get clipped in Chrome; bake shadows to a canvas once and only transform them.
- Continuous corners: squircle `clip-path: path()` (Figma corner smoothing 0.6) with the stroke drawn as a
  matching SVG path — an inset box-shadow stroke won't follow the curve.

## Tunable transitions (the Motion panel)

Declare the key transitions once and read their live values in `render(t)`; the reviewer can then change each one's
**feel** (curated presets with plain-language names, or a custom curve they drag), **timing** (duration, start) and
**style** (for swaps), preview just that transition on a loop, and send you the result.

```js
const T = { photoToItem: [0.5, 1.75], swap: [5.45, 6.3] };
let M = null;                                    // declared before render; set after the player exists
function render(t) {
  const e = seg(t, ...T.photoToItem, M.photoToItem.ease);
  if (M.swap.type === 'slide') { /* … */ }
}
const player = AnimPlayer.create({ duration, size, render, beats: [['Item', T.photoToItem]] });
M = player.tune({
  photoToItem: { label: 'Photo becomes a button', at: T.photoToItem, ease: 'glide' },          // preset key
  swap: { label: 'Learn → About', at: T.swap, curve: [.65, 0, .1, 1], type: 'wipe', types: ['wipe', 'slide', 'dissolve', 'rise'] },
}, { storageKey: 'my-anim-motion' });
```

- Presets (`AnimPlayer.EASES`): **Glide** `.6,0,.1,1` · **Settle** `.5,0,.1,1` · **Poise** `.65,0,.35,1` · **Snap** `.77,0,.175,1`
  (movement) · **Arrive** `.23,1,.32,1` · **Bloom** `.16,1,.3,1` · **Lively** `.34,1.3,.64,1` (entrances) · **Depart**
  `.7,0,.84,0` (exits) · **Natural** · **Linear**. `kind: 'move'|'enter'|'exit'` decides which are marked *Suggested*.
- `at` arrays are retimed in place, so pass the same arrays you read in `render`. Anything derived from a phase time
  must be computed live (a function), not cached at load.
- `types` is free-form; implement each style in your render and name/describe them in `AnimPlayer.TYPE_INFO`
  (wipe, slide, dissolve, rise are pre-described).
- Changes persist per viewer, travel into **Export MP4** (`?tune=`), and **Copy changes** (or Notes → Copy all)
  produces a plain-language list, e.g. `Learn → About [a56]: feel custom → Snap cubic-bezier(.77, 0, .175, 1)`.
  When you receive one, bake the values into the defaults in `player.tune({...})` and the code, then verify.

## The review bar

Two rows: a full-width scrubber labelled with `beats`, then play/pause · timecode · 1× ½× ¼× · **Motion** · **Notes**
(a drawer with two tabs; the stage is refitted beside it) · **+ Note** · **Instagram** · **Export MP4**. The notes panel and Instagram preview are remembered per
viewer. **I** cycles the Instagram preview: off → white backdrop (card with a soft shadow) → black backdrop; the post
itself is always light mode. `?ig=light` / `?ig=dark` opens straight into it (handy for sharing). Configure the post with
`instagram: { handle, subtitle, caption, likes, comments, slides, avatar }` — `slides > 1` adds the carousel counter and dots.

Keys: Space play/pause · ←/→ one frame (Shift = 0.5s) · 1–9 keyframes · N new note · M motion · L notes · I Instagram · S speed · Esc closes.

## Acting on notes

Read `references/notes-workflow.md`. In short: map each timestamp to its phase (look at t−0.3…t+0.1s),
render those frames with `framecheck.py sheet` before changing anything, change the smallest thing (usually
`T` or one curve), re-verify the moment, the seam and the step scan, then answer note by note.

## Export

The bar's **Export MP4** (localhost only) or `python3 tools/export.py --fps 60 --scale 2`.
Output: `exports/*.mp4`, H.264 High, ~40 Mbps, frame size from `size`, rendered at 2× and downscaled.
A 10s loop at 60fps takes ~8 minutes. Instagram accepts it as-is (1080×1350, 4:5).
