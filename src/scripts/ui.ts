const root = document.documentElement;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- theme ---------- */
const readTheme = () => {
  try {
    return localStorage.getItem('theme');
  } catch {
    return null;
  }
};
document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    root.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      /* storage unavailable: theme still switches for this page */
    }
  });
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  if (!readTheme()) root.dataset.theme = e.matches ? 'dark' : 'light';
});

/* ---------- header: collapse the nav into the menu when it doesn't fit ---------- */
const bar = document.querySelector<HTMLElement>('.site-header .inner');
if (bar && 'ResizeObserver' in window) {
  const fit = () => {
    root.classList.remove('nav-tight');
    root.classList.toggle('nav-tight', bar.scrollWidth > bar.clientWidth);
  };
  new ResizeObserver(fit).observe(bar);
  document.fonts?.ready.then(fit);
}

/* ---------- clock (UTC+8) ---------- */
const clocks = document.querySelectorAll<HTMLElement>('[data-clock]');
if (clocks.length) {
  const fmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const tick = () => {
    const s = fmt.format(new Date());
    clocks.forEach((c) => (c.textContent = s));
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- decode / scramble text ---------- */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/<>#_';
document.querySelectorAll<HTMLElement>('[data-scramble]').forEach((el) => {
  const final = el.textContent ?? '';
  if (reduceMotion || !final.trim()) return;
  const chars = [...final];
  const total = 26;
  let frame = 0;
  const step = () => {
    const progress = frame / total;
    el.textContent = chars
      .map((ch, i) => {
        if (ch === ' ') return ch;
        return progress >= (i + 1) / chars.length ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      })
      .join('');
    if (frame++ < total) setTimeout(step, 38);
    else el.textContent = final;
  };
  setTimeout(step, 250);
});

/* ---------- reveal on scroll ---------- */
const items = document.querySelectorAll<HTMLElement>('.reveal');
if (items.length && 'IntersectionObserver' in window && !reduceMotion) {
  root.classList.add('reveal-on');
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -6% 0px' },
  );
  items.forEach((el) => io.observe(el));
}
