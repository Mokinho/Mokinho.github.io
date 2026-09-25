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
  if (!e.target.closest('.header-inner')) closeNav();
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
