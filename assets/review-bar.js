/* motion-review · review-bar.js
 * Drop-in review UI for an AnimPlayer, on two rows:
 *   row 1 — full-width scrubber with the animation's beats labelled
 *   row 2 — play/pause · timecode · 1× ½× ¼× · Notes (toggle) · + Note · Instagram (toggle) · Export MP4
 * The notes panel can be shown/hidden and never covers the animation (the stage is fitted beside it).
 * The Instagram toggle frames the stage as a feed post (header, actions, likes, caption) to judge it in context.
 * Hidden entirely with ?clean / ?actual / ?export so recordings and exports stay clean.
 *
 *   ReviewBar.mount(player, {
 *     storageKey: 'my-anim-notes',
 *     instagram: { handle: 'yourstudio', caption: 'A new menu for …', likes: '1,284', slides: 3 },
 *   });
 *   ReviewBar.fit(stageEl);   // positions + scales the stage (call once; it re-fits on resize/toggles)
 *
 * Keys: Space play/pause · ←/→ 1 frame (Shift 0.5s) · 1–9 keyframes · N new note · L notes panel · I Instagram · S speed
 */
(function () {
  const BAR_H = 104, PANEL_W = 300, GAP = 20;
  const CSS = `
  :root { --mr-ui: #1d1d1f; --mr-ui-2: #86868b; --mr-line: rgba(0,0,0,.08); --mr-accent: #2b9f71; }
  .mr-bar { position: fixed; left: 0; right: 0; bottom: 0; height: ${BAR_H}px; box-sizing: border-box; padding: 10px 20px 12px; z-index: 2147483000;
    display: flex; flex-direction: column; gap: 10px; background: #fbfbfb; border-top: 1px solid var(--mr-line);
    font: 13px/1 ui-sans-serif, -apple-system, system-ui, sans-serif; color: var(--mr-ui); user-select: none; }
  .mr-row { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .mr-spacer { flex: 1; }
  .mr-btn { appearance: none; border: 0; background: #fff; color: var(--mr-ui); height: 36px; padding: 0 14px; border-radius: 10px;
    box-shadow: 0 0 0 1px var(--mr-line), 0 1px 2px rgba(0,0,0,.04); font: inherit; cursor: pointer; white-space: nowrap;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px; transition: transform 160ms cubic-bezier(.23,1,.32,1), background-color 160ms ease, color 160ms ease; }
  .mr-btn:active { transform: scale(.97); }
  .mr-btn:focus-visible, .mr-speed button:focus-visible { outline: 2px solid var(--mr-accent); outline-offset: 2px; }
  .mr-btn[aria-pressed="true"] { background: var(--mr-ui); color: #fff; box-shadow: none; }
  .mr-btn .k { color: var(--mr-ui-2); } .mr-btn[aria-pressed="true"] .k { color: rgba(255,255,255,.55); }
  .mr-pp { width: 36px; padding: 0; }
  .mr-tc { font-variant-numeric: tabular-nums; min-width: 104px; white-space: nowrap; }
  .mr-tc b { font-weight: 600; } .mr-tc span { color: var(--mr-ui-2); }
  .mr-speed { display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: rgba(0,0,0,.05); }
  .mr-speed button { appearance: none; border: 0; background: none; font: inherit; font-variant-numeric: tabular-nums; color: var(--mr-ui-2);
    height: 30px; min-width: 40px; border-radius: 7px; cursor: pointer; transition: background-color 160ms ease, color 160ms ease; }
  .mr-speed button[aria-checked="true"] { background: #fff; color: var(--mr-ui); box-shadow: 0 0 0 1px var(--mr-line), 0 1px 2px rgba(0,0,0,.06); }
  .mr-scrub { position: relative; height: 34px; cursor: pointer; touch-action: none; margin: 0 7px; }
  .mr-track { position: absolute; left: 0; right: 0; top: 10px; height: 4px; border-radius: 2px; background: rgba(0,0,0,.08); }
  .mr-fill { position: absolute; inset: 0; border-radius: 2px; background: var(--mr-ui); transform-origin: 0 0; }
  .mr-head { position: absolute; top: 12px; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.2); }
  .mr-tick { position: absolute; top: 7px; width: 1px; height: 10px; background: rgba(0,0,0,.18); }
  .mr-tick i { position: absolute; top: 14px; left: 0; transform: translateX(-50%); font-style: normal; font-size: 11px; color: var(--mr-ui-2); white-space: nowrap; }
  .mr-mark { position: absolute; top: 12px; width: 8px; height: 8px; margin: -14px 0 0 -4px; border-radius: 50%; background: var(--mr-accent); }
  .mr-export { min-width: 124px; font-variant-numeric: tabular-nums; }
  .mr-export.busy { color: var(--mr-ui-2); cursor: progress; }
  .mr-export.ready { background: var(--mr-ui); color: #fff; box-shadow: none; }
  .mr-notes { position: fixed; right: ${GAP}px; bottom: ${BAR_H + 16}px; width: ${PANEL_W}px; max-height: calc(100vh - ${BAR_H + 36}px); display: flex; flex-direction: column; z-index: 2147483000;
    background: #fff; border-radius: 14px; box-shadow: 0 0 0 1px var(--mr-line), 0 12px 32px rgba(0,0,0,.08);
    font: 13px/1.4 ui-sans-serif, -apple-system, system-ui, sans-serif; color: var(--mr-ui);
    transition: opacity 180ms cubic-bezier(.23,1,.32,1), transform 180ms cubic-bezier(.23,1,.32,1); }
  .mr-notes[hidden] { display: flex; opacity: 0; transform: translateY(8px); pointer-events: none; visibility: hidden; transition: opacity 140ms ease, transform 140ms ease, visibility 0s 140ms; }
  .mr-notes header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 10px 8px 14px; font-weight: 600; }
  .mr-notes header .mr-btn { height: 28px; padding: 0 10px; font-weight: 400; }
  .mr-notes .mr-x { width: 28px; padding: 0; font-size: 16px; }
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
  /* Instagram feed-post preview (light mode) */
  body.mr-ig-on { background: #fff !important; }
  .mr-ig { position: fixed; z-index: 1; pointer-events: none; font: 14px/18px -apple-system, "SF Pro Text", system-ui, sans-serif; color: #000; }
  .mr-ig-head, .mr-ig-foot { position: absolute; left: 0; right: 0; }
  .mr-ig-head { top: 0; height: 54px; display: flex; align-items: center; gap: 10px; padding: 0 12px; box-sizing: border-box; }
  .mr-ig-av { width: 32px; height: 32px; border-radius: 50%; padding: 2px; box-sizing: border-box; background: conic-gradient(from 200deg, #f9ce34, #ee2a7b, #6228d7, #f9ce34); }
  .mr-ig-av i { display: block; width: 100%; height: 100%; border-radius: 50%; border: 2px solid #fff; box-sizing: border-box; background: #dbdbdb center/cover; }
  .mr-ig-who { flex: 1; min-width: 0; } .mr-ig-who b { font-weight: 600; } .mr-ig-who div { font-size: 12px; color: #737373; line-height: 15px; }
  .mr-ig-count { position: absolute; top: 12px; right: 12px; padding: 4px 8px; border-radius: 12px; background: rgba(0,0,0,.6); color: #fff; font-size: 12px; line-height: 14px; }
  .mr-ig-foot { padding: 0 12px; box-sizing: border-box; }
  .mr-ig-acts { height: 46px; display: flex; align-items: center; gap: 16px; position: relative; }
  .mr-ig-acts svg { width: 24px; height: 24px; }
  .mr-ig-dots { position: absolute; left: 50%; transform: translateX(-50%); display: flex; gap: 4px; }
  .mr-ig-dots i { width: 6px; height: 6px; border-radius: 50%; background: #c7c7c7; } .mr-ig-dots i:first-child { background: #0095f6; }
  .mr-ig-save { margin-left: auto; }
  .mr-ig-foot p { margin: 0 0 6px; } .mr-ig-foot .muted { color: #737373; } .mr-ig-foot .tiny { font-size: 11px; letter-spacing: .2px; color: #737373; }
  @media (max-width: 720px) { .mr-tick i { display: none; } .mr-notes { right: 8px; left: 8px; width: auto; } }`;

  const ICON = {
    play: '<svg width="12" height="14" viewBox="0 0 12 14"><path d="M1 1.8v10.4a.8.8 0 0 0 1.2.7l8.8-5.2a.8.8 0 0 0 0-1.4L2.2 1.1A.8.8 0 0 0 1 1.8z" fill="currentColor"/></svg>',
    pause: '<svg width="12" height="14" viewBox="0 0 12 14"><rect x="1" y="1" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="7.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.8 3.5c-2 0-3.6 1.1-4.8 2.8-1.2-1.7-2.8-2.8-4.8-2.8A5 5 0 0 0 2 8.6c0 5.6 8.3 11 10 11.9 1.7-.9 10-6.3 10-11.9a5 5 0 0 0-5.2-5.1z" stroke-linejoin="round"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.7 16.2A9.5 9.5 0 1 0 17 20l4.5 1.3-.8-5.1z" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 3 9.2 10.1M22 3l-7 18-5.8-10.9L2 6.9 22 3z"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 21 12 13.5 4 21V3h16v18z"/></svg>',
    more: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const ReviewBar = { height: 0, player: null, notesOpen: false, instagram: false, _fit: null };

  /* Position + scale the stage into the space the review UI leaves free (or into an Instagram post). */
  ReviewBar.fit = function (stage) {
    const player = ReviewBar.player, [w, h] = player ? player.size : [stage.offsetWidth, stage.offsetHeight];
    const place = () => {
      Object.assign(stage.style, { left: '0', top: '0', transformOrigin: '0 0', margin: '0' });
      if (player && player.actual) { stage.style.transform = `translate(${(innerWidth - w) / 2}px, ${(innerHeight - h) / 2}px)`; return; }
      const bottom = ReviewBar.height, right = ReviewBar.notesOpen && innerWidth > 900 ? PANEL_W + GAP * 2 : 0;
      const aw = innerWidth - right, ah = innerHeight - bottom;
      const ig = ReviewBar._ig;
      if (ReviewBar.instagram && ig) {
        const HEAD = 54, FOOT = 168, M = 24;                                    // real Instagram feed proportions (px)
        const pw = Math.min(470, aw - M * 2, (ah - M * 2 - HEAD - FOOT) * w / h);
        const k = pw / w, mh = h * k, x = (aw - pw) / 2, y = (ah - (HEAD + mh + FOOT)) / 2;
        Object.assign(ig.style, { display: 'block', left: x + 'px', top: y + 'px', width: pw + 'px', height: HEAD + mh + FOOT + 'px' });
        ig.querySelector('.mr-ig-foot').style.top = HEAD + mh + 'px';
        ig.querySelector('.mr-ig-count').style.top = HEAD + 12 + 'px';
        stage.style.transform = `translate(${x}px, ${y + HEAD}px) scale(${k})`;
        return;
      }
      if (ig) ig.style.display = 'none';
      const k = Math.min(aw / w, ah / h);
      stage.style.transform = `translate(${(aw - w * k) / 2}px, ${(ah - h * k) / 2}px) scale(${k})`;
    };
    ReviewBar._fit = place;
    addEventListener('resize', place); place();
    return ReviewBar;
  };
  const refit = () => ReviewBar._fit && ReviewBar._fit();

  ReviewBar.mount = function (player, opts = {}) {
    ReviewBar.player = player;
    if (player.clean) { ReviewBar.height = 0; return ReviewBar; }
    ReviewBar.height = BAR_H;
    const DUR = player.duration;
    const KEY = opts.storageKey || 'motion-review-notes:' + location.pathname;
    const exportUrl = opts.exportUrl || '/api/export';
    const igo = Object.assign({ handle: 'yourstudio', subtitle: 'Sponsored', caption: 'Motion study', likes: '1,284', comments: 48, slides: 1, avatar: '' }, opts.instagram || {});

    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const bar = document.createElement('div'); bar.className = 'mr-bar';
    bar.innerHTML = `
      <div class="mr-scrub" aria-label="Timeline"><div class="mr-track"><div class="mr-fill"></div></div><div class="mr-head"></div></div>
      <div class="mr-row">
        <button class="mr-btn mr-pp" aria-label="Pause"></button>
        <div class="mr-tc"><b>0.00</b><span> / ${DUR.toFixed(2)}s</span></div>
        <div class="mr-speed" role="radiogroup" aria-label="Playback speed" title="Playback speed (S)">
          <button data-s="1" role="radio">1×</button><button data-s="0.5" role="radio">½×</button><button data-s="0.25" role="radio">¼×</button>
        </div>
        <div class="mr-spacer"></div>
        <button class="mr-btn mr-notes-t" aria-pressed="false" title="Show or hide notes (L)">Notes <span class="k mr-count"></span></button>
        <button class="mr-btn mr-add" title="Note at the current moment (N)">+ Note <span class="k">N</span></button>
        <button class="mr-btn mr-ig-t" aria-pressed="false" title="Preview as an Instagram post (I)">Instagram <span class="k">I</span></button>
        <button class="mr-btn mr-export" hidden title="Render a frame-exact MP4 (2× supersampled)">Export MP4</button>
      </div>`;
    const panel = document.createElement('aside'); panel.className = 'mr-notes'; panel.hidden = true;
    panel.innerHTML = `<header><span>Notes</span><span style="display:flex;gap:6px"><button class="mr-btn mr-copy">Copy all</button><button class="mr-btn mr-x" aria-label="Hide notes">×</button></span></header>
      <form><input placeholder="Note at 0.00s…" autocomplete="off" aria-label="Note text"></form><ul></ul>`;
    const ig = document.createElement('div'); ig.className = 'mr-ig'; ig.style.display = 'none';
    ig.innerHTML = `
      <div class="mr-ig-head"><div class="mr-ig-av"><i style="${igo.avatar ? `background-image:url('${esc(igo.avatar)}')` : ''}"></i></div>
        <div class="mr-ig-who"><b>${esc(igo.handle)}</b>${igo.subtitle ? `<div>${esc(igo.subtitle)}</div>` : ''}</div>${ICON.more}</div>
      ${igo.slides > 1 ? `<div class="mr-ig-count">1/${igo.slides}</div>` : '<div class="mr-ig-count" hidden></div>'}
      <div class="mr-ig-foot">
        <div class="mr-ig-acts">${ICON.heart}${ICON.comment}${ICON.share}
          ${igo.slides > 1 ? `<div class="mr-ig-dots">${'<i></i>'.repeat(Math.min(igo.slides, 5))}</div>` : ''}<span class="mr-ig-save">${ICON.save}</span></div>
        <p><b>${esc(igo.likes)} likes</b></p>
        <p><b>${esc(igo.handle)}</b> ${esc(igo.caption)}</p>
        <p class="muted">View all ${esc(igo.comments)} comments</p>
        <p class="tiny">2 HOURS AGO</p>
      </div>`;
    document.body.append(ig, bar, panel);
    ReviewBar._ig = ig;

    const $ = s => bar.querySelector(s) || panel.querySelector(s);
    const pp = $('.mr-pp'), tc = $('.mr-tc b'), scrub = $('.mr-scrub'), fill = $('.mr-fill'), head = $('.mr-head');
    const input = $('input'), list = $('ul'), exportBtn = $('.mr-export'), notesT = $('.mr-notes-t'), igT = $('.mr-ig-t'), count = $('.mr-count');
    const speedBtns = [...bar.querySelectorAll('.mr-speed button')];

    // Clock → UI
    player.on('tick', t => {
      tc.textContent = t.toFixed(2);
      fill.style.transform = `scaleX(${t / DUR})`;
      head.style.left = (t / DUR) * 100 + '%';
      if (document.activeElement !== input) input.placeholder = `Note at ${t.toFixed(2)}s…`;
    });
    const syncState = () => {
      pp.innerHTML = player.paused ? ICON.play : ICON.pause;
      pp.setAttribute('aria-label', player.paused ? 'Play' : 'Pause');
      speedBtns.forEach(b => b.setAttribute('aria-checked', String(+b.dataset.s === player.speed)));
    };
    player.on('state', syncState); syncState();
    pp.onclick = () => player.toggle();
    speedBtns.forEach(b => b.onclick = () => player.setSpeed(+b.dataset.s));

    // Scrubber + beats
    player.beats.forEach(([label, at]) => {
      const d = document.createElement('div'); d.className = 'mr-tick'; d.style.left = (at / DUR) * 100 + '%';
      d.innerHTML = '<i></i>'; d.firstChild.textContent = label; scrub.appendChild(d);
    });
    let wasPlaying = false;
    const scrubTo = e => { const r = scrub.getBoundingClientRect(); player.seek(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 0.99999) * DUR); };
    scrub.addEventListener('pointerdown', e => { wasPlaying = !player.paused; scrub.setPointerCapture(e.pointerId); scrubTo(e); });
    scrub.addEventListener('pointermove', e => { if (scrub.hasPointerCapture(e.pointerId)) scrubTo(e); });
    scrub.addEventListener('pointerup', () => { if (wasPlaying) player.play(); });

    // Notes panel: show/hide (remembered); the stage is refitted beside it so it never covers the animation
    function setNotes(open) {
      ReviewBar.notesOpen = open; panel.hidden = !open; notesT.setAttribute('aria-pressed', String(open));
      store.set('mr-notes-open', open); refit();
    }
    notesT.onclick = () => setNotes(!ReviewBar.notesOpen);
    $('.mr-x').onclick = () => setNotes(false);

    // Instagram preview (remembered, and ?ig in the URL)
    function setIG(on) {
      ReviewBar.instagram = on; igT.setAttribute('aria-pressed', String(on)); document.body.classList.toggle('mr-ig-on', on);
      const u = new URL(location.href); on ? u.searchParams.set('ig', '1') : u.searchParams.delete('ig'); history.replaceState(null, '', u);
      store.set('mr-ig', on); refit();
    }
    igT.onclick = () => setIG(!ReviewBar.instagram);

    // Notes (per viewer, localStorage)
    let notes = store.get(KEY, []), noteAt = 0;
    function draw() {
      list.innerHTML = ''; scrub.querySelectorAll('.mr-mark').forEach(m => m.remove());
      notes.sort((a, b) => a.t - b.t).forEach((n, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="ts">${n.t.toFixed(2)}s</span><span class="tx"></span><button class="del" aria-label="Delete note">×</button>`;
        li.querySelector('.tx').textContent = n.text;
        li.onclick = e => { if (e.target.closest('.del')) { notes.splice(i, 1); store.set(KEY, notes); draw(); } else player.seek(n.t); };
        list.appendChild(li);
        const m = document.createElement('div'); m.className = 'mr-mark'; m.style.left = (n.t / DUR) * 100 + '%'; m.title = n.text; scrub.appendChild(m);
      });
      count.textContent = notes.length ? String(notes.length) : '';
    }
    draw();
    const startNote = () => { player.setPaused(true); noteAt = player.time; if (!ReviewBar.notesOpen) setNotes(true); input.placeholder = `Note at ${noteAt.toFixed(2)}s…`; input.focus(); };
    input.addEventListener('focus', () => { player.setPaused(true); noteAt = player.time; });
    $('.mr-add').onclick = startNote;
    panel.querySelector('form').onsubmit = e => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      notes.push({ t: +noteAt.toFixed(2), text }); store.set(KEY, notes); draw(); input.value = ''; input.blur();
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest && e.target.closest('input, textarea, [contenteditable]')) return;
      const step = e.shiftKey ? 0.5 : 1 / 30, k = e.key.toLowerCase();
      if (e.code === 'Space') { player.toggle(); e.preventDefault(); }
      else if (e.key === 'ArrowRight') player.seek(player.time + step);
      else if (e.key === 'ArrowLeft') player.seek(player.time - step);
      else if (e.key >= '1' && e.key <= '9' && player.keyframes[+e.key - 1] != null) player.seek(player.keyframes[+e.key - 1]);
      else if (k === 'n') { e.preventDefault(); startNote(); }
      else if (k === 'l') setNotes(!ReviewBar.notesOpen);
      else if (k === 'i') setIG(!ReviewBar.instagram);
      else if (k === 's') player.cycleSpeed();
    });

    // Restore UI state
    const params = new URLSearchParams(location.search);
    setNotes(store.get('mr-notes-open', false));
    setIG(params.has('ig') || store.get('mr-ig', false));
    return ReviewBar;
  };

  window.ReviewBar = ReviewBar;
})();
