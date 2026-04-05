import {
  compareTitles,
  formatDateLabel,
  formatLastCooked,
  getCookedTimestamp,
  isSameCalendarDay,
  isValidDateString,
  normalizeTagForSearch,
  scaleIngredient,
} from '../cookbook-schema.js';
import { escapeAttribute, escapeHtml } from './view-helpers.js';

function getTagColorClass(tag) {
  const lower = tag.toLowerCase();
  if (['orientalisch', 'mezze', 'arabisch', 'levantinisch', 'tuerkisch', 'persisch'].includes(lower)) return ' tag-saffron';
  if (['vegan', 'vegetarisch', 'gesund'].includes(lower)) return ' tag-emerald';
  if (['schnell', 'einfach', 'simpel', 'unter 30 min'].includes(lower)) return ' tag-copper';
  return '';
}

function getMainCategory(recipe) {
  return (recipe.tags && recipe.tags[0]) || '';
}

function formatTime(recipe) {
  const prep = Number.parseInt(recipe.prepTime, 10) || 0;
  const cook = Number.parseInt(recipe.cookTime, 10) || 0;
  const total = prep + cook;
  if (!total) return '';
  return `${total} Min`;
}

export function getFilteredSortedRecipes({
  recipes,
  query,
  activeTagFilter,
  favoriteFilterActive,
  sort,
}) {
  const normalizedQuery = String(query || '').toLowerCase().trim();
  const fuzzyQuery = normalizedQuery ? normalizeTagForSearch(normalizedQuery) : '';

  const list = recipes.filter((recipe) => {
    if (normalizedQuery) {
      const inTitle = recipe.title.toLowerCase().includes(normalizedQuery)
        || normalizeTagForSearch(recipe.title).includes(fuzzyQuery);
      const inDescription = (recipe.description || '').toLowerCase().includes(normalizedQuery);
      const inIngredients = (recipe.rawIngredients || '').toLowerCase().includes(normalizedQuery);
      const inTags = (recipe.tags || []).some((tag) => tag.toLowerCase().includes(normalizedQuery)
        || normalizeTagForSearch(tag).includes(fuzzyQuery));
      const inInstructions = (recipe.instructions || '').toLowerCase().includes(normalizedQuery);
      if (!inTitle && !inDescription && !inIngredients && !inTags && !inInstructions) {
        return false;
      }
    }

    const tagFilters = Array.isArray(activeTagFilter) ? activeTagFilter : (activeTagFilter ? [activeTagFilter] : []);
    if (tagFilters.length > 0) {
      const recipeTags = (recipe.tags || []).map((t) => t.toLowerCase());
      const recipeTagsNormalized = (recipe.tags || []).map((t) => normalizeTagForSearch(t));
      const allMatch = tagFilters.every((f) => recipeTags.includes(f.toLowerCase())
        || recipeTagsNormalized.includes(normalizeTagForSearch(f)));
      if (!allMatch) return false;
    }

    if (favoriteFilterActive && !recipe.favorite) {
      return false;
    }

    return true;
  });

  list.sort((a, b) => {
    if (sort === 'az') return compareTitles(a, b);
    if (sort === 'za') return compareTitles(b, a);
    if (sort === 'category') {
      const categoryCompare = getMainCategory(a).localeCompare(getMainCategory(b), 'de', { sensitivity: 'base' });
      return categoryCompare !== 0 ? categoryCompare : compareTitles(a, b);
    }
    if (sort === 'recent') {
      const cookedCompare = getCookedTimestamp(b) - getCookedTimestamp(a);
      if (cookedCompare !== 0) return cookedCompare;
      return compareTitles(a, b);
    }
    if (sort === 'favorites') {
      const favoriteCompare = Number(b.favorite) - Number(a.favorite);
      if (favoriteCompare !== 0) return favoriteCompare;
      return compareTitles(a, b);
    }
    if (sort === 'time') {
      const timeA = (a.prepTime || 0) + (a.cookTime || 0);
      const timeB = (b.prepTime || 0) + (b.cookTime || 0);
      if (timeA === 0 && timeB === 0) return compareTitles(a, b);
      if (timeA === 0) return 1;
      if (timeB === 0) return -1;
      return timeA - timeB;
    }
    const createdA = new Date(a.createdAt || 0).getTime();
    const createdB = new Date(b.createdAt || 0).getTime();
    if (sort === 'oldest') return createdA - createdB;
    return createdB - createdA;
  });

  return list;
}

export function renderRecipeGrid({
  recipeGrid,
  recipeCount,
  recipes,
  filteredRecipes,
  activeTagFilter,
  query,
  favoriteFilterActive,
  canAdmin,
}) {
  recipeCount.textContent = filteredRecipes.length === recipes.length
    ? `${recipes.length} Rezept${recipes.length !== 1 ? 'e' : ''}`
    : `${filteredRecipes.length} von ${recipes.length} Rezepten`;

  if (!filteredRecipes.length) {
    const hasActiveFilters = Boolean(String(query || '').trim() || (Array.isArray(activeTagFilter) ? activeTagFilter.length : activeTagFilter) || favoriteFilterActive);
    recipeGrid.innerHTML = recipes.length === 0 && !hasActiveFilters
      ? `<section class="empty-start">
          <div class="empty-start-copy">
            <h2>Dein Kochbuch beginnt hier</h2>
            <p>Starte mit einem ersten Rezept, halte Mengen sauber fest und baue dir nach und nach eine Sammlung auf, die sich auch im Alltag schnell benutzen laesst.</p>
          </div>
          <div class="empty-start-actions">
            ${canAdmin ? '<button type="button" class="btn-primary" data-action="open-form">Erstes Rezept anlegen</button>' : ''}
            ${canAdmin ? '<button type="button" class="btn-ghost" data-action="open-import">Rezepte importieren</button>' : ''}
          </div>
          <div class="empty-start-steps">
            <div class="empty-step">
              <strong>1. Titel und Tags</strong>
              <p>So benennst du Rezepte so, wie du spaeter wirklich danach suchen wuerdest.</p>
            </div>
            <div class="empty-step">
              <strong>2. Zutaten pro Zeile</strong>
              <p>Das macht Skalierung und Einkaufsliste verlaesslich, statt nur dekorativ.</p>
            </div>
            <div class="empty-step">
              <strong>3. Planner nutzen</strong>
              <p>Rezepte lassen sich fuer konkrete Portionen und Mahlzeiten-Slots in die Woche legen.</p>
            </div>
          </div>
        </section>`
      : `<div class="empty-state">${favoriteFilterActive
          ? 'Noch keine Favoriten — tippe auf das Herz bei einem Rezept.'
          : (Array.isArray(activeTagFilter) ? activeTagFilter.length : activeTagFilter)
            ? 'Keine Rezepte mit diesem Tag.'
            : String(query || '').trim()
              ? 'Kein Rezept gefunden — versuche andere Stichworte.'
              : 'Keine Rezepte gefunden.'}</div>`;
    return;
  }

  recipeGrid.innerHTML = filteredRecipes.map((recipe, index) => {
    const cardFilters = Array.isArray(activeTagFilter) ? activeTagFilter : (activeTagFilter ? [activeTagFilter] : []);
    const tagsHtml = (recipe.tags || []).map((tag) => {
      const isTagActive = cardFilters.some((f) => f.toLowerCase() === tag.toLowerCase());
      return `
      <button type="button" class="tag${getTagColorClass(tag)}${isTagActive ? ' active' : ''}"
        data-action="filter-tag" data-tag="${encodeURIComponent(tag)}" aria-pressed="${String(isTagActive)}">${escapeHtml(tag)}</button>
    `;
    }).join('');

    const metaItems = [];
    const timeLabel = formatTime(recipe);
    if (timeLabel) metaItems.push(`<span class="meta-item"><span class="meta-icon">◷</span>${escapeHtml(timeLabel)}</span>`);
    metaItems.push(`<span class="meta-item">${recipe.baseServings} Pers.</span>`);
    if (recipe.lastCookedAt) metaItems.push(`<span class="meta-item">${escapeHtml(formatLastCooked(recipe, 'short'))}</span>`);

    const imageHtml = recipe.imageUrl
      ? `<img class="card-image" src="${escapeAttribute(recipe.imageUrl)}" alt="${escapeAttribute(recipe.title)}" loading="lazy" onerror="this.style.display='none'">`
      : '<div class="card-image-placeholder"><svg viewBox="0 0 80 80" width="56" height="56" fill="none" stroke="#C9A84C" stroke-width="0.8" opacity="0.4"><polygon points="40,8 47,25 64,16 55,33 72,40 55,47 64,64 47,55 40,72 33,55 16,64 25,47 8,40 25,33 16,16 33,25"/><circle cx="40" cy="40" r="14"/><circle cx="40" cy="40" r="8"/></svg></div>';

    return `
      <article class="recipe-card" style="animation-delay: ${index * 0.08}s">
        <button type="button" class="recipe-card-main" data-action="open-recipe" data-recipe-id="${recipe.id}" aria-label="Rezept ${escapeAttribute(recipe.title)} öffnen">
          ${imageHtml}
          <div class="card-body">
            <div class="card-title">${escapeHtml(recipe.title)}</div>
            <div class="card-meta">${metaItems.join('')}</div>
            ${recipe.description ? `<p class="card-description">${escapeHtml(recipe.description)}</p>` : ''}
          </div>
        </button>
        <div class="card-footer">
          <div class="card-tags">${tagsHtml}</div>
          <div class="card-actions">
            <button type="button" class="icon-btn favorite-btn${recipe.favorite ? ' active' : ''}" data-action="toggle-favorite" data-recipe-id="${recipe.id}" data-favorite-surface="grid" data-focus-key="favorite-${escapeAttribute(recipe.id)}" aria-pressed="${String(recipe.favorite)}" aria-label="${recipe.favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">${recipe.favorite ? '♥' : '♡'}</button>
            ${canAdmin ? `<button type="button" class="icon-btn delete-btn" data-action="delete-recipe" data-recipe-id="${recipe.id}" aria-label="Rezept ${escapeAttribute(recipe.title)} löschen">✕</button>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

export function renderRecipeModalContent({
  recipe,
  displayServings,
  canAdmin,
  elements,
  renderServingOptions,
}) {
  if (!recipe) return;

  const {
    modalImage,
    modalTitle,
    modalDate,
    modalHeaderMeta,
    modalFavoriteBtn,
    modalCookedBtn,
    modalCookedStatus,
    modalServingsSelect,
    modalEditBtn,
    modalDescription,
    modalIngredients,
    modalInstructions,
    modalPlating,
    modalTips,
    descriptionSection,
    platingWrapper,
    tipsSection,
  } = elements;

  if (recipe.imageUrl) {
    modalImage.src = recipe.imageUrl;
    modalImage.style.display = 'block';
  } else {
    modalImage.style.display = 'none';
  }

  modalTitle.textContent = recipe.title;
  modalDate.textContent = recipe.createdAtLabel || formatDateLabel(recipe.createdAt);

  const metaParts = [];
  (recipe.tags || []).forEach((tag) => {
    metaParts.push(`<span class="modal-tag">${escapeHtml(tag)}</span>`);
  });
  const prep = Number.parseInt(recipe.prepTime, 10) || 0;
  const cook = Number.parseInt(recipe.cookTime, 10) || 0;
  if (prep || cook) {
    let timeLabel = '';
    if (prep && cook) timeLabel = `${prep} Min Vorbereitung · ${cook} Min Kochen`;
    else if (prep) timeLabel = `${prep} Min Vorbereitung`;
    else timeLabel = `${cook} Min Kochen`;
    metaParts.push(`<span class="modal-meta-item">◷ ${timeLabel}</span>`);
  }
  modalHeaderMeta.innerHTML = metaParts.join('');

  modalFavoriteBtn.textContent = recipe.favorite ? '♥' : '♡';
  modalFavoriteBtn.classList.toggle('active', recipe.favorite);
  modalFavoriteBtn.setAttribute('aria-pressed', String(recipe.favorite));
  modalFavoriteBtn.setAttribute('aria-label', recipe.favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen');
  modalCookedBtn.classList.toggle('active', isValidDateString(recipe.lastCookedAt) && isSameCalendarDay(new Date(recipe.lastCookedAt), new Date()));
  modalCookedStatus.textContent = formatLastCooked(recipe, 'long');
  modalServingsSelect.innerHTML = renderServingOptions(displayServings);
  modalServingsSelect.value = String(displayServings);
  modalEditBtn.style.display = canAdmin ? '' : 'none';

  if (recipe.description) {
    descriptionSection.style.display = 'block';
    modalDescription.textContent = recipe.description;
  } else {
    descriptionSection.style.display = 'none';
  }

  let ingredientHtml = '';
  if (recipe.parsedIngredients?.length) {
    ingredientHtml = recipe.parsedIngredients.map((ingredient) => `
      <div class="ingredient-item"><span class="ingredient-bullet">✧</span><span>${escapeHtml(scaleIngredient(ingredient, recipe.baseServings, displayServings))}</span></div>
    `).join('');
  } else if (recipe.rawIngredients) {
    ingredientHtml = recipe.rawIngredients.split('\n').filter(Boolean).map((line) => `
      <div class="ingredient-item"><span class="ingredient-bullet">✧</span><span>${escapeHtml(line.trim())}</span></div>
    `).join('');
  }
  modalIngredients.innerHTML = ingredientHtml;
  modalInstructions.textContent = recipe.instructions || '';

  if (recipe.plating) {
    platingWrapper.style.display = 'block';
    modalPlating.textContent = recipe.plating;
  } else {
    platingWrapper.style.display = 'none';
  }

  if (recipe.tips) {
    tipsSection.style.display = 'block';
    modalTips.textContent = recipe.tips;
  } else {
    tipsSection.style.display = 'none';
  }
}

function buildSkeletonCard() {
  return `
    <div class="recipe-card recipe-card--skeleton" aria-hidden="true">
      <div class="skeleton-image"></div>
      <div class="card-body" style="padding: 12px 14px 10px;">
        <div class="skeleton-title"></div>
        <div class="skeleton-meta" style="margin-top: 8px;"></div>
      </div>
    </div>
  `;
}

export function renderSkeletonRecipes(container, count = 8) {
  container.innerHTML = Array.from({ length: count }, buildSkeletonCard).join('');
}
