export function escapeHtml(text) {
  const node = document.createElement('div');
  node.textContent = text;
  return node.innerHTML;
}

export function escapeAttribute(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function setVisible(element, visible, className = 'visible') {
  if (!element) return;
  if (className) {
    element.classList.toggle(className, visible);
  }
  element.style.display = visible ? '' : 'none';
}

/**
 * Removes a CSS class and waits for the transition to finish before calling
 * the callback. Prevents double-execution and memory leaks via a timeout fallback.
 */
export function animateOut(element, className, callback, timeoutMs = 400) {
  if (!element) return;

  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    callback?.();
  };

  element.addEventListener('transitionend', finish, { once: true });
  setTimeout(finish, timeoutMs);
  element.classList.remove(className);
}
