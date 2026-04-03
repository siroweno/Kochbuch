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
