# motion-review

An agent skill for building and reviewing timeline animations — loops, showreel and case-study motion,
social posts — with a review harness that lets people leave **timestamped notes** and export a **frame-exact MP4**.

![Review bar with timestamped notes](docs/review-bar.png)

## What you get

- **Review bar** (`assets/review-bar.js`) — drop-in UI: play/pause, timecode, a scrubber labelled with your
  animation's beats, **1× · ½× · ¼×** speed, notes pinned to the current moment (**N**), **Copy all** as
  `1.85s — note` lines to paste to your agent, and **Export MP4**.
- **Player** (`assets/anim-player.js`) — a deterministic clock around one pure `render(t)` function: loop,
  pause, seek, review speed, shareable `?t=` / `?speed=` links, native `<video>` kept in sync without hitches,
  and hooks for frame-exact export.
- **Scripts** — `serve.py` (static server with range requests for video + local-only export endpoint),
  `export.py` + `encode.swift` (60fps, 2× supersampled H.264 via AVFoundation, no ffmpeg),
  `framecheck.py` (contact sheets at timestamps, loop-seam check, pop/jitter scan).
- **Guidance** (`SKILL.md`, `references/notes-workflow.md`) — how the agent should build animations for review
  and turn notes like *"3.94s — this pause was too long"* into precise, verified changes.

## Install

Copy the folder into your agent's skills directory, e.g. for Claude Code:

```bash
git clone https://github.com/lymanballif/motion-review ~/.claude/skills/motion-review
```

Then ask your agent to build an animation, or paste it timestamped notes — the skill takes it from there.
See the [template](assets/template.html) for a minimal page.

## Requirements

- A browser for reviewing; Python 3 for the server.
- For `framecheck.py` / export: `pip install playwright && playwright install chromium`.
- For MP4 encoding: macOS with Xcode command line tools (`swift`).

## License

MIT
