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
      weekPlan: getActiveWeekPlan(),
      recipes: state.recipes,
      recipeById: state.recipeLookup,
      activePlannerDay: state.activePlannerDay,
      activeDayPicker: state.activeDayPicker,
      activeDayPickerSlot: state.activeDayPickerSlot,
      activeDayPickerQuery: state.activeDayPickerQuery,
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
