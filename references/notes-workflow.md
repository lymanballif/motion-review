# Working from timestamped notes

Reviewers leave notes in the bar (N), then **Copy all** and paste them to you:

```
2.67s — the "5 Markers" block should come from the back
3.94s — this pause was too long, better easing
6.85s — this moment feels like a flash bang
```

## 1. Map every timestamp to a phase

Read the `T` table. For each note, name the phase it lands in and where inside it
(e.g. `3.94s → hold between a23 (ends 3.05) and a34 (starts 3.85)`, or `6.85s → a56 @ 6% — the first frames of the swap`).
Timestamps are in real timeline seconds regardless of the speed the reviewer watched at.

Notes land a little late: people react after they see something. Look at **t − 0.3s … t + 0.1s**.

## 2. Look before you change anything

```
python3 tools/framecheck.py sheet 2.4,2.55,2.7,2.85        # the moment, frame by frame
python3 tools/framecheck.py crop 1.31 100,450,880,450      # zoom into the region they mean
```

Say what you see that explains the note. Common translations:

| They say | Usually means |
| --- | --- |
| "pause too long" / "dead" | a hold between phases, or a strong ease-in-out whose slow start extends the stillness |
| "pause here briefly" | two phases overlap; separate them by 0.1–0.25s |
| "jittery" | layout properties animated (snapping), a playing video being seeked, a capped clock drifting from video |
| "pulling / sliding" | two things scaling about different origins (e.g. crop vs. image) |
| "flash" | an empty or white frame between an exit and an entrance — overlap them |
| "cheap" crossfade | two images at 50% each (double exposure) — use a directional wipe/mask instead |
| "appears early" | an entrance starts before the exit has visibly begun — delay 0.1s |
| "should come from the back" | z-order + slight scale-up (0.92→1), not a slide over |
| "changes size twice" | an element interpolated in two separate phases — collapse to one |

## 3. Change the smallest thing, then verify

- Retime in `T` only; keep phases named. Prefer overlap over holds when they ask for "fluid".
- After every change run `framecheck.py sheet` on the noted moment, `framecheck.py seam` if anything near t=0 or the loop moved,
  and `framecheck.py steps` when they mention jitter/pops.
- Reply per note: the timestamp, what caused it, what changed (numbers), how you verified it.
