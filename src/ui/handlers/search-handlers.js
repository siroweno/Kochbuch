export function createSearchHandlers(deps) {
  const {
    renderRecipes,
    toggleFavoritesFilter,
    clearTagFilter,
  } = deps;

  return {
    onSearchInput() {
      renderRecipes();
    },

    onSortChange() {
      renderRecipes();
    },

    onToggleFavoritesFilter() {
      toggleFavoritesFilter();
    },

    onClearTagFilter() {
      clearTagFilter();
    },
  };
}
