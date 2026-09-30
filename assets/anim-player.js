/* motion-review · anim-player.js
 * A deterministic clock for timeline animations: loop, pause, seek, ½×/¼× review speed, frame-exact export,
 * and native <video> kept in sync with the timeline. Your animation is one pure function: render(t).
 *
 *   const player = AnimPlayer.create({
 *     duration: 9.8,                         // loop length (s)
 *     size: [1080, 1350],                    // export frame size (stage px)
 *     render: t => { ... },                  // draw the animation at time t (must be a pure function of t)
 *     beats: [['Open', 0], ['Card', 3.0]],   // labelled ticks on the review scrubber
 *     keyframes: [0, 1.77, 2.85],            // number keys 1–9 jump here
 *   });
 *   player.start([fontsReady, imagesReady]); // renders once everything is ready, then plays
 *
 * URL params: ?t=4.2 (freeze there) · ?speed=0.5 · ?clean (hide review UI) · ?actual (1:1, no UI) · ?export (frame-exact)
 * Globals for tooling: window.seek(t), window.play(), window.renderFrame(t) (async), window.DUR, window.EXPORT_SIZE, window.ready
 */
(function () {
  const SPEEDS = [1, 0.5, 0.25];

  function create(opts) {
    const params = new URLSearchParams(location.search);
    const EXPORT = params.has('export');
    const DUR = opts.duration;
    const listeners = { tick: [], state: [] };
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

      /* Keep a native <video> on the timeline. clipTime = where the clip should be at the current time.
       * live: while playing, let the video play natively and nudge its playbackRate (±6%) to converge —
       * never seek a playing video (a seek stalls decode = visible hitch). Paused/scrubbing/export: seek exactly. */
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

      /* Resolve once fonts/images/videos (plus anything you pass) are ready, then render and start the clock. */
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
      // True elapsed time × speed. Only long stalls (tab hidden) are capped — a per-frame cap makes the
      // timeline lag behind videos after slow frames, which then forces visible re-syncs.
      if (last != null && !p.paused) { const dt = now - last; p.time = (p.time + (dt > 250 ? 1000 / 60 : dt) * p.speed / 1000) % DUR; }
      last = now; p.render(); requestAnimationFrame(frame);
    }

    // Tooling hooks
    window.seek = t => p.seek(t);
    window.play = () => p.play();
    window.DUR = DUR;
    window.EXPORT_SIZE = p.size;
    window.renderFrame = async t => {           // export: render t and wait until every video has landed on its frame
      p.seek(t);
      const seeking = [...document.querySelectorAll('video')].filter(v => v.seeking);
      await Promise.all(seeking.map(v => new Promise(r => v.addEventListener('seeked', r, { once: true }))));
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    };
    return p;
  }

  window.AnimPlayer = { create };
})();
