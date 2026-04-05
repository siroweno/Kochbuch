export function createAuthHandlers(deps) {
  const {
    authService,
    browserTestEmail,
    googleLoginBtn,
    state,
    createEmptyWeekPlan,
    renderAuthShell,
    waitForAppReady,
    refreshAppData,
    resetPlannerDraftState,
    setPlannerOpen,
    renderRecipes,
  } = deps;

  return {
    async onGoogleLogin() {
      try {
        googleLoginBtn.disabled = true;
        await authService.signInWithGoogle();
        renderAuthShell(authService.getSnapshot());
      } catch (error) {
        googleLoginBtn.disabled = false;
        deps.loginMessage.textContent = error.message || 'Google-Login fehlgeschlagen.';
      }
    },

    async onBrowserTestLoginSubmit(event) {
      event.preventDefault();
      try {
        await authService.signInForBrowserTest(browserTestEmail.value);
        const snapshot = authService.getSnapshot();
        renderAuthShell(snapshot);
        if (snapshot.accessState === 'signed_in') {
          await waitForAppReady();
          await refreshAppData({ silent: true });
          window.scrollTo(0, 0);
        }
      } catch (error) {
        deps.loginMessage.textContent = error.message || 'Test-Login fehlgeschlagen.';
      }
    },

    async onSignOut() {
      await authService.signOut();
      renderAuthShell(authService.getSnapshot());
      browserTestEmail.value = '';
      googleLoginBtn.disabled = false;
      state.recipes = [];
      state.recipeLookup = new Map();
      state.weekPlan = createEmptyWeekPlan();
      state.activePlannerDay = null;
      state.activeDayPicker = null;
      state.activeDayPickerQuery = '';
      state.favoriteFilterActive = false;
      state.activeTagFilter = [];
      state.pendingFocusTarget = null;
      state.modalPlanningFeedback = '';
      resetPlannerDraftState();
      setPlannerOpen(false);
      renderRecipes();
    },

    async onAuthStateChange(snapshot) {
      renderAuthShell(snapshot);
      if (snapshot.accessState === 'signed_in') {
        await refreshAppData({ silent: true });
        window.scrollTo(0, 0);
      }
    },

    async onWindowFocus() {
      if (authService.getSnapshot().accessState === 'signed_in') {
        await refreshAppData({ silent: true });
      }
    },
  };
}
