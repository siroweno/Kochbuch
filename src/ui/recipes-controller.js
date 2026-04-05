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
    if (elements.topBarFavoritesBtn) {
      elements.topBarFavoritesBtn.classList.toggle('active', state.favoriteFilterActive);
      elements.topBarFavoritesBtn.setAttribute('aria-pressed', String(state.favoriteFilterActive));
      elements.topBarFavoritesBtn.innerHTML = state.favoriteFilterActive ? '&#9829;' : '&#9825;';
    }
  }

  function updateTagFilterPill() {
    const filters = Array.isArray(state.activeTagFilter) ? state.activeTagFilter : (state.activeTagFilter ? [state.activeTagFilter] : []);
    elements.tagFilterPill.classList.toggle('visible', filters.length > 0);
    if (filters.length > 0) {
      elements.tagFilterLabel.textContent = filters.join(', ');
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

  function renderGrid({ scope = 'full' } = {}) {
    if (scope === 'full' || scope === 'filters') {
      updateFavoriteFilterButton();
      updateTagFilterPill();
    }

    if (scope === 'full' || scope === 'grid' || scope === 'filters') {
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
    }

    if (scope === 'full' || scope === 'modal') {
      if (modalController.isOpen()) {
        modalRecipeController.render();
      }
    }

    restorePendingFocusTarget();
  }

  function render(options) {
    renderGrid(options);
  }

  return {
    buildFilteredRecipes,
    renderGrid,
    render,
  };
}
