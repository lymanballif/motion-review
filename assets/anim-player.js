/* motion-review · anim-player.js
 * A deterministic clock for timeline animations: loop, pause, seek, ½×/¼× review speed, frame-exact export,
 * native <video> kept in sync, and live-tunable key transitions (feel presets, custom curves, timing, style).
 * Your animation is one pure function: render(t).
 *
 *   const T = { photoToItem: [0.5, 1.75], swap: [5.45, 6.3] };          // named phases (arrays are tuned in place)
 *   const player = AnimPlayer.create({ duration: 9.8, size: [1080, 1350], render,
 *     beats: [['Open', 0], ['Item', T.photoToItem]],                     // a phase array keeps the tick in sync when retimed
 *     keyframes: [0, 1.77] });
 *   const M = player.tune({                                               // the transitions a reviewer can tune
 *     photoToItem: { label: 'Photo becomes a button', at: T.photoToItem, ease: 'glide' },
 *     swap: { label: 'Learn → About', at: T.swap, curve: [.65, 0, .1, 1], type: 'wipe', types: ['wipe', 'slide', 'dissolve', 'rise'] },
 *   });
 *   // in render: const e = seg(t, ...T.photoToItem, M.photoToItem.ease); if (M.swap.type === 'slide') …
 *   player.start([fontsReady]);
 *
 * URL params: ?t=4.2 · ?speed=0.5 · ?clean · ?actual · ?export · ?tune=<base64 json> (used by Export MP4)
 * Globals for tooling: window.seek(t), window.play(), window.renderFrame(t) (async), window.DUR, window.EXPORT_SIZE, window.ready
 */
(function () {
  const SPEEDS = [1, 0.5, 0.25];

  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t, sy = t => ((ay * t + by) * t + cy) * t, dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0; if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) { const e = sx(t) - x, d = dx(t); if (Math.abs(e) < 1e-7 || !d) break; t -= e / d; }
      if (Math.abs(sx(t) - x) > 1e-4) { let lo = 0, hi = 1; t = x; for (let i = 0; i < 30; i++) { sx(t) < x ? lo = t : hi = t; t = (lo + hi) / 2; } }
      return sy(t);
    };
  }

  /* Curated feels. `for` says where each shines: move (on-screen travel), enter, exit, drift (constant motion). */
  const EASES = {
    glide:   { name: 'Glide',   curve: [0.6, 0, 0.1, 1],    for: 'move',  desc: 'Leaves gently, lands slowly.' },
    settle:  { name: 'Settle',  curve: [0.5, 0, 0.1, 1],    for: 'move',  desc: 'Prompt start, long soft landing.' },
    poise:   { name: 'Poise',   curve: [0.65, 0, 0.35, 1],  for: 'move',  desc: 'Balanced and even.' },
    snap:    { name: 'Snap',    curve: [0.77, 0, 0.175, 1], for: 'move',  desc: 'Decisive, crisp start and stop.' },
    arrive:  { name: 'Arrive',  curve: [0.23, 1, 0.32, 1],  for: 'enter', desc: 'Quick in, feathers to rest.' },
    bloom:   { name: 'Bloom',   curve: [0.16, 1, 0.3, 1],   for: 'enter', desc: 'Instant start, long tail.' },
    lively:  { name: 'Lively',  curve: [0.34, 1.3, 0.64, 1], for: 'enter', desc: 'A hint of overshoot.' },
    depart:  { name: 'Depart',  curve: [0.7, 0, 0.84, 0],   for: 'exit',  desc: 'Eases away, then leaves quickly.' },
    natural: { name: 'Natural', curve: [0.25, 0.1, 0.25, 1], for: 'any',  desc: 'The familiar CSS ease.' },
    linear:  { name: 'Linear',  curve: [0, 0, 1, 1],        for: 'drift', desc: 'Constant speed, for drifts.' },
  };
  const TYPE_INFO = {
    wipe:     { name: 'Wipe',     desc: 'New content sweeps in from the side' },
    slide:    { name: 'Slide',    desc: 'Glides across, old and new together' },
    dissolve: { name: 'Dissolve', desc: 'A soft, still crossfade' },
    rise:     { name: 'Rise',     desc: 'Old fades out, new rises in sequence' },
  };
  const sameCurve = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-3);
  const presetFor = c => Object.keys(EASES).find(k => sameCurve(EASES[k].curve, c)) || null;
  const fmt = n => (Math.round(n * 1000) / 1000).toString().replace(/^0\./, '.').replace(/^-0\./, '-.');
  const curveCss = c => `cubic-bezier(${c.map(fmt).join(', ')})`;

  function create(opts) {
    const params = new URLSearchParams(location.search);
    const EXPORT = params.has('export');
    const DUR = opts.duration;
    const listeners = { tick: [], state: [], tune: [] };
    const emit = (k, v) => listeners[k].forEach(fn => fn(v));

    const p = {
      duration: DUR,
      size: opts.size || [1080, 1350],
      beats: opts.beats || [],
      keyframes: opts.keyframes || [],
      exporting: EXPORT,
      clean: EXPORT || params.has('clean') || params.has('actual'),
      actual: params.has('actual'),
      time: ((parseFloat(params.get('t')) || 0) % DUR + DUR) % DUR,
      paused: params.has('t') || EXPORT,
      speed: EXPORT ? 1 : SPEEDS.includes(+params.get('speed')) ? +params.get('speed') : 1,
      loopRange: null,                       // [a, b]: play only this window (transition preview)
      tunables: {},
      on(k, fn) { listeners[k].push(fn); return p; },
      render() { opts.render(p.time); emit('tick', p.time); },
      seek(t) { p.time = ((t % DUR) + DUR) % DUR; p.setPaused(true); p.render(); },
      play() { p.setPaused(false); },
      toggle() { p.setPaused(!p.paused); },
      setPaused(v) { if (p.paused !== v) { p.paused = v; emit('state', p); } },
      setSpeed(v) {
        p.speed = v;
        const u = new URL(location.href);
        v === 1 ? u.searchParams.delete('speed') : u.searchParams.set('speed', v);
        history.replaceState(null, '', u);
        emit('state', p);
      },
      cycleSpeed() { p.setSpeed(SPEEDS[(SPEEDS.indexOf(p.speed) + 1) % SPEEDS.length]); },
      setLoopRange(r) { p.loopRange = r; if (r) { p.time = r[0]; p.play(); } emit('state', p); },
      beatTime(b) { return Array.isArray(b) ? b[0] : b; },

      drive(v, clipTime, rate = 1, live = true) {
        if (!v.duration) return;
        rate *= p.speed;
        const vt = Math.min(Math.max(clipTime, 0), v.duration - 0.02);
        if (live && !p.paused && rate > 0.08) {
          const drift = v.currentTime - vt;
          if (v.paused) { v.currentTime = vt; v.playbackRate = rate; v.play().catch(() => {}); }
          else if (Math.abs(drift) > 0.4) v.currentTime = vt;
          else {
            const want = rate * (1 - Math.max(-0.06, Math.min(0.06, drift * 0.8)));
            if (Math.abs(v.playbackRate - want) > 0.004) v.playbackRate = want;
          }
        } else {
          if (!v.paused) v.pause();
          if (Math.abs(v.currentTime - vt) > (EXPORT ? 0.001 : 0.03)) v.currentTime = vt;
        }
      },

      /* Declare the key transitions a reviewer can tune. Each def: { label, at: phaseArray, ease: presetKey | curve: [4],
       * kind: 'move'|'enter'|'exit'|'drift', type, types }. `at` is retimed in place, so render() always reads live values.
       * Returns { key: { ease(fn), curve, preset, type, at, ... } }. Tuning persists per viewer and travels with exports. */
      tune(defs, tuneOpts = {}) {
        const KEY = tuneOpts.storageKey || opts.tuneKey || 'motion-review-tune:' + location.pathname;
        let saved = {};
        try { saved = JSON.parse(localStorage.getItem(KEY)) || {}; } catch {}
        if (params.has('tune')) { try { saved = JSON.parse(decodeURIComponent(escape(atob(params.get('tune'))))); } catch {} }
        for (const [k, d] of Object.entries(defs)) {
          const curve = d.curve || EASES[d.ease || 'glide'].curve;
          const x = p.tunables[k] = {
            key: k, label: d.label || k, kind: d.kind || 'move', at: d.at, types: d.types || null,
            base: { start: d.at[0], dur: d.at[1] - d.at[0], curve: curve.slice(), type: d.type || (d.types ? d.types[0] : null) },
            curve: curve.slice(), speed: 1, shift: 0, type: d.type || (d.types ? d.types[0] : null), ease: null,
            get preset() { return presetFor(x.curve); },
            get changed() { return !sameCurve(x.curve, x.base.curve) || x.speed !== 1 || x.shift !== 0 || x.type !== x.base.type; },
            set(v) { Object.assign(x, v); apply(x); persist(); emit('tune', x); if (p.paused) p.render(); },
            reset() { x.set({ curve: x.base.curve.slice(), speed: 1, shift: 0, type: x.base.type }); },
          };
          const s = saved[k];
          if (s) { if (s.curve) x.curve = s.curve; if (s.speed) x.speed = s.speed; if (s.shift) x.shift = s.shift; if (s.type && (!x.types || x.types.includes(s.type))) x.type = s.type; }
          apply(x);
        }
        function apply(x) {
          x.ease = bezier(...x.curve);
          x.at[0] = x.base.start + x.shift;
          x.at[1] = x.at[0] + x.base.dur * x.speed;
        }
        function persist() {
          const out = {};
          for (const x of Object.values(p.tunables)) if (x.changed) out[x.key] = { curve: x.curve, speed: x.speed, shift: x.shift, type: x.type };
          try { localStorage.setItem(KEY, JSON.stringify(out)); } catch {}
          p.tuneState = out;
        }
        persist();
        return p.tunables;
      },
      resetAllTuning() { Object.values(p.tunables).forEach(x => x.reset()); },
      tuneQuery() { const s = JSON.stringify(p.tuneState || {}); return s === '{}' ? '' : 'tune=' + encodeURIComponent(btoa(unescape(encodeURIComponent(s)))); },
      /* Plain-language change list to paste to whoever bakes the values into the code */
      tuneSummary() {
        const lines = [];
        for (const x of Object.values(p.tunables)) {
          if (!x.changed) continue;
          const parts = [];
          if (!sameCurve(x.curve, x.base.curve)) {
            const was = presetFor(x.base.curve), now = presetFor(x.curve);
            parts.push(`feel ${was ? EASES[was].name : 'custom'} → ${now ? EASES[now].name : 'custom'} ${curveCss(x.curve)}`);
          }
          if (x.speed !== 1) parts.push(`duration ${x.base.dur.toFixed(2)}s → ${(x.base.dur * x.speed).toFixed(2)}s`);
          if (x.shift !== 0) parts.push(`starts ${x.shift > 0 ? 'later' : 'earlier'} by ${Math.abs(x.shift).toFixed(2)}s (${x.at[0].toFixed(2)}s)`);
          if (x.type !== x.base.type) parts.push(`style ${TYPE_INFO[x.base.type]?.name || x.base.type} → ${TYPE_INFO[x.type]?.name || x.type}`);
          lines.push(`- ${x.label} [${x.key}]: ${parts.join('; ')}`);
        }
        return lines.length ? 'Motion changes:\n' + lines.join('\n') : '';
      },

      start(extra = []) {
        const imgs = [...document.images].map(i => i.decode().catch(() => {}));
        const vids = [...document.querySelectorAll('video')].map(v => new Promise(r => {
          if (v.readyState >= 3) r(); v.addEventListener('canplaythrough', r, { once: true }); setTimeout(r, 5000);
        }));
        return Promise.all([document.fonts.ready, ...imgs, ...vids, ...extra]).then(() => {
          p.render(); window.ready = true; emit('state', p); requestAnimationFrame(frame);
        });
      },
    };

    let last = null;
    function frame(now) {
      // True elapsed time × speed; only long stalls (tab hidden) are capped.
      if (last != null && !p.paused) {
        const dt = now - last;
        p.time += (dt > 250 ? 1000 / 60 : dt) * p.speed / 1000;
        const r = p.loopRange;
        if (r) { if (p.time > r[1] || p.time < r[0]) p.time = r[0]; }
        else p.time %= DUR;
      }
      last = now; p.render(); requestAnimationFrame(frame);
    }

    window.seek = t => p.seek(t);
    window.play = () => p.play();
    window.DUR = DUR;
    window.EXPORT_SIZE = p.size;
    window.renderFrame = async t => {
      p.seek(t);
      const seeking = [...document.querySelectorAll('video')].filter(v => v.seeking);
      await Promise.all(seeking.map(v => new Promise(r => v.addEventListener('seeked', r, { once: true }))));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    };
    return p;
  }

  window.AnimPlayer = { create, bezier, EASES, TYPE_INFO, curveCss };
})();
