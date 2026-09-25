/*
 * OptionWheel — vanilla JS port of the React Bits <OptionWheel /> component.
 * Items are real links: tapping one spins it to the middle, then navigates.
 * Usage: const w = OptionWheel(rootEl, { items: [{ label, href }], onSelect(i, item) {} , ... });
 *        w.select(i, instant) · w.focus() · w.destroy()
 */
(function () {
  const DEFAULTS = {
    items: [],
    defaultSelected: 0,
    onChange: null,
    onSelect: null,
    textColor: '#a6a6a6',
    activeColor: '#ffffff',
    side: 'left',
    fontSize: 3,
    spacing: 1.4,
    curve: 1,
    tilt: 6,
    blur: 2,
    fade: 0.25,
    minOpacity: 0.05,
    smoothing: 200,
    inset: 80,
    loop: false,
    draggable: true,
    soundUrl: '',
    soundVolume: 0.5,
    ariaLabel: 'Menu'
  };

  function OptionWheel(root, options) {
    const cfg = Object.assign({}, DEFAULTS, options);
    const n = cfg.items.length;
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const rowH = Math.max(cfg.fontSize * cfg.spacing * remPx, 1);

    let pos = cfg.defaultSelected;
    let target = cfg.defaultSelected;
    let selected = cfg.defaultSelected;
    let raf = null;
    let last = 0;
    let wheelTimer = null;
    let drag = null;
    let dragMoved = false;
    let audio = null;
    let lastTick = 0;

    root.classList.add('option-wheel');
    if (cfg.side === 'right') root.classList.add('option-wheel--right');
    root.setAttribute('role', 'listbox');
    root.setAttribute('aria-label', cfg.ariaLabel);
    root.tabIndex = 0;
    root.style.setProperty('--ow-text-color', cfg.textColor);
    root.style.setProperty('--ow-active-color', cfg.activeColor);
    root.style.setProperty('--ow-font-size', `${cfg.fontSize}rem`);
    root.style.setProperty('--ow-inset', `${cfg.inset}px`);

    const els = cfg.items.map((item, index) => {
      const el = document.createElement('a');
      el.className = 'option-wheel__item';
      el.href = item.href;
      el.textContent = item.label;
      el.setAttribute('role', 'option');
      el.draggable = false;
      el.tabIndex = -1;
      el.addEventListener('click', e => {
        e.preventDefault();
        handleItemClick(index);
      });
      root.appendChild(el);
      return el;
    });

    // Eases the position toward its target (frame-rate independent), then lays
    // every option out along the curve by its distance from the current position.
    const runFrame = now => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const k = 1 - Math.exp(-dt / (Math.max(cfg.smoothing, 1) / 1000));
      let next = pos + (target - pos) * k;
      const settled = Math.abs(target - next) < 0.001;
      if (settled) next = target;
      pos = next;

      const mirror = cfg.side === 'right' ? -1 : 1;
      const tiltRad = (cfg.tilt * Math.PI) / 180;
      const R = tiltRad > 0.0005 ? rowH / tiltRad : 0;
      for (let i = 0; i < n; i++) {
        const el = els[i];
        let d = i - next;
        if (cfg.loop && n > 1) {
          d = ((d % n) + n) % n;
          if (d > n / 2) d -= n;
        }
        const dist = Math.abs(d);
        let x = 0;
        let y = d * rowH;
        let rot = 0;
        if (R > 0) {
          const ang = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, d * tiltRad));
          y = R * Math.sin(ang);
          x = -mirror * R * (1 - Math.cos(ang)) * cfg.curve;
          rot = (mirror * ang * 180) / Math.PI;
        }
        el.style.transform = `translate(${x.toFixed(2)}px, calc(${y.toFixed(2)}px - 50%)) rotate(${rot.toFixed(3)}deg)`;
        el.style.opacity = String(Math.max(cfg.minOpacity, 1 - dist * cfg.fade));
        el.style.filter = cfg.blur > 0 ? `blur(${(dist * cfg.blur).toFixed(2)}px)` : 'none';
        el.style.setProperty('--ow-p', Math.max(0, 1 - Math.min(dist, 1)).toFixed(4));
      }
      raf = settled ? null : requestAnimationFrame(runFrame);
    };

    const startLoop = () => {
      if (raf != null) cancelAnimationFrame(raf);
      last = performance.now();
      raf = requestAnimationFrame(runFrame);
    };

    const playTick = () => {
      if (!cfg.soundUrl) return;
      const now = performance.now();
      if (now - lastTick < 70) return;
      lastTick = now;
      if (!audio) { audio = new Audio(cfg.soundUrl); audio.preload = 'auto'; }
      audio.volume = Math.min(Math.max(cfg.soundVolume, 0), 1);
      audio.currentTime = 0;
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
    };

    const markSelected = idx => {
      els.forEach((el, i) => {
        el.classList.toggle('option-wheel__item--selected', i === idx);
        el.setAttribute('aria-selected', String(i === idx));
      });
      root.setAttribute('aria-activedescendant', '');
    };

    const applyTarget = (value, snap, silent) => {
      let v = value;
      if (!cfg.loop) v = Math.min(Math.max(v, 0), Math.max(n - 1, 0));
      if (snap) v = Math.round(v);
      target = v;
      const idx = ((Math.round(v) % n) + n) % n;
      if (idx !== selected) {
        selected = idx;
        markSelected(idx);
        if (!silent) {
          if (cfg.onChange) cfg.onChange(idx, cfg.items[idx]);
          playTick();
        }
      }
      startLoop();
    };

    const onWheel = e => {
      e.preventDefault();
      const delta = e.deltaMode === 1 ? e.deltaY * 24 : e.deltaY;
      const step = Math.max(-1, Math.min(1, delta / rowH));
      applyTarget(target + step, false);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => applyTarget(target, true), 140);
    };

    const onDown = e => {
      if (!cfg.draggable) return;
      drag = { y: e.clientY, start: target, id: e.pointerId };
      dragMoved = false;
      root.classList.add('option-wheel--dragging');
    };
    const onMove = e => {
      if (!drag) return;
      const dy = e.clientY - drag.y;
      if (!dragMoved && Math.abs(dy) > 4) {
        dragMoved = true;
        // Capture only once a real drag starts, so plain taps still reach the links.
        if (root.setPointerCapture) root.setPointerCapture(drag.id);
      }
      if (dragMoved) applyTarget(drag.start - dy / rowH, false);
    };
    const onEnd = () => {
      if (!drag) return;
      drag = null;
      root.classList.remove('option-wheel--dragging');
      if (dragMoved) applyTarget(target, true);
    };

    function handleItemClick(index) {
      if (dragMoved) return;
      const cur = target;
      let d = index - (((cur % n) + n) % n);
      if (cfg.loop && n > 1) {
        if (d > n / 2) d -= n;
        else if (d < -n / 2) d += n;
      }
      applyTarget(cur + d, true);
      if (cfg.onSelect) cfg.onSelect(index, cfg.items[index]);
    }

    const onKey = e => {
      let delta = null;
      if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') delta = -1;
      else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') delta = 1;
      else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (cfg.onSelect) cfg.onSelect(selected, cfg.items[selected]);
        return;
      }
      if (delta == null) return;
      e.preventDefault();
      applyTarget(Math.round(target) + delta, true);
    };

    root.addEventListener('wheel', onWheel, { passive: false });
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerup', onEnd);
    root.addEventListener('pointercancel', onEnd);
    root.addEventListener('keydown', onKey);

    markSelected(selected);
    applyTarget(target, false, true);

    return {
      select(index, instant) {
        if (instant) pos = index;
        applyTarget(index, true, true);
      },
      focus() { root.focus({ preventScroll: true }); },
      destroy() {
        if (raf != null) cancelAnimationFrame(raf);
        clearTimeout(wheelTimer);
        root.removeEventListener('wheel', onWheel);
        root.removeEventListener('pointerdown', onDown);
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerup', onEnd);
        root.removeEventListener('pointercancel', onEnd);
        root.removeEventListener('keydown', onKey);
        if (audio) audio.pause();
        els.forEach(el => el.remove());
      }
    };
  }

  window.OptionWheel = OptionWheel;
})();
