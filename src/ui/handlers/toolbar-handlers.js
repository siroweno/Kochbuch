export function createToolbarHandlers(deps) {
  return {
    onToolbarToggle() {
      const { toolbarToggle, toolbarPanel, toolbarOverlay } = deps.toolbar;
      const isOpen = toolbarPanel.classList.toggle('open');
      toolbarOverlay.classList.toggle('visible', isOpen);
      toolbarToggle.setAttribute('aria-expanded', String(isOpen));
    },

    onToolbarClose() {
      const { toolbarToggle, toolbarPanel, toolbarOverlay } = deps.toolbar;
      toolbarPanel.classList.remove('open');
      toolbarOverlay.classList.remove('visible');
      toolbarToggle.setAttribute('aria-expanded', 'false');
    },

    onToolbarOverlayClick() {
      const { toolbarToggle, toolbarPanel, toolbarOverlay } = deps.toolbar;
      toolbarPanel.classList.remove('open');
      toolbarOverlay.classList.remove('visible');
      toolbarToggle.setAttribute('aria-expanded', 'false');
    },
  };
}
