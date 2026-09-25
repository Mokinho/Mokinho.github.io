/*
 * TrueFocus — vanilla JS port of the React Bits <TrueFocus /> component.
 * Cycles a sharp "focus" through the words of a phrase, blurring the rest, with an animated corner frame.
 * CSS transitions replace the motion/react tween.
 * Usage: TrueFocus(el, { sentence, separator, manualMode, blurAmount, borderColor, glowColor,
 *                        animationDuration, pauseBetweenAnimations })
 */
(function () {
  function TrueFocus(el, opts = {}) {
    const o = Object.assign({
      sentence: el.textContent.trim(),
      separator: ' ',
      manualMode: false,
      blurAmount: 5,
      borderColor: 'green',
      glowColor: 'rgba(0, 255, 0, 0.6)',
      animationDuration: 0.5,
      pauseBetweenAnimations: 1
    }, opts);

    const words = o.sentence.split(o.separator);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    el.classList.add('focus-container');
    el.setAttribute('aria-label', o.sentence);
    el.style.setProperty('--border-color', o.borderColor);
    el.style.setProperty('--glow-color', o.glowColor);
    el.style.setProperty('--tf-dur', o.animationDuration + 's');
    el.textContent = '';

    const wordEls = words.map((w, i) => {
      const s = document.createElement('span');
      s.className = 'focus-word' + (o.manualMode ? ' manual' : '');
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      el.appendChild(s);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
      return s;
    });

    const frame = document.createElement('span');
    frame.className = 'focus-frame';
    frame.setAttribute('aria-hidden', 'true');
    frame.innerHTML = ['top-left', 'top-right', 'bottom-left', 'bottom-right']
      .map(c => `<span class="corner ${c}"></span>`).join('');
    el.appendChild(frame);

    // Reduced motion: leave the phrase fully sharp, no frame.
    if (reduce) { el.classList.add('is-static'); return; }

    let current = 0;
    let lastActive = null;

    const render = () => {
      wordEls.forEach((w, i) => {
        const active = i === current;
        w.classList.toggle('active', active && !o.manualMode);
        w.style.filter = active ? 'blur(0px)' : `blur(${o.blurAmount}px)`;
      });
      const target = wordEls[current];
      if (!target) { frame.style.opacity = 0; return; }
      const p = el.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      frame.style.transform = `translate(${r.left - p.left}px, ${r.top - p.top}px)`;
      frame.style.width = r.width + 'px';
      frame.style.height = r.height + 'px';
      frame.style.opacity = 1;
    };

    if (o.manualMode) {
      wordEls.forEach((w, i) => {
        w.addEventListener('mouseenter', () => { lastActive = i; current = i; render(); });
        w.addEventListener('mouseleave', () => { current = lastActive; render(); });
      });
    } else {
      // Only cycle while the phrase is on screen.
      let timer = null;
      const step = (o.animationDuration + o.pauseBetweenAnimations) * 1000;
      const start = () => { if (!timer) timer = setInterval(() => { current = (current + 1) % words.length; render(); }, step); };
      const stop = () => { clearInterval(timer); timer = null; };
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => entries.forEach(e => (e.isIntersecting ? start() : stop()))).observe(el);
      } else start();
    }

    render();
    window.addEventListener('resize', render);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(render);
  }

  window.TrueFocus = TrueFocus;
})();
