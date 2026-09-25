// Mobile nav toggle
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

const closeNav = () => {
  navLinks.classList.remove('open');
  navToggle.classList.remove('open');
  navToggle.setAttribute('aria-expanded', 'false');
};

navToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  navToggle.classList.toggle('open', isOpen);
  navToggle.setAttribute('aria-expanded', String(isOpen));
});
navLinks.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
document.addEventListener('click', e => {
  if (!e.target.closest('.header-inner, .nav-wheel')) closeNav();
});

// Header background once scrolled
const header = document.getElementById('header');
const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Scroll reveal
const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('in-view');
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });
document.querySelectorAll('.reveal').forEach(el => revealObserver.observe(el));

// Active nav link on scroll
const navAnchors = document.querySelectorAll('.nav-links a[data-nav]');
const navObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const anchor = document.querySelector(`.nav-links a[href="#${entry.target.id}"]`);
    if (!anchor) return;
    navAnchors.forEach(a => a.classList.remove('active'));
    anchor.classList.add('active');
  });
}, { rootMargin: '-40% 0px -55% 0px' });
document.querySelectorAll('main section[id]').forEach(s => navObserver.observe(s));

// Hero particles
(() => {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const colors = ['232,80,2', '241,96,1', '217,195,171', '255,255,255'];
  let w, h, dpr, dots = [];

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.round((w * h) / 9000);
    dots = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      r: Math.random() * 1.6 + .4,
      vx: (Math.random() - .5) * .25, vy: -(Math.random() * .3 + .05),
      a: Math.random() * .6 + .2,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, w, h);
    for (const d of dots) {
      d.x += d.vx; d.y += d.vy;
      if (d.y < -5) { d.y = h + 5; d.x = Math.random() * w; }
      if (d.x < -5) d.x = w + 5; else if (d.x > w + 5) d.x = -5;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${d.c},${d.a})`;
      ctx.fill();
    }
    if (!reduce) requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener('resize', resize);
})();

// Desktop menu — RubberSegment thumb (stretch + squash), synced with scroll-spy
(() => {
  if (!window.RubberSegment) return;
  const links = [...navLinks.querySelectorAll('a')];
  let locked = false;
  let unlockTimer = 0;
  const activeIndex = () => links.findIndex(a => a.classList.contains('active'));
  const unlock = () => { locked = false; seg.setActive(activeIndex()); };
  const lockUntilScrollEnds = () => {
    locked = true;
    const bump = () => { clearTimeout(unlockTimer); unlockTimer = setTimeout(() => { window.removeEventListener('scroll', bump); unlock(); }, 180); };
    window.addEventListener('scroll', bump, { passive: true });
    bump();
    clearTimeout(unlockTimer);
    unlockTimer = setTimeout(() => { window.removeEventListener('scroll', bump); unlock(); }, 900);
  };
  const seg = window.RubberSegment(navLinks, {
    links,
    inset: 5,
    radius: 22,
    stretch: 100,
    squash: 3,
    speed: 1,
    glide: 75,
    draggable: true,
    onCommit: (i, how) => {
      lockUntilScrollEnds();
      if (how === 'drag') {
        const href = links[i].getAttribute('href');
        const target = document.querySelector(href);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth' });
          history.replaceState(null, '', href);
        }
      }
    }
  });
  if (!seg) return;
  // Scroll-spy moves the thumb too (ignored while a click/drag scroll is in flight).
  new MutationObserver(() => { if (!locked) seg.setActive(activeIndex()); })
    .observe(navLinks, { subtree: true, attributes: true, attributeFilter: ['class'] });
})();

// Hamburger menu (≤900px) — OptionWheel overlay
(() => {
  if (!window.OptionWheel) return;
  const mobile = window.matchMedia('(max-width: 900px)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const links = [...navLinks.querySelectorAll('a')];
  const items = links.map(a => ({ label: (a.querySelector('.pill-label') || a).textContent.trim(), href: a.getAttribute('href') }));
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e85002';

  const overlay = document.createElement('div');
  overlay.className = 'nav-wheel';
  overlay.id = 'navWheel';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = '<div class="nav-wheel-track"></div><p class="nav-wheel-hint">Scroll or drag · tap to go</p>';
  document.body.appendChild(overlay);

  let leaving = false;
  const go = (i, item) => {
    if (leaving) return;
    leaving = true;
    setTimeout(() => {
      closeNav();
      const el = document.querySelector(item.href);
      if (el) {
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
        history.replaceState(null, '', item.href);
      }
      leaving = false;
    }, reduce ? 0 : 320);
  };

  const wheel = window.OptionWheel(overlay.querySelector('.nav-wheel-track'), {
    items,
    defaultSelected: 0,
    textColor: '#8f857d',
    activeColor: accent,
    side: 'left',
    fontSize: 2.6,
    spacing: 1.45,
    curve: 1,
    tilt: 8,
    blur: 1.5,
    fade: 0.22,
    minOpacity: 0.08,
    smoothing: reduce ? 1 : 200,
    inset: 36,
    ariaLabel: 'Site sections',
    onSelect: go
  });
  navLinks.classList.add('has-wheel');

  const sync = () => {
    const open = navLinks.classList.contains('open') && mobile.matches;
    if (open === overlay.classList.contains('open')) return;
    overlay.classList.toggle('open', open);
    overlay.setAttribute('aria-hidden', String(!open));
    document.documentElement.classList.toggle('nav-wheel-lock', open);
    if (open) {
      const active = Math.max(0, links.findIndex(a => a.classList.contains('active')));
      wheel.select(active, true);
      setTimeout(() => wheel.focus(), 50);
    }
  };
  new MutationObserver(sync).observe(navLinks, { attributes: true, attributeFilter: ['class'] });
  mobile.addEventListener('change', () => { if (!mobile.matches) closeNav(); sync(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) { closeNav(); navToggle.focus(); }
  });
})();

// Contact card — Dock (magnifying icon dock), built from the contact links
(() => {
  const grid = document.querySelector('.contact-links');
  if (!grid || !window.Dock) return;
  const svg = d => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
  const ICONS = {
    email: svg('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>'),
    whatsapp: svg('<path d="M20.5 11.6a8.5 8.5 0 0 1-12.4 7.5L3.5 20.5l1.4-4.4a8.5 8.5 0 1 1 15.6-4.5z"/><path d="M9 9.2c.2 2.6 2.2 4.6 4.8 4.9l1-1.1 1.8.8-.4 1.6c-3.9.2-7.6-3.4-7.4-7.3l1.6-.4.8 1.8z"/>'),
    linkedin: svg('<rect x="3" y="3" width="18" height="18" rx="3.5"/><path d="M8 10.5V17M8 7.25v.01M12 17v-6.5M12 13.5a2.5 2.5 0 0 1 5 0V17"/>'),
    resume: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>')
  };
  const items = [...grid.querySelectorAll('a.contact-link')].map(a => {
    const label = a.querySelector('.contact-label').textContent.trim();
    const value = a.querySelector('.contact-value').textContent.trim();
    return {
      href: a.getAttribute('href'),
      target: a.getAttribute('target'),
      rel: a.getAttribute('rel'),
      label: label === 'Email' ? value : label,
      icon: ICONS[label.toLowerCase()] || ICONS.resume
    };
  });
  const mount = document.createElement('div');
  mount.className = 'contact-dock';
  grid.after(mount);
  const dock = window.Dock(mount, { items, panelHeight: 68, baseItemSize: 50, magnification: 70, distance: 200 });
  if (dock) grid.classList.add('is-docked');
})();

// BorderGlow (React Bits, vanilla port) on every card with a hover effect — pointer devices only
(() => {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const cards = document.querySelectorAll('.project-card, .play-card, .feature-card, .feature-wide, .service-card');
  cards.forEach(card => {
    // feature cards clipped their zooming image with overflow:hidden; clip the image itself instead
    if (card.classList.contains('feature-card')) {
      const img = card.querySelector(':scope > img');
      if (img) {
        const clip = document.createElement('span');
        clip.className = 'glow-media-clip';
        img.before(clip);
        clip.appendChild(img);
      }
    }
    const fx = document.createElement('span');
    fx.className = 'glow-fx';
    fx.setAttribute('aria-hidden', 'true');
    fx.innerHTML = '<span class="glow-fill"></span><span class="glow-ring"></span><span class="edge-light"></span>';
    card.appendChild(fx);
    card.classList.add('glow-card');
    card.addEventListener('pointermove', e => {
      const r = card.getBoundingClientRect();
      const cx = r.width / 2, cy = r.height / 2;
      const dx = e.clientX - r.left - cx, dy = e.clientY - r.top - cy;
      const kx = dx !== 0 ? cx / Math.abs(dx) : Infinity;
      const ky = dy !== 0 ? cy / Math.abs(dy) : Infinity;
      const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);
      let deg = dx === 0 && dy === 0 ? 0 : Math.atan2(dy, dx) * (180 / Math.PI) + 90;
      if (deg < 0) deg += 360;
      card.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
      card.style.setProperty('--cursor-angle', `${deg.toFixed(3)}deg`);
    });
  });
})();

// TextLoop band between FAQ and Contact
(() => {
  const band = document.getElementById('loopBand');
  if (!band || !window.TextLoop) return;
  const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#e85002';
  const small = window.matchMedia('(max-width: 640px)').matches;
  window.TextLoop(band, {
    text: 'FAIQ & WEB DEV',
    shape: 'wave',
    fitWidth: true,           // full-width band, sizes below are real pixels
    period: small ? 220 : 340,
    speed: 60,
    direction: 'forward',
    separator: '✦',
    curviness: small ? 10 : 14,
    fontSize: small ? 15 : 20,
    fontWeight: 700,
    letterSpacing: 2,
    uppercase: true,
    color: '#120b07',
    ribbon: true,
    ribbonColor: accent,
    ribbonWidth: small ? 30 : 40,
    pauseOnHover: true
  });
})();

// Hero title — TechText canvas effect
(() => {
  const title = document.getElementById('heroTitle');
  const fx = title && title.querySelector('.hero-title-fx');
  if (!fx || !window.TechText) return;
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#e85002';
  const tt = window.TechText(fx, {
    segments: [
      { text: 'I build websites that are fast, ' },
      { text: 'secure', color: accent },
      { text: ' & built to grow.' }
    ],
    sizeFrom: title,
    fontWeight: 700,
    lineHeight: 1.08,
    letterSpacing: -0.02,
    pad: 32,
    color: '#ffffff',
    accentColor: accent,
    reveal: 'letter',
    dashLength: 4,
    dashGap: 2,
    strokeWidth: 1.2,
    specks: 15
  });
  if (tt) title.classList.add('tech-ready');
})();

// Footer year
document.getElementById('year').textContent = new Date().getFullYear();
