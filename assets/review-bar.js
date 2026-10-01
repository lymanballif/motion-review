/* motion-review · review-bar.js
 * Drop-in review UI for an AnimPlayer.
 *   Bar, row 1 — full-width scrubber with the animation's beats.
 *   Bar, row 2 — play/pause · timecode · 1× ½× ¼× · Motion · Notes · + Note · Instagram · Export MP4.
 *   Side drawer (never covers the stage — it's refitted beside it), two tabs:
 *     Motion — the animation's key transitions (declared with player.tune): curated feel presets with live curve
 *              previews, a draggable custom-curve editor, duration/start timing, transition style, and "Preview this"
 *              to loop just that transition. Changes apply live, persist, export, and copy as plain language.
 *     Notes  — notes pinned to moments, Copy all (includes motion changes).
 *   Instagram — frames the stage as a light-mode feed post; cycles off → White backdrop → Black backdrop.
 * Hidden entirely with ?clean / ?actual / ?export.
 *
 *   ReviewBar.mount(player, { storageKey, instagram: { handle, subtitle, caption, likes, comments, slides } });
 *   ReviewBar.fit(stageEl);
 *
 * Keys: Space · ←/→ (Shift 0.5s) · 1–9 keyframes · N note · M motion · L notes · I Instagram · S speed · Esc close
 */
(function () {
  const BAR_H = 104, PANEL_W = 344, GAP = 20;
  const CSS = `
  :root { --mr-ui: #1d1d1f; --mr-ui-2: #86868b; --mr-ui-3: #aeaeb2; --mr-line: rgba(0,0,0,.08); --mr-fill: rgba(0,0,0,.04); --mr-accent: #2b9f71;
    --mr-ease: cubic-bezier(.23,1,.32,1); }
  .mr-bar { position: fixed; left: 0; right: 0; bottom: 0; height: ${BAR_H}px; box-sizing: border-box; padding: 10px 20px 12px; z-index: 2147483000;
    display: flex; flex-direction: column; gap: 10px; background: #fbfbfb; border-top: 1px solid var(--mr-line);
    font: 13px/1 ui-sans-serif, -apple-system, system-ui, sans-serif; color: var(--mr-ui); user-select: none; -webkit-font-smoothing: antialiased; }
  .mr-row { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .mr-spacer { flex: 1; }
  .mr-btn { appearance: none; border: 0; background: #fff; color: var(--mr-ui); height: 36px; padding: 0 14px; border-radius: 10px;
    box-shadow: 0 0 0 1px var(--mr-line), 0 1px 2px rgba(0,0,0,.04); font: inherit; cursor: pointer; white-space: nowrap;
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    transition: transform 160ms var(--mr-ease), background-color 160ms ease, color 160ms ease, box-shadow 160ms ease; }
  .mr-btn:active { transform: scale(.97); }
  .mr-btn:focus-visible, .mr-seg button:focus-visible, .mr-tile:focus-visible, .mr-card-h:focus-visible, .mr-tab:focus-visible { outline: 2px solid var(--mr-accent); outline-offset: 2px; }
  .mr-btn[aria-pressed="true"] { background: var(--mr-ui); color: #fff; box-shadow: none; }
  .mr-btn .k { color: var(--mr-ui-3); font-size: 12px; } .mr-btn[aria-pressed="true"] .k { color: rgba(255,255,255,.5); }
  .mr-btn.quiet { background: transparent; box-shadow: none; color: var(--mr-ui-2); } .mr-btn.quiet:hover { background: var(--mr-fill); color: var(--mr-ui); }
  .mr-pp { width: 36px; padding: 0; }
  .mr-tc { font-variant-numeric: tabular-nums; min-width: 104px; white-space: nowrap; }
  .mr-tc b { font-weight: 600; } .mr-tc span { color: var(--mr-ui-2); }
  .mr-seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 10px; background: rgba(0,0,0,.05); }
  .mr-seg button { appearance: none; border: 0; background: none; font: inherit; font-variant-numeric: tabular-nums; color: var(--mr-ui-2);
    height: 30px; min-width: 40px; padding: 0 10px; border-radius: 7px; cursor: pointer; transition: background-color 160ms ease, color 160ms ease; }
  .mr-seg button[aria-checked="true"], .mr-seg button[aria-selected="true"] { background: #fff; color: var(--mr-ui); box-shadow: 0 0 0 1px var(--mr-line), 0 1px 2px rgba(0,0,0,.06); }
  .mr-scrub { position: relative; height: 34px; cursor: pointer; touch-action: none; margin: 0 7px; }
  .mr-track { position: absolute; left: 0; right: 0; top: 10px; height: 4px; border-radius: 2px; background: rgba(0,0,0,.08); }
  .mr-fill { position: absolute; inset: 0; border-radius: 2px; background: var(--mr-ui); transform-origin: 0 0; }
  .mr-range { position: absolute; top: 6px; height: 12px; border-radius: 6px; background: rgba(43,159,113,.18); box-shadow: inset 0 0 0 1px rgba(43,159,113,.5); display: none; }
  .mr-head { position: absolute; top: 12px; width: 14px; height: 14px; margin: -7px 0 0 -7px; border-radius: 50%; background: #fff;
    box-shadow: 0 0 0 1px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.2); }
  .mr-tick { position: absolute; top: 7px; width: 1px; height: 10px; background: rgba(0,0,0,.18); }
  .mr-tick i { position: absolute; top: 14px; left: 0; transform: translateX(-50%); font-style: normal; font-size: 11px; color: var(--mr-ui-2); white-space: nowrap; }
  .mr-mark { position: absolute; top: 12px; width: 8px; height: 8px; margin: -14px 0 0 -4px; border-radius: 50%; background: var(--mr-accent); }
  .mr-export { min-width: 124px; font-variant-numeric: tabular-nums; }
  .mr-export.busy { color: var(--mr-ui-2); cursor: progress; }
  .mr-export.ready { background: var(--mr-ui); color: #fff; box-shadow: none; }
  .mr-badge { min-width: 16px; height: 16px; padding: 0 4px; box-sizing: border-box; border-radius: 8px; background: var(--mr-accent); color: #fff; font-size: 10px; line-height: 16px; text-align: center; }
  .mr-badge:empty { display: none; }

  /* Drawer */
  .mr-panel { position: fixed; right: ${GAP}px; top: ${GAP}px; bottom: ${BAR_H + 16}px; width: ${PANEL_W}px; display: flex; flex-direction: column; z-index: 2147483000;
    background: #fff; border-radius: 16px; box-shadow: 0 0 0 1px var(--mr-line), 0 16px 40px rgba(0,0,0,.08);
    font: 13px/1.4 ui-sans-serif, -apple-system, system-ui, sans-serif; color: var(--mr-ui); -webkit-font-smoothing: antialiased;
    transition: opacity 200ms var(--mr-ease), transform 200ms var(--mr-ease); }
  .mr-panel[hidden] { display: flex; opacity: 0; transform: translateX(12px); pointer-events: none; visibility: hidden; transition: opacity 140ms ease, transform 140ms ease, visibility 0s 140ms; }
  .mr-panel-h { display: flex; align-items: center; gap: 8px; padding: 12px 12px 10px; border-bottom: 1px solid var(--mr-line); }
  .mr-panel-h .mr-seg { flex: 1; } .mr-panel-h .mr-seg button { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
  .mr-x { width: 30px; height: 30px; padding: 0; font-size: 16px; }
  .mr-tabpane { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .mr-tabpane[hidden] { display: none; }
  .mr-scroll { flex: 1; overflow: auto; padding: 10px; overscroll-behavior: contain; }
  .mr-foot { display: flex; gap: 8px; padding: 10px 12px 12px; border-top: 1px solid var(--mr-line); }
  .mr-foot .mr-btn { flex: 1; height: 32px; }
  .mr-hint { color: var(--mr-ui-2); padding: 6px 6px 10px; }

  /* Motion: transition cards */
  .mr-card { border-radius: 12px; transition: background-color 160ms ease; }
  .mr-card + .mr-card { margin-top: 4px; }
  .mr-card[data-open="true"] { background: var(--mr-fill); }
  .mr-card-h { appearance: none; border: 0; background: none; width: 100%; display: flex; align-items: center; gap: 10px; padding: 10px; border-radius: 12px; cursor: pointer; text-align: left; font: inherit; color: inherit; }
  .mr-card-h:hover { background: var(--mr-fill); }
  .mr-card[data-open="true"] .mr-card-h:hover { background: transparent; }
  .mr-card-h svg.ic { flex: none; width: 30px; height: 30px; border-radius: 8px; background: #fff; box-shadow: 0 0 0 1px var(--mr-line); }
  .mr-card-h .t { flex: 1; min-width: 0; } .mr-card-h b { display: block; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mr-card-h small { display: block; color: var(--mr-ui-2); font-variant-numeric: tabular-nums; }
  .mr-card-h .dot { width: 7px; height: 7px; border-radius: 50%; background: var(--mr-accent); visibility: hidden; } .mr-card[data-changed="true"] .dot { visibility: visible; }
  .mr-card-h .chev { color: var(--mr-ui-3); transition: transform 200ms var(--mr-ease); } .mr-card[data-open="true"] .chev { transform: rotate(90deg); }
  .mr-card-b { padding: 2px 10px 12px; }
  .mr-sec { display: flex; align-items: baseline; justify-content: space-between; margin: 12px 2px 8px; font-size: 11px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--mr-ui-2); }
  .mr-sec span { text-transform: none; letter-spacing: 0; font-weight: 400; }
  .mr-tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .mr-tile { appearance: none; border: 0; background: #fff; border-radius: 10px; padding: 8px; text-align: left; font: inherit; color: inherit; cursor: pointer;
    box-shadow: 0 0 0 1px var(--mr-line); display: grid; grid-template-columns: 40px 1fr; gap: 2px 8px; align-items: center; transition: box-shadow 160ms ease, transform 160ms var(--mr-ease); }
  .mr-tile:active { transform: scale(.98); }
  .mr-tile[aria-pressed="true"] { box-shadow: 0 0 0 2px var(--mr-ui); }
  .mr-tile svg { grid-row: span 2; width: 40px; height: 40px; overflow: visible; }
  .mr-tile b { font-weight: 600; font-size: 12.5px; } .mr-tile b em { font-style: normal; font-weight: 500; font-size: 10px; color: var(--mr-accent); margin-left: 4px; }
  .mr-tile small { color: var(--mr-ui-2); font-size: 11px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .mr-tile .dot { fill: var(--mr-ui); }
  .mr-tile:hover .dot { animation: mr-dot 1.3s var(--c) infinite alternate; }
  @keyframes mr-dot { from { transform: translate(0, 0); } to { transform: translate(var(--dx), 0); } }
  .mr-editor { background: #fff; border-radius: 12px; box-shadow: 0 0 0 1px var(--mr-line); padding: 10px; margin-top: 6px; }
  .mr-editor svg { display: block; width: 100%; height: auto; touch-action: none; }
  .mr-editor .h { cursor: grab; } .mr-editor .h:active { cursor: grabbing; }
  .mr-editor-row { display: flex; gap: 8px; align-items: center; margin-top: 8px; }
  .mr-editor input { flex: 1; min-width: 0; height: 30px; box-sizing: border-box; padding: 0 8px; border: 0; border-radius: 8px; font: 12px ui-monospace, monospace; box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); }
  .mr-editor input:focus { outline: none; box-shadow: inset 0 0 0 2px var(--mr-accent); }
  .mr-lane { position: relative; height: 18px; border-radius: 9px; background: var(--mr-fill); margin-top: 8px; }
  .mr-lane i { position: absolute; left: 3px; top: 3px; width: 12px; height: 12px; border-radius: 50%; background: var(--mr-ui); animation: mr-lane 1.6s var(--c) infinite alternate; }
  @keyframes mr-lane { to { left: calc(100% - 15px); } }
  .mr-slider { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; align-items: center; background: #fff; border-radius: 10px; padding: 10px 12px; box-shadow: 0 0 0 1px var(--mr-line); }
  .mr-slider + .mr-slider { margin-top: 6px; }
  .mr-slider label { font-weight: 500; } .mr-slider output { font-variant-numeric: tabular-nums; color: var(--mr-ui-2); }
  .mr-slider input { grid-column: span 2; width: 100%; accent-color: var(--mr-ui); margin: 2px 0; }
  .mr-slider .ends { grid-column: span 2; display: flex; justify-content: space-between; font-size: 11px; color: var(--mr-ui-3); }
  .mr-styles { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
  .mr-styles .mr-tile { grid-template-columns: 1fr; }
  .mr-actions { display: flex; gap: 6px; margin-top: 12px; } .mr-actions .mr-btn { flex: 1; height: 32px; }

  /* Notes */
  .mr-notes form { display: flex; gap: 8px; padding: 0 2px 8px; }
  .mr-notes input { flex: 1; min-width: 0; height: 34px; box-sizing: border-box; padding: 0 10px; border-radius: 9px; border: 0; box-shadow: inset 0 0 0 1px rgba(0,0,0,.12); font: inherit; font-size: 16px; }
  .mr-notes input:focus { outline: none; box-shadow: inset 0 0 0 2px var(--mr-accent); }
  .mr-notes ul { list-style: none; margin: 0; padding: 0; }
  .mr-notes li { display: flex; gap: 10px; align-items: baseline; padding: 8px; border-radius: 9px; cursor: pointer; }
  .mr-notes li:hover { background: var(--mr-fill); }
  .mr-notes .ts { font-variant-numeric: tabular-nums; color: var(--mr-accent); font-weight: 600; min-width: 44px; }
  .mr-notes .tx { flex: 1; overflow-wrap: anywhere; }
  .mr-notes .del { border: 0; background: none; color: var(--mr-ui-2); cursor: pointer; font-size: 15px; padding: 0 2px; }
  .mr-notes ul:empty::before { content: "Pause anywhere and press N to leave a note at that moment."; display: block; padding: 4px 8px; color: var(--mr-ui-2); }

  /* Instagram preview */
  body.mr-ig-light { background: #fff !important; }
  body.mr-ig-dark { background: #000 !important; }
  .mr-ig { position: fixed; z-index: 0; pointer-events: none; font: 14px/18px -apple-system, "SF Pro Text", system-ui, sans-serif; color: #000;
    background: #fff; border-radius: 12px; overflow: hidden; }
  body.mr-ig-light .mr-ig { box-shadow: 0 0 0 1px rgba(0,0,0,.04), 0 2px 6px rgba(0,0,0,.04), 0 24px 64px rgba(0,0,0,.12); }
  .mr-ig-tag { font-size: 11px; color: var(--mr-ui-2); } .mr-btn[aria-pressed="true"] .mr-ig-tag { color: rgba(255,255,255,.6); }
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
  @media (max-width: 760px) { .mr-tick i { display: none; } .mr-panel { left: 8px; right: 8px; width: auto; } .mr-btn .k { display: none; } }
  @media (prefers-reduced-motion: reduce) { .mr-tile:hover .dot, .mr-lane i { animation: none; } }`;

  const ICON = {
    play: '<svg width="12" height="14" viewBox="0 0 12 14"><path d="M1 1.8v10.4a.8.8 0 0 0 1.2.7l8.8-5.2a.8.8 0 0 0 0-1.4L2.2 1.1A.8.8 0 0 0 1 1.8z" fill="currentColor"/></svg>',
    pause: '<svg width="12" height="14" viewBox="0 0 12 14"><rect x="1" y="1" width="3.5" height="12" rx="1" fill="currentColor"/><rect x="7.5" y="1" width="3.5" height="12" rx="1" fill="currentColor"/></svg>',
    chev: '<svg class="chev" width="14" height="14" viewBox="0 0 14 14"><path d="M5 3l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    loop: '<svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6a4.5 4.5 0 0 1 8-2.5L12 5M12 1.5V5H8.5M12 8a4.5 4.5 0 0 1-8 2.5L2 9M2 12.5V9h3.5"/></svg>',
    heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16.8 3.5c-2 0-3.6 1.1-4.8 2.8-1.2-1.7-2.8-2.8-4.8-2.8A5 5 0 0 0 2 8.6c0 5.6 8.3 11 10 11.9 1.7-.9 10-6.3 10-11.9a5 5 0 0 0-5.2-5.1z" stroke-linejoin="round"/></svg>',
    comment: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.7 16.2A9.5 9.5 0 1 0 17 20l4.5 1.3-.8-5.1z" stroke-linejoin="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M22 3 9.2 10.1M22 3l-7 18-5.8-10.9L2 6.9 22 3z"/></svg>',
    save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M20 21 12 13.5 4 21V3h16v18z"/></svg>',
    more: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>',
  };
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
                  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = n => (+n).toFixed(2);

  // Curve drawing: unit curve inside a box, y allowed to overshoot (−0.3…1.35)
  function curvePath(c, x0, y0, w, h) {
    const Y = v => y0 + h - v * h, X = v => x0 + v * w;
    return `M${X(0)} ${Y(0)} C${X(c[0])} ${Y(c[1])} ${X(c[2])} ${Y(c[3])} ${X(1)} ${Y(1)}`;
  }
  const curveIcon = (c, size = 30, pad = 7) =>
    `<svg class="ic" viewBox="0 0 ${size} ${size}"><path d="${curvePath(c, pad, pad, size - pad * 2, size - pad * 2)}" fill="none" stroke="#1d1d1f" stroke-width="1.6" stroke-linecap="round"/></svg>`;
  const tileIcon = c =>
    `<svg viewBox="0 0 40 40"><rect x=".5" y=".5" width="39" height="39" rx="9" fill="#f5f5f7"/>
      <path d="${curvePath(c, 7, 9, 26, 22)}" fill="none" stroke="#1d1d1f" stroke-width="1.6" stroke-linecap="round"/>
      <circle class="dot" cx="7" cy="35" r="2.2" style="--dx:26px"/></svg>`;

  const ReviewBar = { height: 0, player: null, panelOpen: false, tab: 'motion', instagram: false, _fit: null };

  ReviewBar.fit = function (stage) {
    const player = ReviewBar.player, [w, h] = player ? player.size : [stage.offsetWidth, stage.offsetHeight];
    const place = () => {
      Object.assign(stage.style, { left: '0', top: '0', transformOrigin: '0 0', margin: '0' });
      if (player && player.actual) { stage.style.transform = `translate(${(innerWidth - w) / 2}px, ${(innerHeight - h) / 2}px)`; return; }
      const bottom = ReviewBar.height, right = ReviewBar.panelOpen && innerWidth > 960 ? PANEL_W + GAP * 2 : 0;
      const aw = innerWidth - right, ah = innerHeight - bottom;
      const ig = ReviewBar._ig;
      if (ReviewBar.instagram && ig) {
        const HEAD = 54, FOOT = 168, M = 24;
        const pw = Math.min(470, aw - M * 2, (ah - M * 2 - HEAD - FOOT) * w / h);
        const k = pw / w, mh = h * k, x = (aw - pw) / 2, y = (ah - (HEAD + mh + FOOT)) / 2;
        Object.assign(ig.style, { display: 'block', left: x + 'px', top: y + 'px', width: pw + 'px', height: HEAD + mh + FOOT + 'px' });
        ig.querySelector('.mr-ig-foot').style.top = HEAD + mh + 'px';
        ig.querySelector('.mr-ig-count').style.top = HEAD + 12 + 'px';
        stage.style.transform = `translate(${x}px, ${y + HEAD}px) scale(${k})`; stage.style.zIndex = '1';
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
    const { EASES, TYPE_INFO, curveCss } = window.AnimPlayer;

    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    const bar = document.createElement('div'); bar.className = 'mr-bar';
    bar.innerHTML = `
      <div class="mr-scrub" aria-label="Timeline"><div class="mr-track"><div class="mr-fill"></div></div><div class="mr-range"></div><div class="mr-head"></div></div>
      <div class="mr-row">
        <button class="mr-btn mr-pp" aria-label="Pause"></button>
        <div class="mr-tc"><b>0.00</b><span> / ${DUR.toFixed(2)}s</span></div>
        <div class="mr-seg mr-speed" role="radiogroup" aria-label="Playback speed" title="Playback speed (S)">
          <button data-s="1" role="radio">1×</button><button data-s="0.5" role="radio">½×</button><button data-s="0.25" role="radio">¼×</button>
        </div>
        <div class="mr-spacer"></div>
        <button class="mr-btn mr-motion-t" aria-pressed="false" title="Tune key transitions (M)">Motion <span class="mr-badge mr-mcount"></span><span class="k">M</span></button>
        <button class="mr-btn mr-notes-t" aria-pressed="false" title="Show or hide notes (L)">Notes <span class="mr-badge mr-ncount"></span><span class="k">L</span></button>
        <button class="mr-btn mr-add" title="Note at the current moment (N)">+ Note <span class="k">N</span></button>
        <button class="mr-btn mr-ig-t" aria-pressed="false" title="Preview as an Instagram post: off → white → black (I)">Instagram <span class="mr-ig-tag"></span><span class="k">I</span></button>
        <button class="mr-btn mr-export" hidden title="Render a frame-exact MP4 (2× supersampled), including motion changes">Export MP4</button>
      </div>`;
    const panel = document.createElement('aside'); panel.className = 'mr-panel'; panel.hidden = true;
    panel.innerHTML = `
      <div class="mr-panel-h">
        <div class="mr-seg" role="tablist"><button class="mr-tab" role="tab" data-tab="motion">Motion</button><button class="mr-tab" role="tab" data-tab="notes">Notes</button></div>
        <button class="mr-btn quiet mr-x" aria-label="Close panel">×</button>
      </div>
      <section class="mr-tabpane" data-pane="motion">
        <div class="mr-scroll mr-cards"></div>
        <div class="mr-foot"><button class="mr-btn mr-copy-m">Copy changes</button><button class="mr-btn quiet mr-reset-all">Reset all</button></div>
      </section>
      <section class="mr-tabpane mr-notes" data-pane="notes" hidden>
        <div class="mr-scroll"><form><input placeholder="Note at 0.00s…" autocomplete="off" aria-label="Note text"></form><ul></ul></div>
        <div class="mr-foot"><button class="mr-btn mr-copy">Copy all</button></div>
      </section>`;
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
    const pp = $('.mr-pp'), tc = $('.mr-tc b'), scrub = $('.mr-scrub'), fill = $('.mr-fill'), head = $('.mr-head'), rangeEl = $('.mr-range');
    const input = panel.querySelector('.mr-notes input'), list = panel.querySelector('.mr-notes ul'), exportBtn = $('.mr-export');
    const motionT = $('.mr-motion-t'), notesT = $('.mr-notes-t'), igT = $('.mr-ig-t'), ncount = $('.mr-ncount'), mcount = $('.mr-mcount');
    const speedBtns = [...bar.querySelectorAll('.mr-speed button')], cards = panel.querySelector('.mr-cards');

    // ---------- clock ----------
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
      const r = player.loopRange;
      rangeEl.style.display = r ? 'block' : 'none';
      if (r) { rangeEl.style.left = (Math.max(0, r[0]) / DUR) * 100 + '%'; rangeEl.style.width = ((Math.min(DUR, r[1]) - Math.max(0, r[0])) / DUR) * 100 + '%'; }
    };
    player.on('state', syncState); syncState();
    pp.onclick = () => player.toggle();
    speedBtns.forEach(b => b.onclick = () => player.setSpeed(+b.dataset.s));

    // ---------- scrubber ----------
    function drawTicks() {
      scrub.querySelectorAll('.mr-tick').forEach(n => n.remove());
      player.beats.forEach(([label, at]) => {
        const d = document.createElement('div'); d.className = 'mr-tick'; d.style.left = (player.beatTime(at) / DUR) * 100 + '%';
        d.innerHTML = '<i></i>'; d.firstChild.textContent = label; scrub.appendChild(d);
      });
    }
    drawTicks();
    let wasPlaying = false;
    const scrubTo = e => { const r = scrub.getBoundingClientRect(); player.seek(Math.min(Math.max((e.clientX - r.left) / r.width, 0), 0.99999) * DUR); };
    scrub.addEventListener('pointerdown', e => { wasPlaying = !player.paused; if (player.loopRange) stopPreview(); scrub.setPointerCapture(e.pointerId); scrubTo(e); });
    scrub.addEventListener('pointermove', e => { if (scrub.hasPointerCapture(e.pointerId)) scrubTo(e); });
    scrub.addEventListener('pointerup', () => { if (wasPlaying) player.play(); });

    // ---------- drawer ----------
    function setPanel(open, tab = ReviewBar.tab) {
      ReviewBar.panelOpen = open; ReviewBar.tab = tab; panel.hidden = !open;
      panel.querySelectorAll('.mr-tab').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
      panel.querySelectorAll('.mr-tabpane').forEach(p => p.hidden = p.dataset.pane !== tab);
      motionT.setAttribute('aria-pressed', String(open && tab === 'motion'));
      notesT.setAttribute('aria-pressed', String(open && tab === 'notes'));
      if (!open) stopPreview();
      store.set('mr-panel', { open, tab }); refit();
    }
    const togglePanel = tab => setPanel(!(ReviewBar.panelOpen && ReviewBar.tab === tab), tab);
    motionT.onclick = () => togglePanel('motion');
    notesT.onclick = () => togglePanel('notes');
    panel.querySelectorAll('.mr-tab').forEach(b => b.onclick = () => setPanel(true, b.dataset.tab));
    panel.querySelector('.mr-x').onclick = () => setPanel(false);

    // ---------- Motion tab ----------
    const tunables = Object.values(player.tunables || {});
    let openKey = null, previewing = null;
    const rangeText = x => `${f2(x.at[0])}–${f2(x.at[1])}s`;
    const feelName = x => x.preset ? EASES[x.preset].name : 'Custom';
    function stopPreview() { if (previewing) { previewing = null; player.setLoopRange(null); cards.querySelectorAll('.mr-preview').forEach(b => { b.innerHTML = ICON.loop + ' Preview this'; b.setAttribute('aria-pressed', 'false'); }); } }
    function startPreview(x) { previewing = x.key; player.setLoopRange([Math.max(0, x.at[0] - 0.35), Math.min(DUR - 0.001, x.at[1] + 0.45)]); }
    function updateCount() { const n = tunables.filter(x => x.changed).length; mcount.textContent = n ? String(n) : ''; }
    function renderCards() {
      if (!tunables.length) { cards.innerHTML = `<p class="mr-hint">This animation hasn't declared any tunable transitions yet. Declare them with <code>player.tune({...})</code> to adjust feel, timing and style here.</p>`; return; }
      cards.innerHTML = '';
      for (const x of tunables) {
        const card = document.createElement('div'); card.className = 'mr-card'; card.dataset.key = x.key;
        card.dataset.open = String(openKey === x.key); card.dataset.changed = String(x.changed);
        card.innerHTML = `<button class="mr-card-h" aria-expanded="${openKey === x.key}">${curveIcon(x.curve)}
            <span class="t"><b></b><small>${rangeText(x)} · ${feelName(x)}${x.type ? ' · ' + (TYPE_INFO[x.type]?.name || x.type) : ''}</small></span>
            <span class="dot" title="Changed"></span>${ICON.chev}</button>`;
        card.querySelector('b').textContent = x.label;
        card.querySelector('.mr-card-h').onclick = () => {
          stopPreview();
          openKey = openKey === x.key ? null : x.key;
          if (openKey) player.seek(Math.max(0, x.at[0] - 0.15));
          renderCards();
        };
        if (openKey === x.key) card.appendChild(renderBody(x, card));
        cards.appendChild(card);
      }
      updateCount();
    }
    function refreshHeader(x, card) {
      card.dataset.changed = String(x.changed);
      card.querySelector('.mr-card-h small').textContent = `${rangeText(x)} · ${feelName(x)}${x.type ? ' · ' + (TYPE_INFO[x.type]?.name || x.type) : ''}`;
      card.querySelector('.mr-card-h svg.ic').outerHTML = curveIcon(x.curve);
      updateCount(); drawTicks();
      if (previewing === x.key) startPreview(x);
    }
    function renderBody(x, card) {
      const body = document.createElement('div'); body.className = 'mr-card-b';
      const order = Object.entries(EASES).sort(([, a], [, b]) => rank(b) - rank(a));
      function rank(e) { return e.for === x.kind ? 2 : e.for === 'any' ? 1 : 0; }
      body.innerHTML = `
        <div class="mr-sec">Feel <span>${x.kind === 'move' ? 'for on-screen movement' : x.kind === 'enter' ? 'for entrances' : x.kind === 'exit' ? 'for exits' : ''}</span></div>
        <div class="mr-tiles">${order.map(([k, e]) => `
          <button class="mr-tile" data-preset="${k}" aria-pressed="${x.preset === k}" style="--c:${curveCss(e.curve)}">${tileIcon(e.curve)}
            <b>${e.name}${rank(e) === 2 ? '<em>Suggested</em>' : ''}</b><small>${e.desc}</small></button>`).join('')}
          <button class="mr-tile mr-custom-t" aria-pressed="${!x.preset}">${tileIcon(x.curve)}<b>Custom</b><small>Shape your own curve below.</small></button>
        </div>
        <div class="mr-editor"></div>
        <div class="mr-sec">Timing</div>
        <div class="mr-slider"><label for="d-${x.key}">Duration</label><output></output>
          <input id="d-${x.key}" type="range" min="0.5" max="1.6" step="0.05" value="${x.speed}"><div class="ends"><span>Quicker</span><span>Slower</span></div></div>
        <div class="mr-slider"><label for="s-${x.key}">Starts</label><output></output>
          <input id="s-${x.key}" type="range" min="-0.5" max="0.5" step="0.05" value="${x.shift}"><div class="ends"><span>Earlier</span><span>Later</span></div></div>
        ${x.types ? `<div class="mr-sec">Style</div><div class="mr-styles">${x.types.map(tp => `
          <button class="mr-tile" data-type="${tp}" aria-pressed="${x.type === tp}"><b>${esc(TYPE_INFO[tp]?.name || tp)}</b><small>${esc(TYPE_INFO[tp]?.desc || '')}</small></button>`).join('')}</div>` : ''}
        <div class="mr-actions"><button class="mr-btn mr-preview" aria-pressed="false">${ICON.loop} Preview this</button><button class="mr-btn quiet mr-reset">Reset</button></div>`;
      const outD = body.querySelectorAll('output')[0], outS = body.querySelectorAll('output')[1];
      const labelTiming = () => {
        outD.textContent = `${(x.base.dur * x.speed).toFixed(2)}s${x.speed !== 1 ? ` (${Math.round(x.speed * 100)}%)` : ''}`;
        outS.textContent = x.shift === 0 ? 'On time' : `${Math.abs(x.shift).toFixed(2)}s ${x.shift > 0 ? 'later' : 'earlier'}`;
      };
      labelTiming();
      const editor = body.querySelector('.mr-editor');
      const syncTiles = () => {
        body.querySelectorAll('[data-preset]').forEach(b => b.setAttribute('aria-pressed', String(x.preset === b.dataset.preset)));
        const ct = body.querySelector('.mr-custom-t'); ct.setAttribute('aria-pressed', String(!x.preset));
        ct.querySelector('svg').outerHTML = tileIcon(x.curve);
      };
      const setCurve = c => { x.set({ curve: c }); syncTiles(); drawEditor(); refreshHeader(x, card); };
      body.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => setCurve(EASES[b.dataset.preset].curve.slice()));
      body.querySelector('.mr-custom-t').onclick = () => editor.querySelector('input')?.focus();
      body.querySelector(`#d-${x.key}`).oninput = e => { x.set({ speed: +e.target.value }); labelTiming(); refreshHeader(x, card); };
      body.querySelector(`#s-${x.key}`).oninput = e => { x.set({ shift: +e.target.value }); labelTiming(); refreshHeader(x, card); };
      body.querySelectorAll('[data-type]').forEach(b => b.onclick = () => {
        x.set({ type: b.dataset.type }); body.querySelectorAll('[data-type]').forEach(n => n.setAttribute('aria-pressed', String(n === b))); refreshHeader(x, card);
      });
      const pv = body.querySelector('.mr-preview');
      pv.onclick = () => {
        if (previewing === x.key) { stopPreview(); return; }
        stopPreview(); startPreview(x); pv.innerHTML = '■ Stop preview'; pv.setAttribute('aria-pressed', 'true');
      };
      body.querySelector('.mr-reset').onclick = () => { x.reset(); stopPreview(); renderCards(); };

      // Custom curve editor: drag the two handles; overshoot allowed (y −0.3…1.35)
      const W = 300, H = 210, P = 22, Y0 = -0.3, Y1 = 1.35;
      const sx = v => P + v * (W - P * 2), sy = v => P + (Y1 - v) / (Y1 - Y0) * (H - P * 2);
      const ux = px => Math.min(1, Math.max(0, (px - P) / (W - P * 2))), uy = py => Math.min(Y1, Math.max(Y0, Y1 - (py - P) / (H - P * 2) * (Y1 - Y0)));
      function drawEditor() {
        const c = x.curve;
        editor.innerHTML = `
          <svg viewBox="0 0 ${W} ${H}" aria-label="Curve editor">
            <rect x="${P}" y="${sy(1)}" width="${W - P * 2}" height="${sy(0) - sy(1)}" fill="#f5f5f7" rx="6"/>
            <text x="${P}" y="${sy(1) - 6}" font-size="10" fill="#aeaeb2">end</text><text x="${W - P}" y="${sy(0) + 14}" font-size="10" fill="#aeaeb2" text-anchor="end">time →</text>
            <line x1="${sx(0)}" y1="${sy(0)}" x2="${sx(c[0])}" y2="${sy(c[1])}" stroke="#2b9f71" stroke-width="1.2"/>
            <line x1="${sx(1)}" y1="${sy(1)}" x2="${sx(c[2])}" y2="${sy(c[3])}" stroke="#2b9f71" stroke-width="1.2"/>
            <path d="M${sx(0)} ${sy(0)} C${sx(c[0])} ${sy(c[1])} ${sx(c[2])} ${sy(c[3])} ${sx(1)} ${sy(1)}" fill="none" stroke="#1d1d1f" stroke-width="2.2" stroke-linecap="round"/>
            <circle cx="${sx(0)}" cy="${sy(0)}" r="3" fill="#1d1d1f"/><circle cx="${sx(1)}" cy="${sy(1)}" r="3" fill="#1d1d1f"/>
            <circle class="h" data-h="0" cx="${sx(c[0])}" cy="${sy(c[1])}" r="8" fill="#fff" stroke="#2b9f71" stroke-width="2.5"/>
            <circle class="h" data-h="1" cx="${sx(c[2])}" cy="${sy(c[3])}" r="8" fill="#fff" stroke="#2b9f71" stroke-width="2.5"/>
          </svg>
          <div class="mr-lane" style="--c:${curveCss(c)}" title="This is how the curve moves"><i></i></div>
          <div class="mr-editor-row"><input value="${c.map(v => v.toFixed(2)).join(', ')}" aria-label="Curve values (x1, y1, x2, y2)" spellcheck="false"></div>`;
        const svg = editor.querySelector('svg');
        svg.querySelectorAll('.h').forEach(h => {
          h.addEventListener('pointerdown', e => {
            h.setPointerCapture(e.pointerId);
            const move = ev => {
              const r = svg.getBoundingClientRect(), k = W / r.width;
              const nx = +ux((ev.clientX - r.left) * k).toFixed(3), ny = +uy((ev.clientY - r.top) * k).toFixed(3);
              const c2 = x.curve.slice(); if (h.dataset.h === '0') { c2[0] = nx; c2[1] = ny; } else { c2[2] = nx; c2[3] = ny; }
              x.set({ curve: c2 });
              h.setAttribute('cx', sx(h.dataset.h === '0' ? c2[0] : c2[2])); h.setAttribute('cy', sy(h.dataset.h === '0' ? c2[1] : c2[3]));
              const [l0, l1] = svg.querySelectorAll('line'); l0.setAttribute('x2', sx(c2[0])); l0.setAttribute('y2', sy(c2[1])); l1.setAttribute('x2', sx(c2[2])); l1.setAttribute('y2', sy(c2[3]));
              svg.querySelector('path').setAttribute('d', `M${sx(0)} ${sy(0)} C${sx(c2[0])} ${sy(c2[1])} ${sx(c2[2])} ${sy(c2[3])} ${sx(1)} ${sy(1)}`);
              editor.querySelector('input').value = c2.map(v => v.toFixed(2)).join(', ');
              editor.querySelector('.mr-lane').style.setProperty('--c', curveCss(c2));
            };
            const up = () => { h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); syncTiles(); refreshHeader(x, card); };
            h.addEventListener('pointermove', move); h.addEventListener('pointerup', up);
          });
        });
        editor.querySelector('input').onchange = e => {
          const v = e.target.value.replace(/cubic-bezier|[()]/g, '').split(/[\s,]+/).filter(Boolean).map(Number);
          if (v.length === 4 && v.every(n => !isNaN(n))) setCurve([Math.min(1, Math.max(0, v[0])), v[1], Math.min(1, Math.max(0, v[2])), v[3]]);
          else e.target.value = x.curve.map(n => n.toFixed(2)).join(', ');
        };
      }
      drawEditor();
      return body;
    }
    renderCards();
    $('.mr-reset-all').onclick = () => { player.resetAllTuning(); stopPreview(); renderCards(); drawTicks(); };
    const copy = async (btn, text, label) => {
      try { await navigator.clipboard.writeText(text); btn.textContent = 'Copied'; } catch { btn.textContent = 'Copy failed'; }
      setTimeout(() => { btn.textContent = label; }, 1400);
    };
    $('.mr-copy-m').onclick = e => copy(e.target, player.tuneSummary() || '(no motion changes)', 'Copy changes');

    // ---------- Notes tab ----------
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
      ncount.textContent = notes.length ? String(notes.length) : '';
    }
    draw();
    const startNote = () => { stopPreview(); player.setPaused(true); noteAt = player.time; setPanel(true, 'notes'); input.placeholder = `Note at ${noteAt.toFixed(2)}s…`; input.focus(); };
    input.addEventListener('focus', () => { player.setPaused(true); noteAt = player.time; });
    $('.mr-add').onclick = startNote;
    panel.querySelector('.mr-notes form').onsubmit = e => {
      e.preventDefault();
      const text = input.value.trim(); if (!text) return;
      notes.push({ t: +noteAt.toFixed(2), text }); store.set(KEY, notes); draw(); input.value = ''; input.blur();
    };
    $('.mr-copy').onclick = e => {
      const txt = [notes.map(n => `${n.t.toFixed(2)}s — ${n.text}`).join('\n'), player.tuneSummary()].filter(Boolean).join('\n\n') || '(no notes)';
      copy(e.target, txt, 'Copy all');
    };

    // ---------- Instagram ----------
    const IG_MODES = [false, 'light', 'dark'];
    function setIG(mode) {
      ReviewBar.instagram = mode; igT.setAttribute('aria-pressed', String(!!mode));
      igT.querySelector('.mr-ig-tag').textContent = mode ? (mode === 'light' ? 'White' : 'Black') : '';
      document.body.classList.toggle('mr-ig-light', mode === 'light'); document.body.classList.toggle('mr-ig-dark', mode === 'dark');
      const u = new URL(location.href); mode ? u.searchParams.set('ig', mode) : u.searchParams.delete('ig'); history.replaceState(null, '', u);
      store.set('mr-ig', mode); refit();
    }
    const cycleIG = () => setIG(IG_MODES[(IG_MODES.indexOf(ReviewBar.instagram) + 1) % IG_MODES.length]);
    igT.onclick = cycleIG;

    // ---------- Export (served by scripts/serve.py); motion changes travel with it ----------
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
      const r = await fetch(exportUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: player.tuneQuery() }) }).catch(() => null);
      if (!r) { exportBtn.textContent = 'Server offline'; return; }
      if (r.status === 403) { exportBtn.textContent = 'Localhost only'; exportBtn.title = (await r.json()).error; return; }
      exportBtn.dataset.auto = '1'; label(await r.json()); poll = poll || setInterval(tick, 700);
    };
    fetch(exportUrl).then(r => r.ok ? r.json() : null).then(st => {
      if (!st) return;
      exportBtn.hidden = false;
      if (st.running) { label(st); poll = setInterval(tick, 700); }
    }).catch(() => {});

    // ---------- keys ----------
    addEventListener('keydown', e => {
      if (e.target === input) { if (e.key === 'Escape') input.blur(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest && e.target.closest('input:not([type=range]), textarea, [contenteditable]')) return;
      const step = e.shiftKey ? 0.5 : 1 / 30, k = e.key.toLowerCase();
      if (e.code === 'Space') { player.toggle(); e.preventDefault(); }
      else if (e.key === 'ArrowRight' && e.target.type !== 'range') player.seek(player.time + step);
      else if (e.key === 'ArrowLeft' && e.target.type !== 'range') player.seek(player.time - step);
      else if (e.key >= '1' && e.key <= '9' && player.keyframes[+e.key - 1] != null) player.seek(player.keyframes[+e.key - 1]);
      else if (k === 'n') { e.preventDefault(); startNote(); }
      else if (k === 'm') togglePanel('motion');
      else if (k === 'l') togglePanel('notes');
      else if (k === 'i') cycleIG();
      else if (k === 's') player.cycleSpeed();
      else if (e.key === 'Escape') { if (previewing) stopPreview(); else setPanel(false); }
    });

    // ---------- restore ----------
    const params = new URLSearchParams(location.search);
    const pst = store.get('mr-panel', { open: false, tab: 'motion' });
    setPanel(!!pst.open, pst.tab === 'notes' ? 'notes' : 'motion');
    const saved = store.get('mr-ig', false);
    setIG(params.get('ig') === 'dark' ? 'dark' : params.has('ig') ? 'light' : IG_MODES.includes(saved) ? saved : saved ? 'light' : false);
    return ReviewBar;
  };

  window.ReviewBar = ReviewBar;
})();
