import { getPlannerStats } from '../cookbook-schema.js';
import {
  getFilteredSortedRecipes,
  renderCollectionSummary,
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

  function renderSummary() {
    renderCollectionSummary({
      collectionSummary: elements.collectionSummary,
      recipes: state.recipes,
      weekPlan: state.weekPlan,
    });

    const plannerStats = getPlannerStats(state.weekPlan, state.recipes);
    elements.summaryFeaturePlannerValue.textContent = String(plannerStats.entries);
    elements.summaryFeatureFavoriteValue.textContent = String(state.recipes.filter((recipe) => recipe.favorite).length);
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
    renderSummary();
    renderGrid();
  }

  return {
    buildFilteredRecipes,
    renderSummary,
    renderGrid,
    render,
  };
}
