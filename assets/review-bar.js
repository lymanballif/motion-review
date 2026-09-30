/* motion-review · review-bar.js
 * Drop-in review UI for an AnimPlayer: play/pause, timecode, beat-labelled scrubber, 1× · ½× · ¼× speed,
 * timestamped notes (N) with "Copy all" in `12.34s — note` format, and an Export MP4 button (when served by
 * scripts/serve.py). Hidden entirely with ?clean / ?actual / ?export so recordings and exports stay clean.
 *
 *   ReviewBar.mount(player, { storageKey: 'my-anim-notes' });
 *   ReviewBar.height  // px reserved at the bottom of the viewport (0 when hidden) — use it to fit your stage
 *
 * Keys: Space play/pause · ←/→ 1 frame (Shift = 0.5s) · 1–9 keyframes · N note · S speed · Esc leave note field
 */
(function () {
  const CSS = `
  :root { --mr-ui: #1d1d1f; --mr-ui-2: #86868b; --mr-line: rgba(0,0,0,.08); --mr-accent: #2b9f71; }
  .mr-bar { position: fixed; left: 0; right: 0; bottom: 0; height: 64px; box-sizing: border-box; padding: 0 20px; z-index: 2147483000;
    display: flex; align-items: center; gap: 16px; background: #fbfbfb; border-top: 1px solid var(--mr-line);
    font: 13px/1 ui-sans-serif, -apple-system, system-ui, sans-serif; color: var(--mr-ui); user-select: none; }
  .mr-btn { appearance: none; border: 0; background: #fff; color: var(--mr-ui); height: 36px; padding: 0 14px; border-radius: 10px;
    box-shadow: 0 0 0 1px var(--mr-line), 0 1px 2px rgba(0,0,0,.04); font: inherit; cursor: pointer;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: transform 160ms cubic-bezier(.23,1,.32,1); }
  .mr-btn:active { transform: scale(.97); }
  .mr-btn:focus-visible, .mr-speed button:focus-visible { outline: 2px solid var(--mr-accent); outline-offset: 2px; }
  .mr-pp { width: 36px; padding: 0; }
  .mr-tc { font-variant-numeric: tabular-nums; min-width: 112px; white-space: nowrap; }
  .mr-tc b { font-weight: 600; } .mr-tc span { color: var(--mr-ui-2); }
  .mr-speed { display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: rgba(0,0,0,.05); }
  .mr-speed button { appearance: none; border: 0; background: none; font: inherit; font-variant-numeric: tabular-nums; color: var(--mr-ui-2);
    height: 30px; min-width: 40px; border-radius: 7px; cursor: pointer; transition: background-color 160ms ease, color 160ms ease; }
  .mr-speed button[aria-checked="true"] { background: #fff; color: var(--mr-ui); box-shadow: 0 0 0 1px var(--mr-line), 0 1px 2px rgba(0,0,0,.06); }
  .mr-scrub { position: relative; flex: 1; height: 36px; cursor: pointer; touch-action: none; }
  .mr-track { position: absolute; left: 0; right: 0; top: 50%; height: 4px; margin-top: -2px; border-radius: 2px; background: rgba(0,0,0,.08); }
  .mr-fill { position: absolute; inset: 0; border-radius: 2px; background: var(--mr-ui); transform-origin: 0 0; }
  .mr-head { position: absolute; top: 50%; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.2); }
  .mr-tick { position: absolute; top: 50%; width: 1px; height: 10px; margin-top: -5px; background: rgba(0,0,0,.18); }
  .mr-tick i { position: absolute; top: 14px; left: 0; transform: translateX(-50%); font-style: normal; font-size: 10px; color: var(--mr-ui-2); white-space: nowrap; }
  .mr-mark { position: absolute; top: 50%; width: 8px; height: 8px; margin: -14px 0 0 -4px; border-radius: 50%; background: var(--mr-accent); }
  .mr-export { min-width: 124px; font-variant-numeric: tabular-nums; }
  .mr-export.busy { color: var(--mr-ui-2); cursor: progress; }
  .mr-export.ready { background: var(--mr-ui); color: #fff; box-shadow: none; }
  .mr-notes { position: fixed; right: 20px; bottom: 80px; width: 300px; max-height: calc(100vh - 120px); display: flex; flex-direction: column; z-index: 2147483000;
    background: #fff; border-radius: 14px; box-shadow: 0 0 0 1px var(--mr-line), 0 12px 32px rgba(0,0,0,.08);
    font: 13px/1.4 ui-sans-serif, -apple-system, system-ui, sans-serif; color: var(--mr-ui); }
  .mr-notes header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px 8px; font-weight: 600; }
  .mr-notes header .mr-btn { height: 28px; padding: 0 10px; font-weight: 400; }
  .mr-notes form { display: flex; gap: 8px; padding: 0 14px 10px; }
  .mr-notes input { flex: 1; min-width: 0; height: 32px; box-sizing: border-box; padding: 0 10px; border-radius: 8px; border: 0;
    box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); font: inherit; font-size: 16px; }
  .mr-notes input:focus { outline: none; box-shadow: inset 0 0 0 2px var(--mr-accent); }
  .mr-notes ul { list-style: none; margin: 0; padding: 0 6px 8px; overflow: auto; }
  .mr-notes li { display: flex; gap: 10px; align-items: baseline; padding: 7px 8px; border-radius: 8px; cursor: pointer; }
  .mr-notes li:hover { background: rgba(0,0,0,.04); }
  .mr-notes .ts { font-variant-numeric: tabular-nums; color: var(--mr-accent); font-weight: 600; min-width: 44px; }
  .mr-notes .tx { flex: 1; overflow-wrap: anywhere; }
  .mr-notes .del { border: 0; background: none; color: var(--mr-ui-2); cursor: pointer; font-size: 15px; padding: 0 2px; }
  .mr-notes ul:empty::before { content: "Pause anywhere and press N to leave a note at that moment."; display: block; padding: 4px 8px 6px; color: var(--mr-ui-2); }
  @media (max-width: 720px) { .mr-notes { display: none; } .mr-tick i { display: none; } }`;

  const ICON_PLAY = '<svg width="12" height="14" viewBox="0 0 12 14"><path d="M1 1.8v10.4a.8.8 0 0 0 1.2.7l8.8-5.2a.8.8 0 0 0 0-1.4L2.2 1.1A.8.8 0 0 0 1 1.8z" fill="currentColor"/></svg>';
  const ICON_PAUSE = '<svg width="12" height="14" viewBox="0 0 12 14"><rect x="1" y="1" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="7.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/></svg>';

  const ReviewBar = { height: 0 };

  ReviewBar.mount = function (player, opts = {}) {
    if (player.clean) { ReviewBar.height = 0; return ReviewBar; }
    ReviewBar.height = 64;
    const DUR = player.duration;
    const KEY = opts.storageKey || 'motion-review-notes:' + location.pathname;
    const exportUrl = opts.exportUrl || '/api/export';

    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const bar = document.createElement('div'); bar.className = 'mr-bar';
    bar.innerHTML = `
      <button class="mr-btn mr-pp" aria-label="Pause"></button>
      <div class="mr-tc"><b>0.00</b><span> / ${DUR.toFixed(2)}s</span></div>
      <div class="mr-speed" role="radiogroup" aria-label="Playback speed" title="Playback speed (S)">
        <button data-s="1" role="radio">1×</button><button data-s="0.5" role="radio">½×</button><button data-s="0.25" role="radio">¼×</button>
      </div>
      <div class="mr-scrub" aria-label="Timeline"><div class="mr-track"><div class="mr-fill"></div></div><div class="mr-head"></div></div>
      <button class="mr-btn mr-add">+ Note <span style="color:var(--mr-ui-2)">N</span></button>
      <button class="mr-btn mr-export" hidden title="Render a frame-exact MP4 (2× supersampled)">Export MP4</button>`;
    const panel = document.createElement('aside'); panel.className = 'mr-notes';
    panel.innerHTML = `<header>Notes <button class="mr-btn mr-copy">Copy all</button></header>
      <form><input placeholder="Note at 0.00s…" autocomplete="off" aria-label="Note text"></form><ul></ul>`;
    document.body.append(bar, panel);

    const $ = s => bar.querySelector(s) || panel.querySelector(s);
    const pp = $('.mr-pp'), tc = $('.mr-tc b'), scrub = $('.mr-scrub'), fill = $('.mr-fill'), head = $('.mr-head');
    const input = $('input'), list = $('ul'), exportBtn = $('.mr-export');
    const speedBtns = [...bar.querySelectorAll('.mr-speed button')];

    // Timecode + scrubber follow the clock
    player.on('tick', t => {
      tc.textContent = t.toFixed(2);
      fill.style.transform = `scaleX(${t / DUR})`;
      head.style.left = (t / DUR) * 100 + '%';
      if (document.activeElement !== input) input.placeholder = `Note at ${t.toFixed(2)}s…`;
    });
    const syncState = () => {
      pp.innerHTML = player.paused ? ICON_PLAY : ICON_PAUSE;
      pp.setAttribute('aria-label', player.paused ? 'Play' : 'Pause');
      speedBtns.forEach(b => b.setAttribute('aria-checked', String(+b.dataset.s === player.speed)));
    };
    player.on('state', syncState); syncState();
    pp.onclick = () => player.toggle();
    speedBtns.forEach(b => b.onclick = () => player.setSpeed(+b.dataset.s));

    player.beats.forEach(([label, at]) => {
      const d = document.createElement('div'); d.className = 'mr-tick'; d.style.left = (at / DUR) * 100 + '%';
      d.innerHTML = `<i></i>`; d.firstChild.textContent = label; scrub.appendChild(d);
    });
    let wasPlaying = false;
    const scrubTo = e => { const r = scrub.getBoundingClientRect(); player.seek(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 0.99999) * DUR); };
    scrub.addEventListener('pointerdown', e => { wasPlaying = !player.paused; scrub.setPointerCapture(e.pointerId); scrubTo(e); });
    scrub.addEventListener('pointermove', e => { if (scrub.hasPointerCapture(e.pointerId)) scrubTo(e); });
    scrub.addEventListener('pointerup', () => { if (wasPlaying) player.play(); });

    // Notes (per viewer, localStorage)
    const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(notes)); } catch {} };
    let notes = load(), noteAt = 0;
    function draw() {
      list.innerHTML = ''; scrub.querySelectorAll('.mr-mark').forEach(m => m.remove());
      notes.sort((a, b) => a.t - b.t).forEach((n, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="ts">${n.t.toFixed(2)}s</span><span class="tx"></span><button class="del" aria-label="Delete note">×</button>`;
        li.querySelector('.tx').textContent = n.text;
        li.onclick = e => { if (e.target.closest('.del')) { notes.splice(i, 1); save(); draw(); } else player.seek(n.t); };
        list.appendChild(li);
        const m = document.createElement('div'); m.className = 'mr-mark'; m.style.left = (n.t / DUR) * 100 + '%'; m.title = n.text; scrub.appendChild(m);
      });
    }
    draw();
    const startNote = () => { player.setPaused(true); noteAt = player.time; input.placeholder = `Note at ${noteAt.toFixed(2)}s…`; input.focus(); };
    input.addEventListener('focus', () => { player.setPaused(true); noteAt = player.time; });
    $('.mr-add').onclick = startNote;
    panel.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      notes.push({ t: +noteAt.toFixed(2), text }); save(); draw(); input.value = ''; input.blur();
    };
    $('.mr-copy').onclick = async e => {
      const txt = notes.map(n => `${n.t.toFixed(2)}s — ${n.text}`).join('\n') || '(no notes)';
      try { await navigator.clipboard.writeText(txt); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Copy failed'; }
      setTimeout(() => { e.target.textContent = 'Copy all'; }, 1400);
    };

    // Export (only shown when the page is served by scripts/serve.py)
    let poll = null;
    const download = f => { const a = document.createElement('a'); a.href = f; a.download = f.split('/').pop(); document.body.appendChild(a); a.click(); a.remove(); };
    function label(st) {
      exportBtn.classList.toggle('busy', !!st.running); exportBtn.classList.remove('ready');
      if (st.running) exportBtn.textContent = st.state === 'encoding' ? 'Encoding…' : `Rendering ${Math.round(st.progress * 100)}%`;
      else if (st.state === 'done' && st.file) { exportBtn.textContent = 'Download MP4'; exportBtn.classList.add('ready'); exportBtn.dataset.file = st.file; }
      else if (st.state === 'error') { exportBtn.textContent = 'Export failed'; exportBtn.title = st.error || ''; }
      else exportBtn.textContent = 'Export MP4';
    }
    async function tick() {
      const st = await fetch(exportUrl).then(r => r.json()).catch(() => null); if (!st) return;
      label(st);
      if (!st.running) { clearInterval(poll); poll = null; if (st.state === 'done' && st.file && exportBtn.dataset.auto) { delete exportBtn.dataset.auto; download(st.file); } }
    }
    exportBtn.onclick = async () => {
      if (exportBtn.classList.contains('busy')) return;
      if (exportBtn.classList.contains('ready')) { download(exportBtn.dataset.file); label({}); return; }
      const r = await fetch(exportUrl, { method: 'POST' }).catch(() => null);
      if (!r) { exportBtn.textContent = 'Server offline'; return; }
      if (r.status === 403) { exportBtn.textContent = 'Localhost only'; exportBtn.title = (await r.json()).error; return; }
      exportBtn.dataset.auto = '1'; label(await r.json()); poll = poll || setInterval(tick, 700);
    };
    fetch(exportUrl).then(r => r.ok ? r.json() : null).then(st => {
      if (!st) return;
      exportBtn.hidden = false;
      if (st.running) { label(st); poll = setInterval(tick, 700); }
    }).catch(() => {});

    // Keyboard
    addEventListener('keydown', e => {
      if (e.target === input) { if (e.key === 'Escape') input.blur(); return; }
      if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
      const step = e.shiftKey ? 0.5 : 1 / 30;
      if (e.code === 'Space') { player.toggle(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') player.seek(player.time + step);
      else if (e.key === 'ArrowLeft') player.seek(player.time - step);
      else if (e.key >= '1' && e.key <= '9' && player.keyframes[+e.key - 1] != null) player.seek(player.keyframes[+e.key - 1]);
      else if (e.key === 'n' || e.key === 'N') { e.preventDefault(); startNote(); }
      else if (e.key === 's' || e.key === 'S') player.cycleSpeed();
    });
    return ReviewBar;
  };

  window.ReviewBar = ReviewBar;
})();
