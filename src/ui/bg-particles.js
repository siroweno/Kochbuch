export function createBackgroundParticles({ root = document.body } = {}) {
  // Pruefe Voraussetzungen
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return { destroy() {} };

  const isTouch = !window.matchMedia('(pointer: fine)').matches;

  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;z-index:-1;pointer-events:none;';
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let width, height;
  let mouseX = -1000, mouseY = -1000;
  let particles = [];
  let animId = null;

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function initParticles() {
    particles = [];
    // Weniger Partikel auf Touch-Geraeten
    const count = isTouch
      ? Math.max(30, Math.min(50, Math.floor((width * height) / 30000)))
      : Math.max(80, Math.min(100, Math.floor((width * height) / 15000)));
    for (let i = 0; i < count; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      particles.push({
        x,
        y,
        baseX: x,
        baseY: y,
        size: 1 + Math.random() * 2,
        opacity: 0.1 + Math.random() * 0.25,
        speed: 0.1 + Math.random() * 0.3,
        angle: Math.random() * Math.PI * 2,
        // Fuer die Stern-Form
        isStar: Math.random() > 0.6,
      });
    }
  }

  function drawStar(x, y, size, opacity) {
    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#C9A84C';
    ctx.translate(x, y);
    // 4-zackiger Stern
    const s = size;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 === 0 ? s : s * 0.4;
      const a = (i * Math.PI) / 4;
      if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawDot(x, y, size, opacity) {
    ctx.globalAlpha = opacity;
    ctx.fillStyle = '#C9A84C';
    ctx.beginPath();
    ctx.arc(x, y, size * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    const mouseRadius = 120; // Radius der Maus-Abstossung
    const pushForce = 40; // Wie stark Partikel weggeschoben werden
    const returnSpeed = 0.03; // Wie schnell sie zurueckkommen

    for (const p of particles) {
      // Langsame Eigenbewegung (Schweben)
      p.angle += 0.002;
      p.baseX += Math.cos(p.angle) * p.speed * 0.3;
      p.baseY += Math.sin(p.angle) * p.speed * 0.3;

      // Wrap around
      if (p.baseX < -10) p.baseX = width + 10;
      if (p.baseX > width + 10) p.baseX = -10;
      if (p.baseY < -10) p.baseY = height + 10;
      if (p.baseY > height + 10) p.baseY = -10;

      // Maus-Abstossung (nur auf Nicht-Touch-Geraeten)
      const dx = p.x - mouseX;
      const dy = p.y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (!isTouch && dist < mouseRadius && dist > 0) {
        const force = (mouseRadius - dist) / mouseRadius;
        const pushX = (dx / dist) * force * pushForce;
        const pushY = (dy / dist) * force * pushForce;
        p.x += pushX * 0.08;
        p.y += pushY * 0.08;
      }

      // Zurueck zur Basis-Position (sanft)
      p.x += (p.baseX - p.x) * returnSpeed;
      p.y += (p.baseY - p.y) * returnSpeed;

      // Zeichnen
      if (p.isStar) {
        drawStar(p.x, p.y, p.size, p.opacity);
      } else {
        drawDot(p.x, p.y, p.size, p.opacity);
      }
    }

    animId = requestAnimationFrame(animate);
  }

  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }

  function onMouseLeave() {
    mouseX = -1000;
    mouseY = -1000;
  }

  function onResize() {
    resize();
    initParticles();
  }

  resize();
  initParticles();
  animate();

  window.addEventListener('resize', onResize);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseleave', onMouseLeave);

  return {
    destroy() {
      if (animId) cancelAnimationFrame(animId);
      canvas.remove();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
    }
  };
}
