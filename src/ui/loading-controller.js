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

  function syncLoadingPanel(snapshot) {
    if (snapshot.accessState === 'loading') {
      if (state.loadingVisible || state.loadingDelayTimer) return;
      state.loadingDelayTimer = window.setTimeout(() => {
        state.loadingDelayTimer = null;
        if (state.latestAuthSnapshot.accessState === 'loading') {
          setLoadingVisible(true);
        }
      }, 250);
      return;
    }

    clearLoadingDelay();
    setLoadingVisible(false);
  }

  return { clearLoadingDelay, setLoadingVisible, syncLoadingPanel };
}
