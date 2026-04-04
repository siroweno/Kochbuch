const DEFAULT_FAVORITE_WORDS = ['yumm', 'lecker', 'wow', 'mmm', 'so gut', 'mehr davon', 'familienliebling'];
const STYLE_ID = 'effects-layer-styles';
const LIVE_REGION_ID = 'effects-layer-live-region';

function getReducedMotionPreference(explicitValue) {
  if (typeof explicitValue === 'boolean') {
    return explicitValue;
  }

  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
}

function normalizeRect(anchor, anchorRect) {
  if (anchorRect && typeof anchorRect === 'object') {
    return {
      x: Number(anchorRect.x ?? anchorRect.left ?? 0),
      y: Number(anchorRect.y ?? anchorRect.top ?? 0),
      width: Number(anchorRect.width ?? 0),
      height: Number(anchorRect.height ?? 0),
    };
  }

  if (anchor?.getBoundingClientRect) {
    const rect = anchor.getBoundingClientRect();
    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    };
  }

  return {
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
    width: 0,
    height: 0,
  };
}

function createElement(tagName, className, textContent) {
  const element = document.createElement(tagName);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .effects-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
      overflow: hidden;
      z-index: 80;
      contain: layout paint style;
    }

    .effects-layer__burst,
    .effects-layer__loading {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }

    .effects-layer__heart {
      position: absolute;
      left: 0;
      top: 0;
      transform: translate(-50%, -50%) scale(0.5);
      font-size: 24px;
      line-height: 1;
      filter: drop-shadow(0 8px 16px rgba(201, 168, 76, 0.16));
      animation: effects-heart-pop 820ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
    }

    .effects-layer__word {
      position: absolute;
      left: 0;
      top: 0;
      padding: 0.24rem 0.46rem;
      border-radius: 999px;
      background: rgba(212, 148, 58, 0.9);
      color: #0D1B2A;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 0.01em;
      box-shadow: 0 8px 24px rgba(201, 168, 76, 0.18);
      opacity: 0;
      transform: translate(-50%, -50%) translate(0, 0) scale(0.6);
      animation: effects-word-fan 980ms cubic-bezier(0.18, 0.84, 0.24, 1) forwards;
      animation-delay: var(--delay, 0ms);
      will-change: transform, opacity;
    }

    .effects-layer__word::before {
      content: '•';
      margin-right: 0.28rem;
      opacity: 0.45;
    }

    .effects-layer__loading {
      display: grid;
      place-items: center;
      background: radial-gradient(circle at center, rgba(13, 27, 42, 0.85), rgba(27, 45, 74, 0.6) 48%, rgba(13, 27, 42, 0.3) 100%);
    }

    .effects-layer__loading-pot {
      position: relative;
      display: grid;
      place-items: center;
      gap: 0.4rem;
      min-width: 7.5rem;
      padding: 1rem 1.2rem 0.8rem;
      border-radius: 1.4rem;
      background: linear-gradient(180deg, rgba(27, 45, 74, 0.94), rgba(13, 27, 42, 0.82));
      border: 1px solid rgba(201, 168, 76, 0.15);
      box-shadow: 0 18px 40px rgba(201, 168, 76, 0.08);
      color: #C9A84C;
    }

    .effects-layer__pot-body {
      position: relative;
      width: 3.1rem;
      height: 1.8rem;
      border-radius: 0.2rem 0.2rem 0.7rem 0.7rem;
      border: 2px solid currentColor;
      border-top-width: 3px;
      opacity: 0.9;
    }

    .effects-layer__pot-body::before {
      content: '';
      position: absolute;
      left: 50%;
      top: -0.72rem;
      width: 2.15rem;
      height: 0.42rem;
      border-radius: 999px;
      border: 2px solid currentColor;
      border-bottom: 0;
      transform: translateX(-50%);
      background: rgba(27, 45, 74, 0.92);
      animation: effects-lid-bob 1400ms ease-in-out infinite;
    }

    .effects-layer__steam {
      position: absolute;
      left: 50%;
      top: -1rem;
      width: 2.4rem;
      height: 1.5rem;
      transform: translateX(-50%);
      opacity: 0.55;
      background:
        radial-gradient(circle at 22% 62%, rgba(201, 168, 76, 0.26) 0 18%, transparent 19%),
        radial-gradient(circle at 50% 30%, rgba(201, 168, 76, 0.22) 0 18%, transparent 19%),
        radial-gradient(circle at 78% 62%, rgba(201, 168, 76, 0.26) 0 18%, transparent 19%);
      filter: blur(0.3px);
      animation: effects-steam-rise 1800ms ease-in-out infinite;
    }

    .effects-layer__loading-label {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.02em;
    }

    .effects-layer__loading-subline {
      font-size: 0.66rem;
      opacity: 0.7;
    }

    @keyframes effects-heart-pop {
      0% { opacity: 0; transform: translate(-50%, -50%) scale(0.45); }
      20% { opacity: 1; transform: translate(-50%, -50%) scale(1.06); }
      58% { opacity: 1; transform: translate(-50%, -56%) scale(1); }
      100% { opacity: 0; transform: translate(-50%, -72%) scale(1.08); }
    }

    @keyframes effects-word-fan {
      0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) scale(0.55); }
      18% { opacity: 1; }
      100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--dx, 0px), var(--dy, -24px)) scale(1); }
    }

    @keyframes effects-lid-bob {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(-2px); }
    }

    @keyframes effects-steam-rise {
      0% { transform: translateX(-50%) translateY(8px) scale(0.92); opacity: 0; }
      22% { opacity: 0.58; }
      55% { transform: translateX(-50%) translateY(-4px) scale(1); opacity: 0.42; }
      100% { transform: translateX(-50%) translateY(-16px) scale(1.04); opacity: 0; }
    }

    @media (prefers-reduced-motion: reduce) {
      .effects-layer__heart,
      .effects-layer__word,
      .effects-layer__loading-pot::before,
      .effects-layer__steam {
        animation-duration: 1ms !important;
        animation-iteration-count: 1 !important;
      }

      .effects-layer__word {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }
  `;
  document.head.appendChild(style);
}

function ensureLiveRegion(customLiveRegion) {
  if (customLiveRegion) {
    return customLiveRegion;
  }

  let liveRegion = document.getElementById(LIVE_REGION_ID);
  if (liveRegion) return liveRegion;

  liveRegion = createElement('div');
  liveRegion.id = LIVE_REGION_ID;
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.style.position = 'absolute';
  liveRegion.style.left = '-9999px';
  liveRegion.style.width = '1px';
  liveRegion.style.height = '1px';
  liveRegion.style.overflow = 'hidden';
  document.body.appendChild(liveRegion);
  return liveRegion;
}

export function createEffectsLayer({
  root = document.body,
  liveRegion = null,
  reducedMotion = null,
} = {}) {
  ensureStyles();

  const layer = createElement('div', 'effects-layer');
  layer.setAttribute('aria-hidden', 'true');

  let loadingNode = null;
  let liveRegionNode = ensureLiveRegion(liveRegion);
  let currentReducedMotion = getReducedMotionPreference(reducedMotion);
  let activeBurst = null;
  let activeHeart = null;

  function mount() {
    if (!layer.isConnected) {
      root.appendChild(layer);
    }
    return layer;
  }

  function unmount() {
    loadingNode?.remove();
    loadingNode = null;
    layer.remove();
  }

  function setReducedMotion(value) {
    currentReducedMotion = Boolean(value);
    layer.dataset.reducedMotion = String(currentReducedMotion);
  }

  function announce(message) {
    if (!liveRegionNode || !message) return;
    liveRegionNode.textContent = '';
    window.setTimeout(() => {
      liveRegionNode.textContent = message;
    }, 30);
  }

  function cleanupAfter(node, delay) {
    window.setTimeout(() => node.remove(), delay);
  }

  function replaceEffectNode(nextNode, currentNodeName, delay) {
    if (currentNodeName === 'heart' && activeHeart?.isConnected) {
      activeHeart.remove();
    }
    if (currentNodeName === 'burst' && activeBurst?.isConnected) {
      activeBurst.remove();
    }
    if (currentNodeName === 'heart') {
      activeHeart = nextNode;
    } else {
      activeBurst = nextNode;
    }
    cleanupAfter(nextNode, delay);
  }

  function getPlacement(anchor, anchorRect) {
    const rect = normalizeRect(anchor, anchorRect);
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
      width: rect.width,
      height: rect.height,
    };
  }

  function playHeartPop({ anchor = null, anchorRect = null } = {}) {
    mount();
    const placement = getPlacement(anchor, anchorRect);
    const heart = createElement('span', 'effects-layer__heart', '♥');
    heart.style.left = `${placement.x}px`;
    heart.style.top = `${placement.y}px`;
    layer.appendChild(heart);
    replaceEffectNode(heart, 'heart', currentReducedMotion ? 220 : 720);
    return heart;
  }

  function playFavoriteBurst({
    anchor = null,
    anchorRect = null,
    words = DEFAULT_FAVORITE_WORDS,
    surface = 'grid',
    message = 'Zu Favoriten hinzugefügt',
  } = {}) {
    mount();
    const placement = getPlacement(anchor, anchorRect);
    const heart = playHeartPop({ anchor, anchorRect });
    const usableWords = currentReducedMotion ? words.slice(0, 1) : words.slice(0, window.innerWidth < 640 ? 3 : 4);
    const burst = createElement('div', 'effects-layer__burst');
    burst.dataset.surface = surface;
    burst.style.left = `${placement.x}px`;
    burst.style.top = `${placement.y}px`;

    usableWords.forEach((word, index) => {
      const angle = -120 + (index * (usableWords.length === 1 ? 0 : 240 / Math.max(usableWords.length - 1, 1)));
      const radiusX = 32 + (index % 3) * 8;
      const radiusY = 28 + (index % 2) * 12;
      const dx = Math.round(Math.cos((angle * Math.PI) / 180) * radiusX);
      const dy = Math.round(Math.sin((angle * Math.PI) / 180) * radiusY);
      const chip = createElement('span', 'effects-layer__word', word);
      chip.style.setProperty('--dx', `${dx}px`);
      chip.style.setProperty('--dy', `${dy}px`);
      chip.style.setProperty('--delay', `${index * 36}ms`);
      burst.appendChild(chip);
    });

    layer.appendChild(burst);
    replaceEffectNode(burst, 'burst', currentReducedMotion ? 320 : 900);
    announce(message);
    return { heart, burst };
  }

  function stopLoadingSteam() {
    loadingNode?.remove();
    loadingNode = null;
  }

  function startLoadingSteam({ label = 'Kochbuch wird vorbereitet', subline = 'Einen Moment bitte' } = {}) {
    mount();
    if (loadingNode) return loadingNode;

    loadingNode = createElement('div', 'effects-layer__loading');
    const pot = createElement('div', 'effects-layer__loading-pot');
    const steam = createElement('div', 'effects-layer__steam');
    const labelNode = createElement('div', 'effects-layer__loading-label', label);
    const sublineNode = createElement('div', 'effects-layer__loading-subline', subline);
    pot.append(steam, labelNode, sublineNode);
    loadingNode.appendChild(pot);
    layer.appendChild(loadingNode);
    if (currentReducedMotion) {
      loadingNode.dataset.reducedMotion = 'true';
    }
    return loadingNode;
  }

  layer.dataset.reducedMotion = String(currentReducedMotion);

  return {
    mount,
    unmount,
    setReducedMotion,
    announce,
    playHeartPop,
    playFavoriteBurst,
    startLoadingSteam,
    stopLoadingSteam,
    get isReducedMotion() {
      return currentReducedMotion;
    },
  };
}
