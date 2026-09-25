/*
 * TextLoop — vanilla JS port of the React Bits <TextLoop /> component.
 * Text scrolls endlessly along an SVG curve (wave / circle / infinity / arch / line) on an optional ribbon.
 * requestAnimationFrame replaces the GSAP tween. The viewBox is cropped to the curve so the band isn't mostly empty.
 * Usage: TextLoop(el, { text, shape, speed, direction, separator, curviness, fontSize, fontWeight,
 *                       letterSpacing, uppercase, color, ribbon, ribbonColor, ribbonWidth, pauseOnHover, fontFamily })
 */
(function () {
  const VIEW_W = 1200;
  const VIEW_H = 520;
  const CX = VIEW_W / 2;
  const CY = VIEW_H / 2;
  const EDGE_PAD = 6;
  const NS = 'http://www.w3.org/2000/svg';
  let uid = 0;

  const buildPath = (shape, curviness, ribbonWidth, width = 0, period = 320) => {
    const c = Math.max(0, curviness);
    const room = Math.max(20, CY - Math.max(0, ribbonWidth) / 2 - EDGE_PAD);
    switch (shape) {
      case 'circle': {
        const r = Math.min(90 + c * 0.95, room);
        return `M ${CX - r} ${CY} A ${r} ${r} 0 1 1 ${CX + r} ${CY} A ${r} ${r} 0 1 1 ${CX - r} ${CY} Z`;
      }
      case 'infinity': {
        const r = 150 + c * 1.4;
        const h = Math.min(60 + c * 0.95, room);
        return [
          `M ${CX} ${CY}`,
          `C ${CX + r * 0.55} ${CY - h} ${CX + r} ${CY - h} ${CX + r} ${CY}`,
          `C ${CX + r} ${CY + h} ${CX + r * 0.55} ${CY + h} ${CX} ${CY}`,
          `C ${CX - r * 0.55} ${CY - h} ${CX - r} ${CY - h} ${CX - r} ${CY}`,
          `C ${CX - r} ${CY + h} ${CX - r * 0.55} ${CY + h} ${CX} ${CY}`,
          'Z'
        ].join(' ');
      }
      case 'arch': {
        const rise = Math.min(120 + c * 1.1, room * 2);
        return `M 120 ${CY + rise / 2} Q ${CX} ${CY - rise * 1.5} ${VIEW_W - 120} ${CY + rise / 2}`;
      }
      case 'line':
        return `M -320 ${CY} L ${VIEW_W + 320} ${CY}`;
      case 'wave':
      default: {
        const a = Math.min(c * 2.2, room * 2);
        if (width) {
          // pixel-true wave across the real width (fitWidth mode)
          let d = `M ${-period} ${CY} Q ${-period / 2} ${CY - a} 0 ${CY}`;
          for (let x = period; x < width + period * 2; x += period) d += ` T ${x} ${CY}`;
          return d;
        }
        return `M -320 ${CY} Q -160 ${CY - a} 0 ${CY} T 320 ${CY} T 640 ${CY} T 960 ${CY} T 1280 ${CY} T ${VIEW_W + 320} ${CY}`;
      }
    }
  };

  function TextLoop(root, options) {
    const o = Object.assign({
      text: 'React ✦ Bits', shape: 'wave', path: null, speed: 90, direction: 'forward', separator: '✦',
      curviness: 90, fontSize: 46, fontWeight: 800, letterSpacing: 2, uppercase: true, color: '#ffffff',
      ribbon: true, ribbonColor: '#5227FF', ribbonWidth: 86, pauseOnHover: true, fontFamily: '',
      fitWidth: false, period: 320
    }, options);

    const id = `text-loop-${++uid}`;
    const pathFor = () => o.path || buildPath(o.shape, o.curviness, o.ribbonWidth, o.fitWidth ? Math.max(1, root.clientWidth) : 0, o.period);
    const d = pathFor();
    const base = o.uppercase ? String(o.text).toUpperCase() : String(o.text);
    const unit = `${base}${o.separator ? ` ${o.separator} ` : '   '}`;

    root.classList.add('text-loop');
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'text-loop-svg');
    svg.setAttribute('viewBox', `0 0 ${VIEW_W} ${VIEW_H}`);
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', o.text);

    const pathEl = document.createElementNS(NS, 'path');
    pathEl.setAttribute('id', id);
    pathEl.setAttribute('d', d);
    pathEl.setAttribute('fill', 'none');
    pathEl.setAttribute('stroke', o.ribbon ? o.ribbonColor : 'none');
    pathEl.setAttribute('stroke-width', o.ribbon ? o.ribbonWidth : 0);
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(pathEl);

    const styleText = el => {
      el.style.fontSize = `${o.fontSize}px`;
      el.style.fontWeight = o.fontWeight;
      el.style.letterSpacing = `${o.letterSpacing}px`;
      if (o.fontFamily) el.style.fontFamily = o.fontFamily;
    };

    const measureEl = document.createElementNS(NS, 'text');
    measureEl.setAttribute('class', 'text-loop-measure');
    measureEl.setAttribute('aria-hidden', 'true');
    styleText(measureEl);
    measureEl.textContent = unit;
    svg.appendChild(measureEl);

    const makeRun = () => {
      const t = document.createElementNS(NS, 'text');
      t.setAttribute('class', 'text-loop-text');
      t.setAttribute('fill', o.color);
      t.setAttribute('dominant-baseline', 'central');
      t.setAttribute('aria-hidden', 'true');
      t.setAttribute('lengthAdjust', 'spacing');
      styleText(t);
      const tp = document.createElementNS(NS, 'textPath');
      tp.setAttribute('href', `#${id}`);
      tp.setAttribute('startOffset', '0');
      t.appendChild(tp);
      svg.appendChild(t);
      return { t, tp };
    };
    const head = makeRun();
    const tail = makeRun();
    root.appendChild(svg);

    // Crop the viewBox to the ribbon's real extent (plus a little padding).
    // In fitWidth mode the viewBox is the element's pixel width, so fontSize etc. are real pixels.
    const crop = () => {
      try {
        const bb = pathEl.getBBox();
        const pad = (o.ribbon ? o.ribbonWidth / 2 : o.fontSize) + 8;
        const y = Math.max(0, bb.y - pad);
        const h = Math.min(VIEW_H, bb.y + bb.height + pad) - y;
        const w = o.fitWidth ? Math.max(1, root.clientWidth) : VIEW_W;
        if (h > 0) svg.setAttribute('viewBox', `0 ${y} ${w} ${h}`);
      } catch (err) { /* keep the full viewBox */ }
    };
    crop();

    let length = 0;
    let offset = 0;
    let raf = 0;
    let last = 0;
    let paused = false;
    let visible = true;
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const apply = off => {
      const partner = off >= 0 ? off - length : off + length;
      head.tp.setAttribute('startOffset', String(off));
      tail.tp.setAttribute('startOffset', String(partner));
    };

    const measure = () => {
      let unitWidth = 0;
      try {
        length = pathEl.getTotalLength();
        unitWidth = measureEl.getComputedTextLength();
      } catch (err) { return; }
      if (!length) return;
      const reps = unitWidth > 0 ? Math.max(1, Math.round(length / unitWidth)) : 1;
      const loopText = unit.repeat(reps);
      [head, tail].forEach(r => {
        r.tp.textContent = loopText;
        r.t.setAttribute('textLength', String(length));
      });
      offset = offset % length;
      apply(offset);
    };

    const tick = now => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;
      if (length) {
        const dir = o.direction === 'reverse' ? -1 : 1;
        offset += dir * o.speed * dt;
        if (offset >= length) offset -= length;
        if (offset <= -length) offset += length;
        apply(offset);
      }
      loop();
    };
    const loop = () => {
      if (raf || paused || !visible || reduce || o.speed <= 0) return;
      raf = requestAnimationFrame(t => { if (!last) last = t; tick(t); });
    };
    const start = () => { last = performance.now(); loop(); };

    measure();
    if (o.fitWidth) {
      let lastW = root.clientWidth;
      new ResizeObserver(() => {
        const w = root.clientWidth;
        if (Math.abs(w - lastW) < 1) return;
        lastW = w;
        pathEl.setAttribute('d', pathFor());
        crop();
        measure();
      }).observe(root);
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure).catch(() => {});

    if (o.pauseOnHover) {
      root.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { paused = true; cancelAnimationFrame(raf); raf = 0; } });
      root.addEventListener('pointerleave', () => { if (paused) { paused = false; start(); } });
    }
    // Only animate while on screen.
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) start();
      else { cancelAnimationFrame(raf); raf = 0; }
    }).observe(root);
    start();

    return { measure };
  }

  window.TextLoop = TextLoop;
})();
