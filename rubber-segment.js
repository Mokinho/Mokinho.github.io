/*
 * RubberSegment — vanilla JS port of the React Bits <RubberSegment /> thumb physics,
 * adapted to enhance an existing list of nav links (links stay real <a> elements).
 *   - tap: the thumb stretches across old + new slot, then contracts with a small squash
 *   - drag / flick the thumb (mouse or touch); release navigates to the slot it lands on
 *   - setActive(i) animates the thumb (used by scroll-spy)
 * Springs / tweens replace motion/react's animate().
 * Usage: RubberSegment(listEl, { links, inset, radius, stretch, squash, speed, glide, draggable, onCommit(i) })
 */
(function () {
  const DILATE = 0.19;
  const HANDOFF = 0.15;
  const FLICK = 110;
  const MAX_VELOCITY = 2000;
  const DEADZONE = 4;
  const RUBBER = 0.55;

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rubber = (over, dim) => (over * dim * RUBBER) / (dim + RUBBER * Math.abs(over));
  const project = (v, glide) => {
    const d = 1 - 0.1 * Math.pow(0.05, glide / 100);
    return ((v / 1000) * d) / (1 - d);
  };
  const velocityOf = (hist, now) => {
    const recent = hist.filter(([t]) => now - t <= 100);
    if (recent.length < 2) return 0;
    const [t0, x0] = recent[0];
    const [t1, x1] = recent[recent.length - 1];
    return t1 - t0 >= 8 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0;
  };
  // cubic-bezier(0.23, 1, 0.32, 1) solver
  const bezier = (x1, y1, x2, y2) => {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t;
    const sy = t => ((ay * t + by) * t + cy) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      let t = x;
      for (let i = 0; i < 6; i++) {
        const e = sx(t) - x;
        const d = dx(t);
        if (Math.abs(e) < 1e-5 || Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      return sy(clamp(t, 0, 1));
    };
  };
  const EASE_OUT = bezier(0.23, 1, 0.32, 1);

  // An animatable number with velocity: supports tweens and duration/bounce springs.
  const makeValue = () => ({ v: 0, vel: 0, anim: null });

  function RubberSegment(list, options) {
    const cfg = Object.assign({ inset: 5, radius: 22, stretch: 100, squash: 3, speed: 1, glide: 75, draggable: true, onCommit: null }, options);
    const links = cfg.links;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const t = s => s / cfg.speed;

    const thumb = document.createElement('li');
    thumb.className = 'rubber-thumb';
    thumb.setAttribute('aria-hidden', 'true');
    thumb.setAttribute('role', 'presentation');
    links.forEach(a => {
      const copy = document.createElement('span');
      copy.className = 'rubber-copy';
      copy.textContent = a.textContent.trim();
      thumb.appendChild(copy);
      a.draggable = false;
    });
    list.appendChild(thumb);
    list.classList.add('rubber-ready');

    const edgeL = makeValue();
    const edgeR = makeValue();
    let innerW = 0;
    let slots = [];
    let committed = Math.max(0, links.findIndex(a => a.classList.contains('active')));
    let gen = 0;
    let handoffTimer = 0;
    let raf = 0;
    let last = 0;
    let drag = null;
    let suppressClick = false;

    const render = () => {
      const r = Math.max(0, innerW - edgeR.v);
      const l = Math.max(0, edgeL.v);
      thumb.style.clipPath = `inset(0 ${r.toFixed(2)}px 0 ${l.toFixed(2)}px round ${cfg.radius}px)`;
    };

    const step = now => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      let busy = false;
      [edgeL, edgeR].forEach(mv => {
        const a = mv.anim;
        if (!a) return;
        busy = true;
        if (a.type === 'tween') {
          a.elapsed += dt;
          const p = clamp(a.elapsed / a.duration, 0, 1);
          const prev = mv.v;
          mv.v = a.from + (a.to - a.from) * EASE_OUT(p);
          mv.vel = dt > 0 ? (mv.v - prev) / dt : 0;
          if (p >= 1) finish(mv);
        } else {
          const n = 4;
          const h = dt / n;
          for (let i = 0; i < n; i++) {
            const acc = -a.k * (mv.v - a.to) - a.c * mv.vel;
            mv.vel += acc * h;
            mv.v += mv.vel * h;
          }
          a.elapsed += dt;
          if ((Math.abs(mv.v - a.to) < 0.05 && Math.abs(mv.vel) < 1) || a.elapsed > a.duration * 3) {
            mv.v = a.to;
            mv.vel = 0;
            finish(mv);
          }
        }
      });
      render();
      if (busy) raf = requestAnimationFrame(step);
    };
    const finish = mv => {
      const done = mv.anim && mv.anim.done;
      mv.anim = null;
      if (done) done();
    };
    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(step);
    };
    const tween = (mv, to, duration) => {
      mv.anim = { type: 'tween', from: mv.v, to, duration: Math.max(duration, 0.001), elapsed: 0 };
      wake();
    };
    // Duration/bounce spring (motion-style): natural frequency from duration, damping from bounce.
    const spring = (mv, to, { duration, bounce = 0, velocity }, done) => {
      const w = (2 * Math.PI) / Math.max(duration, 0.01);
      const zeta = clamp(1 - bounce, 0.05, 1);
      if (velocity !== undefined) mv.vel = velocity;
      mv.anim = { type: 'spring', to, k: w * w, c: 2 * zeta * w, duration, elapsed: 0, done };
      wake();
    };
    const stop = mv => { mv.anim = null; };
    const jump = (mv, v) => { mv.anim = null; mv.v = v; mv.vel = 0; };

    const jumpTo = i => {
      const s = slots[i];
      if (!s) return;
      clearTimeout(handoffTimer);
      gen++;
      jump(edgeL, s.l);
      jump(edgeR, s.r);
      render();
    };

    const measure = () => {
      const tr = thumb.getBoundingClientRect();
      if (!tr.width) return;
      innerW = tr.width;
      slots = links.map(a => {
        const r = a.getBoundingClientRect();
        return { l: r.left - tr.left, r: r.right - tr.left };
      });
      // keep copies aligned with their links, whatever the list's gap/padding
      [...thumb.children].forEach((copy, i) => {
        copy.style.left = `${slots[i].l}px`;
        copy.style.width = `${slots[i].r - slots[i].l}px`;
      });
      jumpTo(committed);
    };

    const land = (to, v, flick, withSquash) => {
      const b = slots[to];
      if (!b) return;
      const g = ++gen;
      const dir = Math.sign((b.l + b.r) / 2 - (edgeL.v + edgeR.v) / 2) || 1;
      const [lead, leadTo, trail, trailTo] = dir > 0 ? [edgeR, b.r, edgeL, b.l] : [edgeL, b.l, edgeR, b.r];
      const vel = mv => clamp(v === null ? mv.vel : v, -MAX_VELOCITY, MAX_VELOCITY);
      spring(lead, leadTo, { duration: t(flick ? 0.4 : 0.3), bounce: flick ? 0.2 : 0, velocity: vel(lead) });
      const tv = vel(trail);
      if (!withSquash || cfg.squash <= 0) {
        spring(trail, trailTo, { duration: t(0.3), velocity: tv });
        return;
      }
      spring(trail, trailTo + dir * cfg.squash, { duration: t(0.3), velocity: tv }, () => {
        if (gen === g) spring(trail, trailTo, { duration: t(0.16) });
      });
    };

    const travel = (from, to) => {
      const a = slots[from];
      const b = slots[to];
      if (!a || !b) return;
      clearTimeout(handoffTimer);
      gen++;
      if (reduce) { jumpTo(to); return; }
      const u = cfg.stretch / 100;
      tween(edgeL, b.l + (Math.min(a.l, b.l) - b.l) * u, t(DILATE));
      tween(edgeR, b.r + (Math.max(a.r, b.r) - b.r) * u, t(DILATE));
      handoffTimer = setTimeout(() => land(to, null, false, true), t(HANDOFF) * 1000);
    };

    const nearestSlot = x => {
      let best = 0;
      for (let i = 1; i < slots.length; i++) {
        if (Math.abs((slots[i].l + slots[i].r) / 2 - x) < Math.abs((slots[best].l + slots[best].r) / 2 - x)) best = i;
      }
      return best;
    };

    const setActive = (i, animate = true) => {
      if (i < 0 || i === committed || drag) return;
      const from = committed;
      committed = i;
      if (animate) travel(from, i);
      else jumpTo(i);
    };

    // ---- input ----
    const localX = e => e.clientX - thumb.getBoundingClientRect().left;

    const onClick = (e, i) => {
      if (suppressClick) { e.preventDefault(); suppressClick = false; return; }
      if (i !== committed) {
        const from = committed;
        committed = i;
        travel(from, i);
      }
      if (cfg.onCommit) cfg.onCommit(i, 'click');
    };

    const onDown = (e, i) => {
      if (drag || e.button !== 0) return;
      const x = localX(e);
      const onThumb = cfg.draggable && x >= edgeL.v && x <= edgeR.v;
      if (!onThumb) return;
      drag = { id: e.pointerId, el: e.currentTarget, x0: x, live: false, offset: 0, w: 0, hist: [[e.timeStamp, x]] };
      clearTimeout(handoffTimer);
      gen++;
      stop(edgeL);
      stop(edgeR);
    };

    const onMove = e => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      const x = localX(e);
      d.hist.push([e.timeStamp, x]);
      if (d.hist.length > 8) d.hist.shift();
      if (!d.live) {
        if (Math.abs(x - d.x0) < DEADZONE) return;
        d.live = true;
        d.offset = x - edgeL.v;
        d.w = edgeR.v - edgeL.v;
        try { d.el.setPointerCapture(d.id); } catch (err) { /* ignore */ }
        list.dataset.held = '';
      }
      const l = x - d.offset;
      const maxL = innerW - d.w;
      if (reduce) { const c = clamp(l, 0, maxL); edgeL.v = c; edgeR.v = c + d.w; }
      else if (l < 0) { edgeL.v = 0; edgeR.v = d.w - rubber(-l, d.w); }
      else if (l > maxL) { edgeR.v = innerW; edgeL.v = maxL + rubber(l - maxL, d.w); }
      else { edgeL.v = l; edgeR.v = l + d.w; }
      render();
    };

    const onUp = e => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      drag = null;
      delete list.dataset.held;
      if (!d.live) return; // plain tap: the link's click handles it
      suppressClick = true;
      setTimeout(() => { suppressClick = false; }, 0);
      const v = velocityOf(d.hist, e.timeStamp);
      const flick = Math.abs(v) > FLICK;
      let to = nearestSlot((edgeL.v + edgeR.v) / 2 + project(v, cfg.glide));
      if (flick && to === committed) to = clamp(to + Math.sign(v), 0, links.length - 1);
      const changed = to !== committed;
      committed = to;
      if (reduce) jumpTo(to);
      else land(to, v, flick, flick);
      if (changed && cfg.onCommit) cfg.onCommit(to, 'drag');
    };

    const onCancel = e => {
      const d = drag;
      if (!d || e.pointerId !== d.id) return;
      drag = null;
      delete list.dataset.held;
      if (!d.live) return;
      if (reduce) jumpTo(committed);
      else land(committed, null, false, false);
    };

    const handlers = links.map((a, i) => {
      const h = {
        click: e => onClick(e, i),
        pointerdown: e => onDown(e, i),
        pointermove: onMove,
        pointerup: onUp,
        pointercancel: onCancel
      };
      Object.entries(h).forEach(([k, fn]) => a.addEventListener(k, fn));
      return h;
    });

    const ro = new ResizeObserver(measure);
    ro.observe(list);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});
    measure();

    return {
      setActive,
      measure,
      get index() { return committed; },
      destroy() {
        ro.disconnect();
        cancelAnimationFrame(raf);
        clearTimeout(handoffTimer);
        links.forEach((a, i) => Object.entries(handlers[i]).forEach(([k, fn]) => a.removeEventListener(k, fn)));
        thumb.remove();
        list.classList.remove('rubber-ready');
      }
    };
  }

  window.RubberSegment = RubberSegment;
})();
