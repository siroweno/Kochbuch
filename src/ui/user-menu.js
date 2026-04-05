export function initializeUserMenu() {
  const userMenuTrigger = document.getElementById('userMenuTrigger');
  const userMenuDropdown = document.getElementById('userMenuDropdown');
  if (!userMenuTrigger || !userMenuDropdown) return { destroy() {} };

  function onTriggerClick(e) {
    e.stopPropagation();
    userMenuDropdown.classList.toggle('visible');
  }

  function onDocumentClick() {
    userMenuDropdown.classList.remove('visible');
  }

  userMenuTrigger.addEventListener('click', onTriggerClick);
  document.addEventListener('click', onDocumentClick);

  return {
    destroy() {
      userMenuTrigger.removeEventListener('click', onTriggerClick);
      document.removeEventListener('click', onDocumentClick);
    },
  };
}
