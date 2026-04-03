import {
  getFilteredSortedRecipes,
  renderRecipeGrid,
} from './recipes-view.js';

export function createRecipesController({
  state,
  elements,
  getCanAdmin,
  modalController,
  modalRecipeController,
  restorePendingFocusTarget,
}) {
  function updateFavoriteFilterButton() {
    elements.toggleFavoritesBtn.classList.toggle('active', state.favoriteFilterActive);
    elements.toggleFavoritesBtn.setAttribute('aria-pressed', String(state.favoriteFilterActive));
  }

  function updateTagFilterPill() {
    elements.tagFilterPill.classList.toggle('visible', Boolean(state.activeTagFilter));
    if (state.activeTagFilter) {
      elements.tagFilterLabel.textContent = state.activeTagFilter;
    }
  }

  function buildFilteredRecipes() {
    return getFilteredSortedRecipes({
      recipes: state.recipes,
      query: elements.searchInput.value,
      activeTagFilter: state.activeTagFilter,
      favoriteFilterActive: state.favoriteFilterActive,
      sort: elements.sortSelect.value,
    });
  }

  function renderGrid() {
    updateFavoriteFilterButton();
    updateTagFilterPill();

    renderRecipeGrid({
      recipeGrid: elements.recipeGrid,
      recipeCount: elements.recipeCount,
      recipes: state.recipes,
      filteredRecipes: buildFilteredRecipes(),
      activeTagFilter: state.activeTagFilter,
      query: elements.searchInput.value,
      favoriteFilterActive: state.favoriteFilterActive,
      canAdmin: getCanAdmin(),
    });

    if (modalController.isOpen()) {
      modalRecipeController.render();
    }

    restorePendingFocusTarget();
  }

  function render() {
    renderGrid();
  }

  return {
    buildFilteredRecipes,
    renderGrid,
    render,
  };
}
