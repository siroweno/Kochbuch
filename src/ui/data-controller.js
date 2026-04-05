import { createEmptyWeekPlan } from '../cookbook-schema.js';

export function createDataController(deps) {
  const { state, repository, authService, authShell, recipesController, plannerController, tagBarController, focusManager, updatePlannerShoppingList, dom } = deps;

  function applyLoadResult(result, { scope = 'full' } = {}) {
    state.latestAppData = result;
    state.recipes = result.recipes || [];
    state.recipeLookup = new Map(state.recipes.map((recipe) => [String(recipe.id), recipe]));
    state.weekPlan = result.weekPlan || createEmptyWeekPlan();
    state.plannerDraftWeekPlan = null;
    state.dragState = null;
    authShell.applyRoleUi(result.capabilities?.canAdmin);

    if (scope === 'planner') {
      plannerController.refresh();
    } else if (scope === 'recipes') {
      recipesController.render();
      tagBarController.renderTagBar();
      if (state.plannerOpen) {
        plannerController.render();
      }
    } else {
      recipesController.render();
      tagBarController.renderTagBar();
      plannerController.refresh();
    }

    dom.migrateLocalBtn.style.display = result.capabilities?.canAdmin && result.migration?.hasLegacyData && !result.migration?.alreadyMigrated ? '' : 'none';
    focusManager.restorePendingFocusTarget();
  }

  async function refreshAppData({ silent = false } = {}) {
    if (state.inflightRefreshPromise) {
      return state.inflightRefreshPromise;
    }

    state.inflightRefreshPromise = (async () => {
      if (!silent) {
        authShell.renderAuthShell({
          ...state.latestAuthSnapshot,
          accessState: state.latestAuthSnapshot.accessState === 'signed_in' ? 'loading' : state.latestAuthSnapshot.accessState,
        });
      }
      const result = await repository.loadAppData();
      authShell.renderAuthShell(authService.getSnapshot());
      applyLoadResult(result);
      return result;
    })();

    try {
      return await state.inflightRefreshPromise;
    } finally {
      state.inflightRefreshPromise = null;
    }
  }

  async function waitForAppReady() {
    if (!state.inflightRefreshPromise) return;

    try {
      await state.inflightRefreshPromise;
    } catch (_error) {
      // Callers surface their own action errors. We only want to wait for the current load to settle.
    }
  }

  return { applyLoadResult, refreshAppData, waitForAppReady };
}
