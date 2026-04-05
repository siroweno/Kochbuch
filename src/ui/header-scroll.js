export function initializeHeaderScroll() {
  const headerEl = document.getElementById('siteHeader');
  const headerInner = headerEl ? headerEl.querySelector('.header-inner') : null;
  const subtitleEl = headerEl ? headerEl.querySelector('.subtitle') : null;
  const spacerEl = document.getElementById('headerSpacer');
  const userMenuEl = document.getElementById('userMenu');
  const toolbarToggleEl = document.getElementById('toolbarToggle');

  if (!headerEl || !headerInner || !spacerEl) return { destroy() {} };

  const COMPACT_H = 38;
  const RANGE = 100;

  function measureHeader() {
    headerEl.style.position = 'static';
    const h = headerEl.offsetHeight;
    headerEl.style.position = '';
    spacerEl.style.height = h + 'px';
    return h;
  }
  const fullH = measureHeader();

  headerEl.style.height = fullH + 'px';

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const sy = window.scrollY;
      const p = Math.min(sy / RANGE, 1);

      const visibleH = fullH - (fullH - COMPACT_H) * p;
      const clipBottom = Math.round(fullH - visibleH);
      headerEl.style.clipPath = `inset(0 0 ${clipBottom}px 0)`;

      spacerEl.style.setProperty('--hdr-clip-h', `${Math.round(visibleH)}px`);

      const scale = 1 - 0.58 * p;
      headerInner.style.transform = `scale(${Math.round(scale * 1000) / 1000})`;

      if (subtitleEl) {
        subtitleEl.style.opacity = String(Math.round(Math.max(0, 1 - p * 3) * 100) / 100);
      }

      const opStr = String(Math.round(p * 100) / 100);
      headerEl.style.setProperty('--hdr-bg-op', opStr);
      spacerEl.style.setProperty('--hdr-bg-op', opStr);

      headerEl.style.setProperty('--hdr-ara-op', String(Math.round(0.45 * (1 - p) * 1000) / 1000));

      const iconOp = Math.round(Math.max(0, 1 - p * 2.5) * 100) / 100;
      const iconOpStr = String(iconOp);
      const iconPtr = iconOp < 0.1 ? 'none' : '';
      if (userMenuEl) { userMenuEl.style.opacity = iconOpStr; userMenuEl.style.pointerEvents = iconPtr; }
      if (toolbarToggleEl) { toolbarToggleEl.style.opacity = iconOpStr; toolbarToggleEl.style.pointerEvents = iconPtr; }

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  return {
    destroy() {
      window.removeEventListener('scroll', onScroll);
    },
  };
}
