export function initializeUserMenu() {
  const userMenuTrigger = document.getElementById('userMenuTrigger');
  const userMenuDropdown = document.getElementById('userMenuDropdown');
  if (!userMenuTrigger || !userMenuDropdown) return;

  userMenuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    userMenuDropdown.classList.toggle('visible');
  });
  document.addEventListener('click', () => {
    userMenuDropdown.classList.remove('visible');
  });
}
