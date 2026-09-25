/*
 * Dock — vanilla JS port of the React Bits <Dock /> component (macOS-style magnifying dock).
 * Items are real links. Spring physics replaces motion/react's useSpring.
 * Usage: Dock(containerEl, { items: [{ href, label, icon, target, rel }], baseItemSize, magnification, distance, panelHeight, spring })
 */
(function () {
  const DEFAULTS = {
    items: [],
    distance: 200,
    panelHeight: 68,
    baseItemSize: 50,
    magnification: 70,
    spring: { mass: 0.1, stiffness: 150, damping: 12 },
    ariaLabel: 'Contact links'
  };

  function Dock(container, options) {
    const cfg = Object.assign({}, DEFAULTS, options);
    const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const base = cfg.baseItemSize;

    const outer = document.createElement('div');
    outer.className = 'dock-outer';
    const panel = document.createElement('div');
    panel.className = 'dock-panel';
    panel.setAttribute('role', 'toolbar');
    panel.setAttribute('aria-label', cfg.ariaLabel);
    panel.style.height = `${cfg.panelHeight}px`;
    outer.appendChild(panel);
    container.appendChild(outer);

    const items = cfg.items.map(item => {
      const el = document.createElement('a');
      el.className = `dock-item ${item.className || ''}`.trim();
      el.href = item.href;
      if (item.target) el.target = item.target;
      if (item.rel) el.rel = item.rel;
      el.setAttribute('aria-label', item.label);
      el.style.width = el.style.height = `${base}px`;
      el.innerHTML = `<span class="dock-icon" aria-hidden="true">${item.icon}</span><span class="dock-label" role="tooltip">${item.label}</span>`;
      const show = on => el.classList.toggle('is-hovered', on);
      el.addEventListener('mouseenter', () => show(true));
      el.addEventListener('mouseleave', () => show(false));
      el.addEventListener('focus', () => show(true));
      el.addEventListener('blur', () => show(false));
      panel.appendChild(el);
      return { el, size: base, velocity: 0, target: base };
    });

    let mouseX = Infinity;
    let raf = 0;
    let last = 0;

    const targetFor = it => {
      if (!Number.isFinite(mouseX) || reduce) return base;
      const rect = it.el.getBoundingClientRect();
      const d = mouseX - rect.x - base / 2;
      const t = Math.min(Math.abs(d) / cfg.distance, 1);
      return cfg.magnification + (base - cfg.magnification) * t;
    };

    const tick = now => {
      raf = 0;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const { mass, stiffness, damping } = cfg.spring;
      let moving = false;
      // Several small sub-steps keep the light, bouncy spring stable.
      const steps = 4;
      const h = dt / steps;
      items.forEach(it => {
        it.target = targetFor(it);
        for (let s = 0; s < steps; s++) {
          const force = -stiffness * (it.size - it.target) - damping * it.velocity;
          it.velocity += (force / mass) * h;
          it.size += it.velocity * h;
        }
        if (Math.abs(it.size - it.target) < 0.05 && Math.abs(it.velocity) < 0.05) {
          it.size = it.target;
          it.velocity = 0;
        } else moving = true;
        const px = `${it.size.toFixed(2)}px`;
        it.el.style.width = px;
        it.el.style.height = px;
      });
      if (moving) raf = requestAnimationFrame(tick);
    };

    const wake = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };

    const onMove = e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      mouseX = e.clientX;
      wake();
    };
    const onLeave = () => { mouseX = Infinity; wake(); };
    panel.addEventListener('pointermove', onMove);
    panel.addEventListener('pointerleave', onLeave);

    return {
      destroy() {
        cancelAnimationFrame(raf);
        panel.removeEventListener('pointermove', onMove);
        panel.removeEventListener('pointerleave', onLeave);
        outer.remove();
      }
    };
  }

  window.Dock = Dock;
})();
