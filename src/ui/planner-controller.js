import {
  buildShoppingListText,
  renderWeekPlanner,
} from './planner-view.js';

export function createPlannerController({
  state,
  elements,
  getActiveWeekPlan,
  renderServingOptions,
  renderMealSlotOptions,
  restorePendingFocusTarget,
}) {
  function render() {
    renderWeekPlanner({
      daysGrid: elements.daysGrid,
      plannerSummary: elements.plannerSummary,
      weekPlan: getActiveWeekPlan(),
      recipes: state.recipes,
      recipeById: state.recipeLookup,
      activeDayPicker: state.activeDayPicker,
      activeDayPickerSlot: state.activeDayPickerSlot,
      activeDayPickerQuery: state.activeDayPickerQuery,
      activeMoveEntryId: state.activeMoveEntryId,
      moveEntryDraftDay: state.moveEntryDraftDay,
      moveEntryDraftSlot: state.moveEntryDraftSlot,
      dragState: state.dragState,
      renderServingOptions,
      renderMealSlotOptions,
    });
    restorePendingFocusTarget();
  }

  function updateShoppingList() {
    state.fullShoppingList = buildShoppingListText({
      weekPlan: state.weekPlan,
      recipes: state.recipes,
      recipeById: state.recipeLookup,
    });
    elements.shoppingList.textContent = state.fullShoppingList || '';
    elements.shoppingSearchInput.value = '';
  }

  function refresh() {
    if (!state.plannerOpen) return;
    render();
    updateShoppingList();
  }

  return {
    render,
    refresh,
    updateShoppingList,
  };
}
