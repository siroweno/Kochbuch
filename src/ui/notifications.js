import { animateOut } from './view-helpers.js';

export function createNotificationCenter({ container, liveRegion = null, defaultDuration = 4200 }) {
  let nextId = 0;

  function dismiss(element) {
    if (!element?.isConnected) return;
    animateOut(element, 'visible', () => element.remove(), 250);
  }

  function show(message, { tone = 'info', duration = defaultDuration } = {}) {
    const text = String(message || '').trim();
    if (!text || !container) return null;

    const toast = document.createElement('div');
    toast.className = `notification-toast notification-toast-${tone}`;
    toast.dataset.notificationId = String(++nextId);

    const copy = document.createElement('p');
    copy.className = 'notification-copy';
    copy.textContent = text;
    toast.appendChild(copy);

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'notification-dismiss';
    closeButton.setAttribute('aria-label', 'Hinweis schließen');
    closeButton.textContent = '×';
    closeButton.addEventListener('click', () => dismiss(toast));
    toast.appendChild(closeButton);

    container.appendChild(toast);
    window.requestAnimationFrame(() => {
      toast.classList.add('visible');
    });

    if (liveRegion) {
      liveRegion.textContent = text;
    }

    if (duration > 0) {
      window.setTimeout(() => dismiss(toast), duration);
    }

    return toast;
  }

  return {
    dismiss,
    error(message, options = {}) {
      return show(message, { ...options, tone: 'error' });
    },
    info(message, options = {}) {
      return show(message, { ...options, tone: 'info' });
    },
    success(message, options = {}) {
      return show(message, { ...options, tone: 'success' });
    },
    show,
  };
}
