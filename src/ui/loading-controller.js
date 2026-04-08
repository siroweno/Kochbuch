export function createLoadingController({ state, dom, setVisible }) {
  const { loadingPanel } = dom;

  function clearLoadingDelay() {
    if (state.loadingDelayTimer) {
      window.clearTimeout(state.loadingDelayTimer);
      state.loadingDelayTimer = null;
    }
  }

  function setLoadingVisible(visible) {
    state.loadingVisible = visible;
    setVisible(loadingPanel, visible);
  }

  function syncLoadingPanel(_snapshot) {
    // The old loading panel (cooking pot) is replaced by the Mirage overlay.
    // Keep the panel permanently hidden.
    clearLoadingDelay();
    setLoadingVisible(false);
  }

  return { clearLoadingDelay, setLoadingVisible, syncLoadingPanel };
}
