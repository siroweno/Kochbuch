const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(',');

function getFocusableElements(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
    .filter((element) => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true');
}

function trapFocus(container, event) {
  const focusable = getFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  const active = document.activeElement;

  if (event.shiftKey) {
    if (active === first || !container.contains(active)) {
      event.preventDefault();
      last.focus();
    }
    return;
  }

  if (active === last) {
    event.preventDefault();
    first.focus();
  }
}

function setTreeInert(root, inert) {
  if (!root) return;
  root.toggleAttribute('inert', inert);
  root.setAttribute('aria-hidden', inert ? 'true' : 'false');
}

export function createDialogController({
  overlay,
  content = overlay,
  appShell = null,
  initialFocus = null,
  onOpen = null,
  onClose = null,
}) {
  let lastTrigger = null;

  function focusInitialTarget() {
    const candidate = typeof initialFocus === 'function' ? initialFocus() : initialFocus;
    if (candidate?.focus) {
      candidate.focus();
      return;
    }

    const firstFocusable = getFocusableElements(content)[0];
    if (firstFocusable?.focus) {
      firstFocusable.focus();
      return;
    }

    if (!content.hasAttribute('tabindex')) {
      content.setAttribute('tabindex', '-1');
    }
    content.focus();
  }

  function open({ trigger = document.activeElement } = {}) {
    lastTrigger = trigger;
    overlay.classList.add('visible');
    if (appShell) {
      setTreeInert(appShell, true);
    }
    onOpen?.();
    focusInitialTarget();
  }

  function close({ restoreFocus = true } = {}) {
    overlay.classList.remove('visible');

    // Inert erst nach CSS-Transition entfernen (damit die Animation sichtbar bleibt)
    const cleanup = () => {
      if (!isOpen() && appShell) {
        setTreeInert(appShell, false);
      }
    };
    overlay.addEventListener('transitionend', cleanup, { once: true });
    // Fallback falls keine Transition (z.B. prefers-reduced-motion)
    setTimeout(cleanup, 500);

    onClose?.({ restoreFocus, lastTrigger });
    if (restoreFocus && lastTrigger?.isConnected) {
      lastTrigger.focus();
    }
    lastTrigger = null;
  }

  function isOpen() {
    return overlay.classList.contains('visible');
  }

  function handleKeydown(event) {
    if (!isOpen()) return false;

    if (event.key === 'Tab') {
      trapFocus(content, event);
      return true;
    }

    return false;
  }

  return {
    close,
    getLastTrigger: () => lastTrigger,
    handleKeydown,
    isOpen,
    open,
    setLastTrigger(trigger) {
      lastTrigger = trigger;
    },
  };
}
