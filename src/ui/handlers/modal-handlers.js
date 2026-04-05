export function createModalHandlers(deps) {
  const {
    state,
    modalFavoriteBtn,
    modalPlannerDay,
    recipeModal,
    repository,
    applyLoadResult,
    refreshAppData,
    closeRecipeModal,
    toggleFavoriteWithEffect,
    setPendingFocusTarget,
    announceUi,
    renderRecipeModal,
    editRecipeModal,
    syncModalPlanningUi,
    restorePendingFocusTarget,
    saveModalPlannerEntry,
    normalizePositiveInteger,
    isValidMealSlot,
  } = deps;

  return {
    onCloseModal() {
      closeRecipeModal();
    },

    async onToggleModalFavorite() {
      if (!state.currentModalRecipe) return;
      await toggleFavoriteWithEffect({
        recipeId: state.currentModalRecipe.id,
        anchor: modalFavoriteBtn,
        surface: 'modal',
      });
    },

    async onModalCooked() {
      if (!state.currentModalRecipe) return;
      setPendingFocusTarget({ selector: '#modalCookedBtn' });
      const result = await repository.markRecipeCooked(state.currentModalRecipe.id);
      announceUi('Heute gekocht markiert');
      if (typeof applyLoadResult === 'function') {
        applyLoadResult(result, { scope: 'recipes' });
      } else {
        await refreshAppData({ silent: true });
        renderRecipeModal();
      }
    },

    onEditModal() {
      editRecipeModal();
    },

    onModalServingsChange() {
      deps.updateModalServings();
    },

    onToggleModalPlanner() {
      state.modalPlanningOpen = !state.modalPlanningOpen;
      if (state.modalPlanningOpen) {
        state.modalPlanningFeedback = '';
      }
      syncModalPlanningUi();
      if (state.modalPlanningOpen) {
        modalPlannerDay?.focus();
      } else {
        setPendingFocusTarget({ type: 'modal-planner-toggle' });
        restorePendingFocusTarget();
      }
    },

    async onSaveModalPlanner() {
      await saveModalPlannerEntry();
    },

    onCancelModalPlanner() {
      state.modalPlanningOpen = false;
      syncModalPlanningUi();
      setPendingFocusTarget({ type: 'modal-planner-toggle' });
      restorePendingFocusTarget();
    },

    onModalPlannerDayChange(event) {
      state.modalPlanningDay = event.target.value;
    },

    onModalPlannerSlotChange(event) {
      state.modalPlanningSlot = isValidMealSlot(event.target.value) ? event.target.value : 'abend';
    },

    onModalPlannerServingsChange(event) {
      event.target.value = String(normalizePositiveInteger(event.target.value, state.currentModalServings || 2));
    },

    onModalOverlayClick(event) {
      if (event.target === recipeModal) {
        closeRecipeModal();
      }
    },
  };
}
