import { normalizeTagForSearch } from '../cookbook-schema.js';

export function createTagBarController(deps) {
  const { state, dom, recipesController } = deps;

  function renderTagBar() {
    if (!dom.tagBarList) return;
    const tagCounts = new Map();
    state.recipes.forEach((recipe) => {
      (recipe.tags || []).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      });
    });
    const sorted = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0]);
    const isExpanded = dom.tagBar.classList.contains('expanded');
    const displayTags = isExpanded ? sorted : sorted.slice(0, 10);
    const filters = Array.isArray(state.activeTagFilter) ? state.activeTagFilter : (state.activeTagFilter ? [state.activeTagFilter] : []);
    dom.tagBarList.innerHTML = displayTags.map((tag) => {
      const isActive = filters.some((f) => f.toLowerCase() === tag.toLowerCase()
        || normalizeTagForSearch(f) === normalizeTagForSearch(tag));
      return `<button type="button" class="tag${isActive ? ' active' : ''}" data-action="filter-tag" data-tag="${encodeURIComponent(tag)}" aria-pressed="${String(Boolean(isActive))}">${tag}</button>`;
    }).join('');
    if (dom.tagBarExpand) {
      dom.tagBarExpand.textContent = isExpanded ? 'Weniger' : 'Alle Tags';
      dom.tagBarExpand.style.display = sorted.length > 10 ? '' : 'none';
    }
  }

  function clearTagFilter() {
    state.activeTagFilter = [];
    renderTagBar();
    recipesController.render();
  }

  function setTagFilter(tag) {
    const current = Array.isArray(state.activeTagFilter) ? state.activeTagFilter : (state.activeTagFilter ? [state.activeTagFilter] : []);
    const index = current.findIndex((f) => f.toLowerCase() === tag.toLowerCase());
    if (index >= 0) {
      const next = [...current];
      next.splice(index, 1);
      state.activeTagFilter = next;
    } else {
      state.activeTagFilter = [...current, tag];
    }
    renderTagBar();
    recipesController.render();
  }

  function toggleFavoritesFilter() {
    state.favoriteFilterActive = !state.favoriteFilterActive;
    recipesController.render();
  }

  return { renderTagBar, clearTagFilter, setTagFilter, toggleFavoritesFilter };
}
