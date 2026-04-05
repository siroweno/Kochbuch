export function initializeHeaderScroll() {
  const headerEl = document.getElementById('siteHeader');
  const headerInner = headerEl ? headerEl.querySelector('.header-inner') : null;
  const subtitleEl = headerEl ? headerEl.querySelector('.subtitle') : null;
  const spacerEl = document.getElementById('headerSpacer');
  const userMenuEl = document.getElementById('userMenu');
  const toolbarToggleEl = document.getElementById('toolbarToggle');

  if (!headerEl || !headerInner || !spacerEl) return;

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
      headerEl.style.clipPath = 'inset(0 0 ' + (fullH - visibleH).toFixed(0) + 'px 0)';

      spacerEl.style.setProperty('--hdr-clip-h', visibleH.toFixed(0) + 'px');

      const scale = 1 - 0.58 * p;
      headerInner.style.transform = 'scale(' + scale.toFixed(3) + ')';

      if (subtitleEl) {
        subtitleEl.style.opacity = Math.max(0, 1 - p * 3).toFixed(2);
      }

      headerEl.style.setProperty('--hdr-bg-op', p.toFixed(2));
      spacerEl.style.setProperty('--hdr-bg-op', p.toFixed(2));

      headerEl.style.setProperty('--hdr-ara-op', (0.45 * (1 - p)).toFixed(3));

      const iconOp = Math.max(0, 1 - p * 2.5).toFixed(2);
      const iconPtr = Number(iconOp) < 0.1 ? 'none' : '';
      if (userMenuEl) { userMenuEl.style.opacity = iconOp; userMenuEl.style.pointerEvents = iconPtr; }
      if (toolbarToggleEl) { toolbarToggleEl.style.opacity = iconOp; toolbarToggleEl.style.pointerEvents = iconPtr; }

      ticking = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}
