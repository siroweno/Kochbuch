import {
  DAYS,
  getMealSlotLabel,
  isValidMealSlot,
  normalizePositiveInteger,
} from '../cookbook-schema.js';

export function createRecipeModalActions(deps) {
  const {
    state,
    dom,
    modalController,
    deleteDialogController,
    modalRecipeController,
    formController,
    focusManager,
    plannerActions,
    notifications,
    dataController,
    announceUi,
  } = deps;

  function ensureModalPlanningDefaults() {
    if (!state.modalPlanningDay) {
      state.modalPlanningDay = plannerActions.getTodayDayKey();
    }
    state.modalPlanningSlot = isValidMealSlot(state.modalPlanningSlot) ? state.modalPlanningSlot : (state.lastPlannerSlot || 'abend');
  }

  function syncModalPlanningUi() {
    ensureModalPlanningDefaults();
    dom.modalPlannerToggle?.setAttribute('aria-expanded', String(state.modalPlanningOpen));
    if (dom.modalPlannerPanel) {
      dom.modalPlannerPanel.classList.toggle('visible', state.modalPlanningOpen);
    }
    if (dom.modalPlannerDay) dom.modalPlannerDay.value = state.modalPlanningDay || plannerActions.getTodayDayKey();
    if (dom.modalPlannerSlot) dom.modalPlannerSlot.value = state.modalPlanningSlot || 'abend';
    if (dom.modalPlannerServings) {
      dom.modalPlannerServings.value = String(normalizePositiveInteger(dom.modalPlannerServings.value, state.currentModalServings || 2));
      if (state.currentModalServings) {
        dom.modalPlannerServings.value = String(state.currentModalServings);
      }
    }
    if (dom.modalPlannerFeedback) {
      dom.modalPlannerFeedback.textContent = state.modalPlanningFeedback || '';
      dom.modalPlannerFeedback.tabIndex = -1;
    }
  }

  function initializeModalPlanningState() {
    state.modalPlanningOpen = false;
    state.modalPlanningDay = plannerActions.getTodayDayKey();
    state.modalPlanningSlot = state.lastPlannerSlot || 'abend';
    state.modalPlanningFeedback = '';
  }

  function setModalPlanningOpen(open) {
    state.modalPlanningOpen = open;
    if (!open) {
      state.modalPlanningFeedback = state.modalPlanningFeedback || '';
    } else {
      state.modalPlanningFeedback = '';
    }
    syncModalPlanningUi();
  }

  function openRecipeModal(recipeId, options = {}) {
    const recipe = state.recipeLookup.get(String(recipeId)) || state.recipes.find((item) => item.id === String(recipeId));
    if (!recipe) return;
    state.currentModalRecipe = recipe;
    state.currentModalServings = normalizePositiveInteger(options.servings, recipe.baseServings);
    state.modalIngredientsExpanded = false;
    initializeModalPlanningState();
    modalRecipeController.render();
    modalController.open({
      trigger: options.trigger || document.activeElement,
    });
  }

  function closeRecipeModal({ restoreFocus = true } = {}) {
    state.modalPlanningOpen = false;
    state.modalPlanningFeedback = '';
    modalController.close({ restoreFocus });
  }

  function updateModalServings() {
    if (!state.currentModalRecipe) return;
    state.currentModalServings = normalizePositiveInteger(dom.modalServingsSelect.value, state.currentModalRecipe.baseServings);
    if (dom.modalPlannerServings) {
      dom.modalPlannerServings.value = String(state.currentModalServings);
    }
    modalRecipeController.render();
  }

  function editRecipeModal() {
    if (!state.currentModalRecipe || !state.latestAppData.capabilities?.canAdmin) return;
    const recipe = state.currentModalRecipe;
    closeRecipeModal({ restoreFocus: false });
    state.editingRecipeId = recipe.id;
    formController.prefillRecipeForm(recipe);
  }

  function askDelete(recipeId, trigger = null) {
    const recipe = state.recipeLookup.get(String(recipeId)) || state.recipes.find((item) => item.id === String(recipeId));
    if (!recipe) return;
    state.pendingDeleteId = recipe.id;
    dom.deleteConfirmName.textContent = `"${recipe.title}"`;
    deleteDialogController.open({
      trigger: trigger || document.activeElement,
    });
  }

  async function confirmDelete() {
    if (!state.pendingDeleteId) return;
    const recipeId = state.pendingDeleteId;
    const previousLabel = dom.confirmDeleteBtn.textContent;
    dom.confirmDeleteBtn.disabled = true;
    dom.confirmDeleteBtn.textContent = 'Loesche...';

    try {
      await dataController.waitForAppReady();
      const result = await deps.repository.deleteRecipe(recipeId);
      deleteDialogController.close();
      dataController.applyLoadResult(result);
    } catch (error) {
      notifications.error(`Loeschen fehlgeschlagen: ${error.message}`);
    } finally {
      dom.confirmDeleteBtn.disabled = false;
      dom.confirmDeleteBtn.textContent = previousLabel;
    }
  }

  function cancelDelete() {
    deleteDialogController.close();
  }

  async function saveModalPlannerEntry() {
    if (!state.currentModalRecipe) return;
    const day = DAYS.includes(dom.modalPlannerDay.value) ? dom.modalPlannerDay.value : plannerActions.getTodayDayKey();
    const slot = isValidMealSlot(dom.modalPlannerSlot.value) ? dom.modalPlannerSlot.value : (state.lastPlannerSlot || 'abend');
    const servings = normalizePositiveInteger(dom.modalPlannerServings.value, state.currentModalServings || state.currentModalRecipe.baseServings);
    state.modalPlanningFeedback = '';
    plannerActions.addToDay(day, state.currentModalRecipe.id, {
      slot,
      servings,
    });
    state.modalPlanningOpen = false;
    state.modalPlanningDay = day;
    state.modalPlanningSlot = slot;
    state.modalPlanningFeedback = `Für ${day} · ${getMealSlotLabel(slot)} · ${servings} P. eingeplant.`;
    focusManager.setPendingFocusTarget({ type: 'modal-planner-feedback' });
    announceUi(state.modalPlanningFeedback);
    modalRecipeController.render();
  }

  return {
    ensureModalPlanningDefaults,
    syncModalPlanningUi,
    initializeModalPlanningState,
    setModalPlanningOpen,
    openRecipeModal,
    closeRecipeModal,
    updateModalServings,
    editRecipeModal,
    askDelete,
    confirmDelete,
    cancelDelete,
    saveModalPlannerEntry,
  };
}
