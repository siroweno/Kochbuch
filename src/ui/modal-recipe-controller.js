import { renderRecipeModalContent } from './recipes-view.js';

export function createModalRecipeController({
  state,
  elements,
  getCanAdmin,
  renderServingOptions,
  syncModalPlanningUi,
  syncIngredientsToggleUi,
  restorePendingFocusTarget,
}) {
  function render() {
    if (!state.currentModalRecipe) return;

    const currentRecipe = state.recipeLookup.get(String(state.currentModalRecipe.id)) || state.currentModalRecipe;
    state.currentModalRecipe = currentRecipe;

    renderRecipeModalContent({
      recipe: currentRecipe,
      displayServings: state.currentModalServings || currentRecipe.baseServings,
      canAdmin: getCanAdmin(),
      renderServingOptions,
      elements,
    });

    syncIngredientsToggleUi();
    syncModalPlanningUi();
    restorePendingFocusTarget();
  }

  return {
    render,
  };
}
