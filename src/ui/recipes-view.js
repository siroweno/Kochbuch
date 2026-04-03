import {
  compareTitles,
  formatDateLabel,
  formatLastCooked,
  getCookedTimestamp,
  getPlannerStats,
  isSameCalendarDay,
  isValidDateString,
  scaleIngredient,
} from '../cookbook-schema.js';
import { escapeAttribute, escapeHtml } from './view-helpers.js';

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

  const list = recipes.filter((recipe) => {
    if (normalizedQuery) {
      const inTitle = recipe.title.toLowerCase().includes(normalizedQuery);
      const inDescription = (recipe.description || '').toLowerCase().includes(normalizedQuery);
      const inIngredients = (recipe.rawIngredients || '').toLowerCase().includes(normalizedQuery);
      const inTags = (recipe.tags || []).some((tag) => tag.toLowerCase().includes(normalizedQuery));
      const inInstructions = (recipe.instructions || '').toLowerCase().includes(normalizedQuery);
      if (!inTitle && !inDescription && !inIngredients && !inTags && !inInstructions) {
        return false;
      }
    }

    if (activeTagFilter && !(recipe.tags || []).some((tag) => tag.toLowerCase() === activeTagFilter.toLowerCase())) {
      return false;
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

export function renderCollectionSummary({ collectionSummary, recipes, weekPlan }) {
  const totalRecipes = recipes.length;
  const favoriteRecipes = recipes.filter((recipe) => recipe.favorite).length;
  const cookedRecipes = recipes.filter((recipe) => recipe.lastCookedAt).length;
  const plannerStats = getPlannerStats(weekPlan, recipes);
  const readyToCook = recipes.filter((recipe) => recipe.favorite || recipe.lastCookedAt).length;
  const plannedFavorites = plannerStats.favoriteEntries;

  collectionSummary.innerHTML = `
    <article class="summary-card summary-card--lead">
      <div class="summary-card-kicker">Kochbuch auf einen Blick</div>
      <div class="summary-card-value">${totalRecipes}</div>
      <p>${totalRecipes
        ? `Die Sammlung ist lebendig: ${favoriteRecipes} Favoriten, ${plannerStats.entries} geplante Mahlzeiten und ${cookedRecipes} Rezepte mit Kochspur.`
        : 'Lege dein erstes Rezept an oder importiere eine vorhandene Sammlung, damit hier schnell Leben reinkommt.'}
      </p>
      <div class="summary-card-meta">
        <span>${readyToCook ? `${readyToCook} Rezepte sind sofort alltagstauglich` : 'Favoriten markieren die ersten Alltagshilfen'}</span>
        <span>${plannerStats.plannedDays ? `${plannerStats.plannedDays} Tage sind schon belegt` : 'Der Wochenplan wartet noch auf den ersten Eintrag'}</span>
      </div>
    </article>
    <div class="summary-card summary-card--support">
      <strong>Favoriten</strong>
      <div class="summary-card-value">${favoriteRecipes}</div>
      <p>${favoriteRecipes
        ? `${plannedFavorites} Eintraege davon stehen bereits im Wochenplan und bleiben dadurch nah an deinem Alltag.`
        : 'Markiere alltagstaugliche Rezepte mit dem Herz, damit sie fuer Planung und Suche weiter oben stehen.'}
      </p>
    </div>
    <div class="summary-card summary-card--support">
      <strong>Wochenplan</strong>
      <div class="summary-card-value">${plannerStats.entries}</div>
      <p>${plannerStats.entries
        ? `${plannerStats.plannedDays} Tage sind belegt, ${plannerStats.uniqueRecipes} verschiedene Rezepte sind im Umlauf.`
        : 'Plane Mahlzeiten mit Portionen und Slot direkt in die Woche ein.'}
      </p>
    </div>
    <div class="summary-card summary-card--support">
      <strong>Zuletzt gekocht</strong>
      <div class="summary-card-value">${cookedRecipes}</div>
      <p>${cookedRecipes
        ? 'Zuletzt gekochte Rezepte tauchen in Karte, Sortierung und Picker wieder oben auf.'
        : 'Markiere im Modal oder Planner, was du heute gekocht hast.'}
      </p>
    </div>
  `;
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
    const hasActiveFilters = Boolean(String(query || '').trim() || activeTagFilter || favoriteFilterActive);
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
      : `<div class="empty-state">${hasActiveFilters ? 'Keine Rezepte passen zu Suche oder Filtern.' : 'Keine Rezepte gefunden.'}</div>`;
    return;
  }

  recipeGrid.innerHTML = filteredRecipes.map((recipe) => {
    const tagsHtml = (recipe.tags || []).map((tag) => `
      <button type="button" class="tag${activeTagFilter && tag.toLowerCase() === activeTagFilter.toLowerCase() ? ' active' : ''}"
        data-action="filter-tag" data-tag="${encodeURIComponent(tag)}" aria-pressed="${String(activeTagFilter && tag.toLowerCase() === activeTagFilter.toLowerCase())}">${escapeHtml(tag)}</button>
    `).join('');

    const metaItems = [];
    const timeLabel = formatTime(recipe);
    if (timeLabel) metaItems.push(`<span class="meta-item"><span class="meta-icon">◷</span>${timeLabel}</span>`);
    metaItems.push(`<span class="meta-item">${recipe.baseServings} Pers.</span>`);
    if (recipe.lastCookedAt) metaItems.push(`<span class="meta-item">${escapeHtml(formatLastCooked(recipe, 'short'))}</span>`);

    const imageHtml = recipe.imageUrl
      ? `<img class="card-image" src="${escapeAttribute(recipe.imageUrl)}" alt="${escapeAttribute(recipe.title)}" loading="lazy" onerror="this.style.display='none'">`
      : '<div class="card-image-placeholder">✦</div>';

    return `
      <article class="recipe-card">
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
      <div class="ingredient-item"><span class="ingredient-bullet">•</span><span>${escapeHtml(scaleIngredient(ingredient, recipe.baseServings, displayServings))}</span></div>
    `).join('');
  } else if (recipe.rawIngredients) {
    ingredientHtml = recipe.rawIngredients.split('\n').filter(Boolean).map((line) => `
      <div class="ingredient-item"><span class="ingredient-bullet">•</span><span>${escapeHtml(line.trim())}</span></div>
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
