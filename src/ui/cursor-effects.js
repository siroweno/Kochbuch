export function initializeCursorEffects() {
  // Cursor "Schreib"-Animation mit Partikeln beim Klicken
  function onMouseDown(e) {
    document.body.classList.add('cursor-write');

    // Partikel-Burst am Klickpunkt (Gold-Tintenspritzer)
    const colors = ['#C9A84C', '#E8CC6E', '#D4943A', '#B87333', '#C9A84C'];
    for (let i = 0; i < 6; i++) {
      const particle = document.createElement('div');
      particle.className = 'stir-particle';
      const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.8;
      const distance = 14 + Math.random() * 18;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      particle.style.left = `${e.clientX - 3}px`;
      particle.style.top = `${e.clientY - 3}px`;
      particle.style.setProperty('--dx', `${dx}px`);
      particle.style.setProperty('--dy', `${dy}px`);
      particle.style.background = colors[i % colors.length];
      particle.style.width = `${3 + Math.random() * 4}px`;
      particle.style.height = particle.style.width;
      document.body.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove());
    }
  }

  function onMouseUp() {
    setTimeout(() => document.body.classList.remove('cursor-write'), 150);
  }

  // Ink-Ripple-Effekt bei jedem Klick
  function onClick(e) {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ripple = document.createElement('div');
    ripple.className = 'ink-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  }

  document.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mouseup', onMouseUp);
  document.addEventListener('click', onClick);

  // Cursor-Glow (nur Desktop, nur wenn keine reduzierte Bewegung)
  let glow = null;
  let rafId = null;
  let onMouseMove = null;

  if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    glow = document.createElement('div');
    glow.id = 'cursor-glow';
    document.body.appendChild(glow);

    onMouseMove = (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
        rafId = null;
      });
    };
    document.addEventListener('mousemove', onMouseMove);
  }

  return {
    destroy() {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('click', onClick);
      if (onMouseMove) document.removeEventListener('mousemove', onMouseMove);
      if (rafId) cancelAnimationFrame(rafId);
      if (glow) glow.remove();
    },
  };
}
