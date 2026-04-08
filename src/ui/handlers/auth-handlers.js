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
    runMirageTransition,
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
        if (snapshot.accessState === 'signed_in') {
          // Show overlay FIRST, then reveal app shell behind it
          deps.showMirageOverlay();
          renderAuthShell(snapshot);
          await runMirageTransition(async () => {
            await waitForAppReady();
            return refreshAppData({ silent: true });
          });
        } else {
          renderAuthShell(snapshot);
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
      // Skip if a login handler is already managing the mirage transition
      if (deps.isMirageTransitionActive()) return;
      if (snapshot.accessState === 'signed_in') {
        deps.showMirageOverlay();
        renderAuthShell(snapshot);
        await runMirageTransition(async () => {
          return refreshAppData({ silent: true });
        });
      } else {
        renderAuthShell(snapshot);
      }
    },

    async onWindowFocus() {
      if (authService.getSnapshot().accessState === 'signed_in') {
        await refreshAppData({ silent: true });
      }
    },
  };
}
