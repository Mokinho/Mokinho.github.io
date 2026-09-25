/*
 * GradualBlur — vanilla JS port of the React Bits <GradualBlur /> component.
 * Stacks masked backdrop-filter layers so content blurs progressively toward an edge.
 * Plain Math replaces mathjs. Extra option: hideAtEnd fades a page-target blur out once you reach
 * the end of the page, so the footer isn't left blurred.
 * Usage: GradualBlur(parentEl, { position, strength, height, width, divCount, exponential, curve, opacity,
 *                                animated, duration, easing, hoverIntensity, target, preset, zIndex,
 *                                className, hideAtEnd })
 */
(function () {
  const DEFAULTS = {
    position: 'bottom', strength: 2, height: '6rem', divCount: 5, exponential: false, zIndex: 1000,
    animated: false, duration: '0.3s', easing: 'ease-out', opacity: 1, curve: 'linear',
    target: 'parent', className: '', hideAtEnd: false
  };

  const PRESETS = {
    top: { position: 'top', height: '6rem' },
    bottom: { position: 'bottom', height: '6rem' },
    left: { position: 'left', height: '6rem' },
    right: { position: 'right', height: '6rem' },
    subtle: { height: '4rem', strength: 1, opacity: 0.8, divCount: 3 },
    intense: { height: '10rem', strength: 4, divCount: 8, exponential: true },
    smooth: { height: '8rem', curve: 'bezier', divCount: 10 },
    sharp: { height: '5rem', curve: 'linear', divCount: 4 },
    header: { position: 'top', height: '8rem', curve: 'ease-out' },
    footer: { position: 'bottom', height: '8rem', curve: 'ease-out' },
    sidebar: { position: 'left', height: '6rem', strength: 2.5 },
    'page-header': { position: 'top', height: '10rem', target: 'page', strength: 3 },
    'page-footer': { position: 'bottom', height: '10rem', target: 'page', strength: 3 }
  };

  const CURVES = {
    linear: p => p,
    bezier: p => p * p * (3 - 2 * p),
    'ease-in': p => p * p,
    'ease-out': p => 1 - Math.pow(1 - p, 2),
    'ease-in-out': p => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2)
  };

  const DIRECTION = { top: 'to top', bottom: 'to bottom', left: 'to left', right: 'to right' };

  function GradualBlur(parent, opts = {}) {
    const c = Object.assign({}, DEFAULTS, PRESETS[opts.preset] || {}, opts);
    const isPage = c.target === 'page';
    const vertical = c.position === 'top' || c.position === 'bottom';

    const root = document.createElement('div');
    root.className = `gradual-blur ${isPage ? 'gradual-blur-page' : 'gradual-blur-parent'} ${c.className}`.trim();
    root.setAttribute('aria-hidden', 'true');
    const s = root.style;
    s.position = isPage ? 'fixed' : 'absolute';
    s.pointerEvents = c.hoverIntensity ? 'auto' : 'none';
    s.zIndex = isPage ? c.zIndex + 100 : c.zIndex;
    s[c.position] = 0;
    if (vertical) { s.left = 0; s.right = 0; s.height = c.height; s.width = c.width || '100%'; }
    else { s.top = 0; s.bottom = 0; s.height = '100%'; s.width = c.width || c.height; }
    if (c.animated || c.hideAtEnd) s.transition = `opacity ${c.duration} ${c.easing}`;

    const inner = document.createElement('div');
    inner.className = 'gradual-blur-inner';
    root.appendChild(inner);

    const layers = [];
    for (let i = 1; i <= c.divCount; i++) {
      const d = document.createElement('div');
      d.style.position = 'absolute';
      d.style.inset = '0';
      d.style.opacity = c.opacity;
      if (c.animated && c.animated !== 'scroll') d.style.transition = `backdrop-filter ${c.duration} ${c.easing}`;
      inner.appendChild(d);
      layers.push(d);
    }

    const paint = hovered => {
      const inc = 100 / c.divCount;
      const strength = hovered && c.hoverIntensity ? c.strength * c.hoverIntensity : c.strength;
      const curve = CURVES[c.curve] || CURVES.linear;
      const dir = DIRECTION[c.position] || 'to bottom';
      layers.forEach((d, idx) => {
        const i = idx + 1;
        const p = curve(i / c.divCount);
        const blur = c.exponential
          ? Math.pow(2, p * 4) * 0.0625 * strength
          : 0.0625 * (p * c.divCount + 1) * strength;
        const r = v => Math.round(v * 10) / 10;
        const p1 = r(inc * i - inc), p2 = r(inc * i), p3 = r(inc * i + inc), p4 = r(inc * i + inc * 2);
        let g = `transparent ${p1}%, black ${p2}%`;
        if (p3 <= 100) g += `, black ${p3}%`;
        if (p4 <= 100) g += `, transparent ${p4}%`;
        const mask = `linear-gradient(${dir}, ${g})`;
        d.style.maskImage = mask;
        d.style.webkitMaskImage = mask;
        d.style.backdropFilter = `blur(${blur.toFixed(3)}rem)`;
        d.style.webkitBackdropFilter = `blur(${blur.toFixed(3)}rem)`;
      });
    };
    paint(false);

    if (c.hoverIntensity) {
      root.addEventListener('mouseenter', () => paint(true));
      root.addEventListener('mouseleave', () => paint(false));
    }

    // Visibility: scroll-reveal, fade-in, and hide-at-end all drive the root opacity.
    let inView = c.animated !== 'scroll';
    let atEnd = false;
    const sync = () => { s.opacity = inView && !atEnd ? 1 : 0; };

    if (c.animated === 'scroll' && 'IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => {
        inView = e.isIntersecting; sync();
        if (inView && c.onAnimationComplete) setTimeout(c.onAnimationComplete, parseFloat(c.duration) * 1000);
      }, { threshold: 0.1 }).observe(root);
    } else if (c.animated === true) {
      s.opacity = 0;
      requestAnimationFrame(() => requestAnimationFrame(sync));
    }

    if (isPage && c.hideAtEnd) {
      const check = () => {
        const doc = document.documentElement;
        const end = c.position === 'top'
          ? window.scrollY <= 2
          : window.innerHeight + window.scrollY >= doc.scrollHeight - 2;
        if (end !== atEnd) { atEnd = end; sync(); }
      };
      window.addEventListener('scroll', check, { passive: true });
      window.addEventListener('resize', check);
      check();
    }

    sync();
    (isPage ? document.body : parent).appendChild(root);
    return root;
  }

  GradualBlur.PRESETS = PRESETS;
  GradualBlur.CURVES = CURVES;
  window.GradualBlur = GradualBlur;
})();
