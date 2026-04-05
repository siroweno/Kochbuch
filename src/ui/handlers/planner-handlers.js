export function createPlannerHandlers(deps) {
  const {
    state,
    shoppingList,
    setPlannerOpen,
    renderPlanner,
    updatePlannerShoppingList,
    createEmptyWeekPlan,
    resetPlannerDraftState,
  } = deps;

  return {
    onTogglePlanner() {
      setPlannerOpen(!state.plannerOpen);
      if (state.plannerOpen) {
        renderPlanner();
        updatePlannerShoppingList();
      } else {
        state.activePlannerDay = null;
        state.activeDayPicker = null;
        state.activeDayPickerQuery = '';
        resetPlannerDraftState();
      }
    },

    onClearPlan() {
      if (!deps.DAYS.some((day) => (state.weekPlan[day] || []).length > 0)) return;
      deps.clearPlanDialogController.open();
    },

    async onConfirmClearPlan() {
      state.weekPlan = createEmptyWeekPlan();
      state.activePlannerDay = null;
      resetPlannerDraftState();
      deps.clearPlanDialogController.close();
      await deps.persistWeekPlan();
    },

    onCancelClearPlan() {
      deps.clearPlanDialogController.close();
    },

    onShoppingSearch(event) {
      const query = event.target.value.toLowerCase();
      if (!query) {
        shoppingList.textContent = state.fullShoppingList;
        return;
      }
      const filtered = state.fullShoppingList.split('\n').filter((line) => line.toLowerCase().includes(query)).join('\n');
      shoppingList.textContent = filtered || '(Keine Treffer)';
    },

    onExportShopping() {
      const text = shoppingList.textContent;
      if (!text.trim()) return;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `einkaufsliste_${new Date().toISOString().split('T')[0]}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
    },
  };
}
