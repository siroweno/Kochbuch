import { getAppConfig } from './app-config.js';
import { createAuthService } from './auth.js';
import { createCookbookRepository } from './repository.js';
import {
  DAYS,
  MEAL_SLOTS,
  SERVING_OPTIONS,
  compareTitles,
  createEmptyWeekPlan,
  formatDateLabel,
  formatLastCooked,
  getCookedTimestamp,
  getMealSlotLabel,
  getPlannerStats,
  isDataUrl,
  isExternalImageUrl,
  isSameCalendarDay,
  isValidDateString,
  isValidMealSlot,
  normalizeMultilineText,
  normalizeTags,
  parseIngredientsText,
  readLegacyLocalSnapshot,
  renderMealSlotOptions,
  scaleIngredient,
} from './cookbook-schema.js';

const config = getAppConfig();
const authService = createAuthService(config);
const repository = createCookbookRepository({ config, authService });

let recipes = [];
let weekPlan = createEmptyWeekPlan();
let currentModalRecipe = null;
let currentModalServings = null;
let editingRecipeId = null;
let activeTagFilter = null;
let favoriteFilterActive = false;
let pendingDeleteId = null;
let activeDayPicker = null;
let activeDayPickerSlot = 'abend';
let fullShoppingList = '';
let lastModalTrigger = null;
let lastDeleteTrigger = null;
let latestAuthSnapshot = authService.getSnapshot();
let latestAppData = {
  recipes: [],
  weekPlan: createEmptyWeekPlan(),
  capabilities: { canAdmin: false },
  migration: { hasLegacyData: false, alreadyMigrated: false },
};
let pendingImageUpload = null;
let inflightRefreshPromise = null;

const authBar = document.getElementById('authBar');
const authBarName = document.getElementById('authBarName');
const authBarMeta = document.getElementById('authBarMeta');
const signOutBtn = document.getElementById('signOutBtn');
const loginPanel = document.getElementById('loginPanel');
const loginIntro = document.getElementById('loginIntro');
const googleLoginActions = document.getElementById('googleLoginActions');
const googleLoginBtn = document.getElementById('googleLoginBtn');
const browserTestLoginForm = document.getElementById('browserTestLoginForm');
const browserTestEmail = document.getElementById('browserTestEmail');
const loginMessage = document.getElementById('loginMessage');
const authHint = document.getElementById('authHint');
const loadingPanel = document.getElementById('loadingPanel');
const accessPanel = document.getElementById('accessPanel');
const accessMessage = document.getElementById('accessMessage');
const configPanel = document.getElementById('configPanel');
const appShell = document.getElementById('appShell');

const toggleFormBtn = document.getElementById('toggleFormBtn');
const toggleFavoritesBtn = document.getElementById('toggleFavoritesBtn');
const formContainer = document.getElementById('formContainer');
const recipeForm = document.getElementById('recipeForm');
const recipeGrid = document.getElementById('recipeGrid');
const collectionSummary = document.getElementById('collectionSummary');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const titleInput = document.getElementById('title');
const servingsInput = document.getElementById('servings');
const prepTimeInput = document.getElementById('prepTime');
const cookTimeInput = document.getElementById('cookTime');
const tagsInput = document.getElementById('tags');
const imageUrlInput = document.getElementById('imageUrl');
const imageFileInput = document.getElementById('imageFile');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const ingredientsInput = document.getElementById('ingredients');
const instructionsInput = document.getElementById('instructions');
const platingInput = document.getElementById('plating');
const tipsInput = document.getElementById('tips');
const descriptionInput = document.getElementById('description');
const exportBtn = document.getElementById('exportBtn');
const importBtn = document.getElementById('importBtn');
const migrateLocalBtn = document.getElementById('migrateLocalBtn');
const importFile = document.getElementById('importFile');
const uploadImageBtn = document.getElementById('uploadImageBtn');
const togglePlannerBtn = document.getElementById('togglePlannerBtn');
const weekPlanner = document.getElementById('weekPlanner');
const plannerSummary = document.getElementById('plannerSummary');
const daysGrid = document.getElementById('daysGrid');
const shoppingList = document.getElementById('shoppingList');
const shoppingSearchInput = document.getElementById('shoppingSearchInput');
const exportShoppingBtn = document.getElementById('exportShoppingBtn');
const clearPlanBtn = document.getElementById('clearPlanBtn');
const tagFilterPill = document.getElementById('tagFilterPill');
const tagFilterLabel = document.getElementById('tagFilterLabel');
const clearTagFilterBtn = document.getElementById('clearTagFilterBtn');
const recipeCount = document.getElementById('recipeCount');
const recipeModal = document.getElementById('recipeModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalFavoriteBtn = document.getElementById('modalFavoriteBtn');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalCookedBtn = document.getElementById('modalCookedBtn');
const modalCookedStatus = document.getElementById('modalCookedStatus');
const modalServingsSelect = document.getElementById('modalServings');
const deleteConfirm = document.getElementById('deleteConfirm');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

const REQUIRED_FIELDS = new Map([
  [titleInput, 'Bitte gib einen Rezeptnamen ein.'],
  [ingredientsInput, 'Bitte trage mindestens eine Zutat ein.'],
  [instructionsInput, 'Bitte trage eine Zubereitung ein.'],
]);

function escapeHtml(text) {
  const node = document.createElement('div');
  node.textContent = text;
  return node.innerHTML;
}

function escapeAttribute(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
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

function setVisible(element, visible, className = 'visible') {
  if (!element) return;
  if (className) {
    element.classList.toggle(className, visible);
  }
  element.style.display = visible ? '' : 'none';
}

function syncBodyScrollLock() {
  const shouldLock = recipeModal.classList.contains('visible') || deleteConfirm.classList.contains('visible');
  document.body.style.overflow = shouldLock ? 'hidden' : '';
}

function updateRequiredFieldValidity(input) {
  const message = REQUIRED_FIELDS.get(input);
  if (!message) return true;
  const hasContent = normalizeMultilineText(input.value).length > 0;
  input.setCustomValidity(hasContent ? '' : message);
  return hasContent;
}

function validateRecipeForm() {
  let firstInvalid = null;
  REQUIRED_FIELDS.forEach((_message, input) => {
    const valid = updateRequiredFieldValidity(input);
    if (!valid && !firstInvalid) {
      firstInvalid = input;
    }
  });
  if (firstInvalid) {
    firstInvalid.reportValidity();
    firstInvalid.focus();
    return false;
  }
  return true;
}

function applyRoleUi(canAdmin) {
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.classList.toggle('admin-hidden', !canAdmin);
  });
}

function renderAuthShell(snapshot) {
  latestAuthSnapshot = snapshot;

  authBar.classList.toggle('visible', snapshot.accessState === 'signed_in' || snapshot.accessState === 'no_access');
  authBarName.textContent = snapshot.sessionUser?.email || 'Nicht angemeldet';
  authBarMeta.textContent = snapshot.profile
    ? `${snapshot.profile.role === 'admin' ? 'Admin' : 'Reader'} · ${config.backend === 'browser-test' ? 'Browser-Test' : 'Supabase'}`
    : config.backend === 'browser-test' ? 'Browser-Test' : 'Supabase';
  loginMessage.textContent = snapshot.message || '';
  accessMessage.textContent = snapshot.message || 'Dein Profil konnte gerade nicht geladen werden.';
  loginIntro.textContent = config.backend === 'browser-test'
    ? 'Browser-Test-Modus: Gib eine beliebige Test-E-Mail ein. admin@kochbuch.local wird als Admin angemeldet, alle anderen als Reader.'
    : 'Melde dich mit Google an, um dein persönliches Kochbuch mit Favoriten und Wochenplan zu öffnen.';
  authHint.textContent = config.backend === 'browser-test'
    ? 'Dieser Test-Login ist nur lokal für Playwright und die Entwicklung sichtbar.'
    : 'Google ist der einzige sichtbare Login-Weg. Nach dem ersten Login bleibt deine Session auch auf mehreren Geräten parallel nutzbar.';
  setVisible(googleLoginActions, config.backend !== 'browser-test');
  setVisible(browserTestLoginForm, config.backend === 'browser-test');

  setVisible(loginPanel, snapshot.accessState === 'signed_out');
  setVisible(loadingPanel, snapshot.accessState === 'loading');
  setVisible(accessPanel, snapshot.accessState === 'no_access');
  setVisible(configPanel, snapshot.accessState === 'config_missing');
  appShell.classList.toggle('app-shell-hidden', snapshot.accessState !== 'signed_in');
  applyRoleUi(snapshot.canAdmin);
}

function applyLoadResult(result) {
  latestAppData = result;
  recipes = result.recipes || [];
  weekPlan = result.weekPlan || createEmptyWeekPlan();
  applyRoleUi(result.capabilities?.canAdmin);
  renderRecipes();
  refreshPlannerViews();
  migrateLocalBtn.style.display = result.capabilities?.canAdmin && result.migration?.hasLegacyData && !result.migration?.alreadyMigrated ? '' : 'none';
}

async function refreshAppData({ silent = false } = {}) {
  if (inflightRefreshPromise) {
    return inflightRefreshPromise;
  }

  inflightRefreshPromise = (async () => {
    if (!silent) {
      renderAuthShell({
        ...latestAuthSnapshot,
        accessState: latestAuthSnapshot.accessState === 'signed_in' ? 'loading' : latestAuthSnapshot.accessState,
      });
    }
    const result = await repository.loadAppData();
    renderAuthShell(authService.getSnapshot());
    applyLoadResult(result);
    return result;
  })();

  try {
    return await inflightRefreshPromise;
  } finally {
    inflightRefreshPromise = null;
  }
}

async function waitForAppReady() {
  if (!inflightRefreshPromise) return;

  try {
    await inflightRefreshPromise;
  } catch (_error) {
    // Callers surface their own action errors. We only want to wait for the current load to settle.
  }
}

async function resizeImage(file) {
  const rawDataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => resolve(event.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const maxWidth = 600;
      const maxHeight = 400;
      let width = image.width;
      let height = image.height;
      if (width > maxWidth) {
        height = Math.round(height * (maxWidth / width));
        width = maxWidth;
      }
      if (height > maxHeight) {
        width = Math.round(width * (maxHeight / height));
        height = maxHeight;
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(image, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.75));
    };
    image.src = rawDataUrl;
  });
}

function resetForm() {
  recipeForm.reset();
  servingsInput.value = '2';
  imagePreview.style.display = 'none';
  document.getElementById('formTitle').textContent = 'Neues Rezept';
  editingRecipeId = null;
  pendingImageUpload = null;
  REQUIRED_FIELDS.forEach((_message, input) => input.setCustomValidity(''));
}

function openRecipeForm() {
  if (!latestAppData.capabilities?.canAdmin) return;
  formContainer.classList.add('visible');
  toggleFormBtn.textContent = '✕ Abbrechen';
  titleInput.focus();
}

function closeRecipeForm() {
  formContainer.classList.remove('visible');
  toggleFormBtn.textContent = '+ Neues Rezept';
  resetForm();
}

function updateFavoriteFilterButton() {
  toggleFavoritesBtn.classList.toggle('active', favoriteFilterActive);
  toggleFavoritesBtn.setAttribute('aria-pressed', String(favoriteFilterActive));
}

function updateTagFilterPill() {
  tagFilterPill.classList.toggle('visible', Boolean(activeTagFilter));
  if (activeTagFilter) {
    tagFilterLabel.textContent = activeTagFilter;
  }
}

function setTagFilter(tag) {
  if (activeTagFilter === tag) {
    clearTagFilter();
    return;
  }
  activeTagFilter = tag;
  updateTagFilterPill();
  renderRecipes();
}

function clearTagFilter() {
  activeTagFilter = null;
  updateTagFilterPill();
  renderRecipes();
}

function toggleFavoritesFilter() {
  favoriteFilterActive = !favoriteFilterActive;
  updateFavoriteFilterButton();
  renderRecipes();
}

function getFilteredSorted() {
  const query = searchInput.value.toLowerCase().trim();
  const list = recipes.filter((recipe) => {
    if (query) {
      const inTitle = recipe.title.toLowerCase().includes(query);
      const inDescription = (recipe.description || '').toLowerCase().includes(query);
      const inIngredients = (recipe.rawIngredients || '').toLowerCase().includes(query);
      const inTags = (recipe.tags || []).some((tag) => tag.toLowerCase().includes(query));
      const inInstructions = (recipe.instructions || '').toLowerCase().includes(query);
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

  const sort = sortSelect.value;
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

function renderCollectionSummary() {
  const totalRecipes = recipes.length;
  const favoriteRecipes = recipes.filter((recipe) => recipe.favorite).length;
  const cookedRecipes = recipes.filter((recipe) => recipe.lastCookedAt).length;
  const plannerStats = getPlannerStats(weekPlan, recipes);

  collectionSummary.innerHTML = `
    <div class="summary-card">
      <strong>Rezepte im Regal</strong>
      <div class="summary-card-value">${totalRecipes}</div>
      <p>${totalRecipes ? 'Suche, Tags und Sortierung greifen ueber die ganze Sammlung.' : 'Lege dein erstes Rezept an oder importiere eine vorhandene Sammlung.'}</p>
    </div>
    <div class="summary-card">
      <strong>Favoriten</strong>
      <div class="summary-card-value">${favoriteRecipes}</div>
      <p>${favoriteRecipes ? 'Lieblingsrezepte lassen sich separat filtern und stehen im Picker weiter oben.' : 'Markiere alltagstaugliche Rezepte mit dem Herz fuer schnellere Planung.'}</p>
    </div>
    <div class="summary-card">
      <strong>Wochenplan</strong>
      <div class="summary-card-value">${plannerStats.entries}</div>
      <p>${plannerStats.entries ? `${plannerStats.plannedDays} Tage sind belegt, ${plannerStats.favoriteEntries} Eintraege davon sind Favoriten.` : 'Plane Mahlzeiten mit Portionen und Slot direkt in die Woche ein.'}</p>
    </div>
    <div class="summary-card">
      <strong>Schon gekocht</strong>
      <div class="summary-card-value">${cookedRecipes}</div>
      <p>${cookedRecipes ? 'Zuletzt gekochte Rezepte tauchen in Karte, Sortierung und Picker direkt wieder auf.' : 'Markiere im Modal oder Planner, was du heute gekocht hast.'}</p>
    </div>
  `;
}

function renderPlannerSummary() {
  const stats = getPlannerStats(weekPlan, recipes);
  plannerSummary.innerHTML = `
    <div class="summary-card">
      <strong>Geplante Mahlzeiten</strong>
      <div class="summary-card-value">${stats.entries}</div>
      <p>${stats.entries ? `${stats.uniqueRecipes} verschiedene Rezepte sind diese Woche im Umlauf.` : 'Noch leer: oeffne einen Tag und trage ein Rezept direkt in einen Slot ein.'}</p>
    </div>
    <div class="summary-card">
      <strong>Belegte Tage</strong>
      <div class="summary-card-value">${stats.plannedDays}</div>
      <p>${stats.plannedDays ? 'Portionen und Slots bleiben pro Eintrag gespeichert.' : 'Ideal fuer wiederkehrende Wochenmuster oder spontane Planung.'}</p>
    </div>
    <div class="summary-card">
      <strong>Favoriten im Plan</strong>
      <div class="summary-card-value">${stats.favoriteEntries}</div>
      <p>${stats.favoriteEntries ? 'Favoriten stehen im Picker zuerst und landen dadurch schneller im Alltag.' : 'Herzrezepte helfen besonders, wenn es schnell gehen soll.'}</p>
    </div>
  `;
}

function renderPlannerServingOptions(selected) {
  return SERVING_OPTIONS.map((value) => `<option value="${value}"${value === selected ? ' selected' : ''}>${value} P.</option>`).join('');
}

function renderRecipes() {
  const list = getFilteredSorted();
  updateFavoriteFilterButton();
  updateTagFilterPill();
  renderCollectionSummary();

  recipeCount.textContent = list.length === recipes.length
    ? `${recipes.length} Rezept${recipes.length !== 1 ? 'e' : ''}`
    : `${list.length} von ${recipes.length} Rezepten`;

  if (!list.length) {
    const hasActiveFilters = Boolean(searchInput.value.trim() || activeTagFilter || favoriteFilterActive);
    const canAdmin = latestAppData.capabilities?.canAdmin;
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

  recipeGrid.innerHTML = list.map((recipe) => {
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
            <button type="button" class="icon-btn favorite-btn${recipe.favorite ? ' active' : ''}" data-action="toggle-favorite" data-recipe-id="${recipe.id}" aria-pressed="${String(recipe.favorite)}" aria-label="${recipe.favorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}">${recipe.favorite ? '♥' : '♡'}</button>
            ${latestAppData.capabilities?.canAdmin ? `<button type="button" class="icon-btn delete-btn" data-action="delete-recipe" data-recipe-id="${recipe.id}" aria-label="Rezept ${escapeAttribute(recipe.title)} löschen">✕</button>` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');
}

function renderRecipeModal() {
  if (!currentModalRecipe) return;
  const recipe = currentModalRecipe;
  const displayServings = currentModalServings || recipe.baseServings;
  const modalImage = document.getElementById('modalImage');
  const modalTitle = document.getElementById('modalTitle');
  const modalDate = document.getElementById('modalDate');
  const modalHeaderMeta = document.getElementById('modalHeaderMeta');
  const modalIngredients = document.getElementById('modalIngredients');
  const modalInstructions = document.getElementById('modalInstructions');
  const modalDescription = document.getElementById('modalDescription');
  const modalPlating = document.getElementById('modalPlating');
  const modalTips = document.getElementById('modalTips');
  const descriptionSection = document.getElementById('descriptionSectionModal');
  const platingWrapper = document.getElementById('modalPlatingWrapper');
  const tipsSection = document.getElementById('tipsSectionModal');

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
  modalServingsSelect.value = String(displayServings);
  modalEditBtn.style.display = latestAppData.capabilities?.canAdmin ? '' : 'none';

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

function openRecipeModal(recipeId, options = {}) {
  const recipe = recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;
  currentModalRecipe = recipe;
  currentModalServings = SERVING_OPTIONS.includes(Number.parseInt(options.servings, 10))
    ? Number.parseInt(options.servings, 10)
    : recipe.baseServings;
  lastModalTrigger = options.trigger || document.activeElement;
  renderRecipeModal();
  recipeModal.classList.add('visible');
  syncBodyScrollLock();
  modalCloseBtn.focus();
}

function closeRecipeModal({ restoreFocus = true } = {}) {
  recipeModal.classList.remove('visible');
  syncBodyScrollLock();
  currentModalRecipe = null;
  currentModalServings = null;
  if (restoreFocus && lastModalTrigger?.isConnected) {
    lastModalTrigger.focus();
  }
  lastModalTrigger = null;
}

function updateModalServings() {
  if (!currentModalRecipe) return;
  currentModalServings = Number.parseInt(modalServingsSelect.value, 10);
  renderRecipeModal();
}

function editRecipeModal() {
  if (!currentModalRecipe || !latestAppData.capabilities?.canAdmin) return;
  const recipe = currentModalRecipe;
  closeRecipeModal({ restoreFocus: false });
  editingRecipeId = recipe.id;
  pendingImageUpload = null;
  titleInput.value = recipe.title;
  servingsInput.value = recipe.baseServings;
  prepTimeInput.value = recipe.prepTime || '';
  cookTimeInput.value = recipe.cookTime || '';
  tagsInput.value = (recipe.tags || []).join(', ');
  imageUrlInput.value = recipe.imageEditorValue || '';
  if (recipe.imageUrl) {
    previewImg.src = recipe.imageUrl;
    imagePreview.style.display = 'block';
  } else {
    imagePreview.style.display = 'none';
  }
  descriptionInput.value = recipe.description || '';
  ingredientsInput.value = recipe.rawIngredients || '';
  instructionsInput.value = recipe.instructions || '';
  platingInput.value = recipe.plating || '';
  tipsInput.value = recipe.tips || '';
  document.getElementById('formTitle').textContent = `Bearbeiten: ${recipe.title}`;
  formContainer.classList.add('visible');
  toggleFormBtn.textContent = '✕ Abbrechen';
  titleInput.focus();
}

function askDelete(recipeId, trigger = null) {
  const recipe = recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;
  pendingDeleteId = recipe.id;
  lastDeleteTrigger = trigger || document.activeElement;
  document.getElementById('deleteConfirmName').textContent = `"${recipe.title}"`;
  deleteConfirm.classList.add('visible');
  syncBodyScrollLock();
  cancelDeleteBtn.focus();
}

async function confirmDelete() {
  if (!pendingDeleteId) return;
  const recipeId = pendingDeleteId;
  const previousLabel = confirmDeleteBtn.textContent;
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Loesche...';

  try {
    await waitForAppReady();
    await repository.deleteRecipe(recipeId);
    pendingDeleteId = null;
    deleteConfirm.classList.remove('visible');
    syncBodyScrollLock();
    if (lastDeleteTrigger?.isConnected) lastDeleteTrigger.focus();
    lastDeleteTrigger = null;
    await refreshAppData({ silent: true });
  } catch (error) {
    alert(`Loeschen fehlgeschlagen: ${error.message}`);
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = previousLabel;
  }
}

function cancelDelete() {
  pendingDeleteId = null;
  deleteConfirm.classList.remove('visible');
  syncBodyScrollLock();
  if (lastDeleteTrigger?.isConnected) lastDeleteTrigger.focus();
  lastDeleteTrigger = null;
}

function getPlannerCandidates(query = '') {
  const normalizedQuery = query.trim().toLowerCase();
  return recipes
    .filter((recipe) => {
      if (!normalizedQuery) return true;
      return recipe.title.toLowerCase().includes(normalizedQuery)
        || (recipe.tags || []).some((tag) => tag.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => {
      const favoriteCompare = Number(b.favorite) - Number(a.favorite);
      if (favoriteCompare !== 0) return favoriteCompare;
      const cookedCompare = getCookedTimestamp(b) - getCookedTimestamp(a);
      if (cookedCompare !== 0) return cookedCompare;
      return compareTitles(a, b);
    });
}

function renderDayPickerItems(day, query = '') {
  const matches = getPlannerCandidates(query);
  if (!matches.length) {
    return `<div class="day-picker-item" aria-disabled="true" style="color:#a0826d;font-style:italic;">${query ? 'Keine Treffer' : 'Keine Rezepte'}</div>`;
  }

  return matches.map((recipe) => `
    <button type="button" class="day-picker-item" data-action="add-to-day" data-day="${day}" data-recipe-id="${recipe.id}">
      ${escapeHtml(recipe.title)}
      <span class="day-picker-item-meta">${[
        recipe.favorite ? 'Favorit' : '',
        formatLastCooked(recipe, 'short'),
        `${recipe.baseServings} Pers. Standard`,
        `Slot ${getMealSlotLabel(activeDayPickerSlot, true)}`,
      ].filter(Boolean).join(' · ')}</span>
    </button>
  `).join('');
}

function renderWeekPlanner() {
  renderPlannerSummary();
  daysGrid.innerHTML = DAYS.map((day) => {
    const entries = (weekPlan[day] || [])
      .map((entry, index) => ({ entry, index, recipe: recipes.find((recipe) => recipe.id === String(entry.recipeId)) }))
      .filter((item) => item.recipe);

    const slotSections = MEAL_SLOTS.map((slot) => {
      const slotEntries = entries.filter((item) => item.entry.slot === slot.id);
      if (!slotEntries.length) return '';

      const chips = slotEntries.map(({ entry, index, recipe }) => `
        <div class="day-recipe-chip">
          <div class="chip-main">
            <button type="button" class="chip-name" data-action="open-recipe" data-recipe-id="${recipe.id}" data-modal-servings="${entry.servings}" title="${escapeAttribute(recipe.title)}">${escapeHtml(recipe.title)}</button>
            <div class="chip-controls">
              <div class="chip-field">
                <span>Slot</span>
                <label class="sr-only" for="chip-slot-${day}-${index}">Mahlzeiten-Slot für ${escapeHtml(recipe.title)}</label>
                <select id="chip-slot-${day}-${index}" class="chip-slot-select" data-action="plan-slot" data-day="${day}" data-index="${index}" aria-label="Mahlzeiten-Slot für ${escapeAttribute(recipe.title)}">
                  ${renderMealSlotOptions(entry.slot, true)}
                </select>
              </div>
              <div class="chip-field">
                <span>Port.</span>
                <label class="sr-only" for="chip-servings-${day}-${index}">Portionen für ${escapeHtml(recipe.title)}</label>
                <select id="chip-servings-${day}-${index}" class="chip-servings-select" data-action="plan-serving" data-day="${day}" data-index="${index}" aria-label="Portionen für ${escapeAttribute(recipe.title)}">
                  ${renderPlannerServingOptions(entry.servings)}
                </select>
              </div>
            </div>
          </div>
          <div class="chip-actions">
            <button type="button" class="chip-cooked${formatLastCooked(recipe, 'short') ? ' active' : ''}" data-action="mark-cooked" data-recipe-id="${recipe.id}" title="${escapeAttribute(formatLastCooked(recipe, 'long') || 'Heute gekocht markieren')}" aria-label="${escapeAttribute(recipe.title)} als gekocht markieren">✓</button>
            <button type="button" class="chip-remove" data-action="remove-plan-entry" data-day="${day}" data-index="${index}" title="Entfernen" aria-label="${escapeAttribute(recipe.title)} aus ${day} entfernen">×</button>
          </div>
        </div>
      `).join('');

      return `<div class="day-slot-section">
        <div class="day-slot-label">${slot.label}</div>
        ${chips}
      </div>`;
    }).join('');

    const pickerOpen = activeDayPicker === day;
    const pickerSearch = pickerOpen ? `
      <div class="day-picker-toolbar">
        <label for="picker-slot-${day}">Eintragen als</label>
        <select class="day-picker-slot" id="picker-slot-${day}" data-day-picker-slot="${day}">
          ${renderMealSlotOptions(activeDayPickerSlot)}
        </select>
      </div>
      <input class="day-picker-search" type="text" placeholder="Suchen …" id="picker-search-${day}" data-day-picker-search="${day}">
    ` : '';

    return `
      <div class="day-column" data-day-column="${day}">
        <div class="day-name">${day}</div>
        ${slotSections || '<div class="day-empty">Noch nichts geplant</div>'}
        <div class="day-add-wrapper">
          <button type="button" class="day-add-btn" data-action="toggle-day-picker" data-day="${day}" aria-expanded="${String(pickerOpen)}" aria-controls="picker-${day}">+ Rezept</button>
          <div class="day-picker ${pickerOpen ? 'open' : ''}" id="picker-${day}">
            ${pickerSearch}
            <div id="picker-list-${day}">${pickerOpen ? renderDayPickerItems(day) : ''}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function refreshPlannerViews() {
  if (weekPlanner.style.display === 'block') {
    renderWeekPlanner();
    updatePlannerShoppingList();
  }
}

function updatePlannerShoppingList() {
  const ingredientMap = {};
  const allEntries = DAYS.flatMap((day) => weekPlan[day] || []);

  allEntries.forEach((entry) => {
    const recipe = recipes.find((item) => item.id === String(entry.recipeId));
    if (!recipe || !recipe.parsedIngredients?.length) return;
    const servings = entry.servings || recipe.baseServings;

    recipe.parsedIngredients.forEach((ingredient) => {
      if (ingredient.quantity === null || ingredient.quantity === undefined) {
        const key = ingredient.name.toLowerCase();
        if (!ingredientMap[key]) ingredientMap[key] = { name: ingredient.name, quantity: null, unit: null };
        return;
      }

      const scaled = ingredient.quantity * (servings / recipe.baseServings);
      const key = `${ingredient.unit || 'stück'}:${ingredient.name.toLowerCase()}`;
      if (!ingredientMap[key]) ingredientMap[key] = { name: ingredient.name, quantity: 0, unit: ingredient.unit };
      ingredientMap[key].quantity += scaled;
    });
  });

  let text = '';
  Object.values(ingredientMap).forEach((item) => {
    if (item.quantity === null || item.quantity === undefined) {
      text += `${item.name}\n`;
      return;
    }
    let quantity = Math.round(item.quantity * 10) / 10;
    if (quantity === Math.floor(quantity)) quantity = Math.floor(quantity);
    text += `${quantity}${item.unit ? ` ${item.unit}` : ''} ${item.name}\n`;
  });

  fullShoppingList = text;
  shoppingList.textContent = text || '';
  shoppingSearchInput.value = '';
}

function toggleDayPicker(day) {
  if (activeDayPicker === day) {
    activeDayPicker = null;
  } else {
    activeDayPicker = day;
    activeDayPickerSlot = 'abend';
  }
  renderWeekPlanner();
  if (activeDayPicker) {
    const input = document.getElementById(`picker-search-${day}`);
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  }
}

function filterDayPicker(day, query) {
  const list = document.getElementById(`picker-list-${day}`);
  if (!list) return;
  list.innerHTML = renderDayPickerItems(day, query);
}

async function persistWeekPlan() {
  await repository.saveWeekPlan(weekPlan);
  await refreshAppData({ silent: true });
}

async function addToDay(day, recipeId) {
  const recipe = recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;
  weekPlan[day].push({
    recipeId: recipe.id,
    servings: recipe.baseServings,
    slot: activeDayPickerSlot,
  });
  activeDayPicker = null;
  await persistWeekPlan();
}

async function removeFromDay(day, index) {
  weekPlan[day].splice(index, 1);
  await persistWeekPlan();
}

async function updatePlanEntryServings(day, index, servings) {
  if (!weekPlan[day] || !weekPlan[day][index]) return;
  if (!SERVING_OPTIONS.includes(servings)) return;
  weekPlan[day][index].servings = servings;
  await persistWeekPlan();
}

async function updatePlanEntrySlot(day, index, slot) {
  if (!weekPlan[day] || !weekPlan[day][index] || !isValidMealSlot(slot)) return;
  weekPlan[day][index].slot = slot;
  await persistWeekPlan();
}

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function buildImportMessage(summary) {
  let message = `${summary.importedRecipes} Rezept${summary.importedRecipes !== 1 ? 'e' : ''} importiert.`;
  if (summary.duplicateRecipes > 0) message += ` ${summary.duplicateRecipes} Duplikat${summary.duplicateRecipes !== 1 ? 'e' : ''} übersprungen.`;
  if (summary.invalidRecipes > 0) message += ` ${summary.invalidRecipes} ungültig${summary.invalidRecipes !== 1 ? 'e' : ''} Eintrag${summary.invalidRecipes !== 1 ? 'e' : ''} ignoriert.`;
  if (summary.importedPlannerEntries > 0) {
    message += ` Wochenplan: ${summary.importedPlannerEntries} Eintrag${summary.importedPlannerEntries !== 1 ? 'e' : ''} übernommen.`;
  }
  return message;
}

async function handleRecipeSubmit(event) {
  event.preventDefault();
  if (!validateRecipeForm()) return;
  await waitForAppReady();

  const existing = editingRecipeId ? recipes.find((recipe) => recipe.id === editingRecipeId) : null;
  const rawIngredients = normalizeMultilineText(ingredientsInput.value);
  const imageValue = imageUrlInput.value.trim();
  let image = {
    mode: 'keep',
    previousImagePath: existing?.imagePath || null,
    previousExternalImageUrl: existing?.externalImageUrl || null,
  };

  if (pendingImageUpload?.dataUrl) {
    image = {
      mode: 'upload',
      uploadDataUrl: pendingImageUpload.dataUrl,
      filename: pendingImageUpload.filename,
      previousImagePath: existing?.imagePath || null,
    };
  } else if (imageValue && isExternalImageUrl(imageValue)) {
    image = {
      mode: 'external',
      externalUrl: imageValue,
      previousImagePath: existing?.imagePath || null,
    };
  }

  await repository.saveRecipe({
    id: existing?.id,
    title: titleInput.value.trim(),
    baseServings: Number.parseInt(servingsInput.value, 10),
    prepTime: Number.parseInt(prepTimeInput.value, 10) || 0,
    cookTime: Number.parseInt(cookTimeInput.value, 10) || 0,
    tags: normalizeTags(tagsInput.value),
    description: descriptionInput.value.trim(),
    rawIngredients,
    parsedIngredients: parseIngredientsText(rawIngredients),
    instructions: normalizeMultilineText(instructionsInput.value),
    plating: normalizeMultilineText(platingInput.value),
    tips: normalizeMultilineText(tipsInput.value),
    image,
  });

  resetForm();
  closeRecipeForm();
  await refreshAppData({ silent: true });
}

googleLoginBtn.addEventListener('click', async () => {
  try {
    googleLoginBtn.disabled = true;
    await authService.signInWithGoogle();
    renderAuthShell(authService.getSnapshot());
  } catch (error) {
    googleLoginBtn.disabled = false;
    loginMessage.textContent = error.message || 'Google-Login fehlgeschlagen.';
  }
});

browserTestLoginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await authService.signInForBrowserTest(browserTestEmail.value);
    const snapshot = authService.getSnapshot();
    renderAuthShell(snapshot);
    if (snapshot.accessState === 'signed_in') {
      await waitForAppReady();
      await refreshAppData({ silent: true });
    }
  } catch (error) {
    loginMessage.textContent = error.message || 'Test-Login fehlgeschlagen.';
  }
});

signOutBtn.addEventListener('click', async () => {
  await authService.signOut();
  renderAuthShell(authService.getSnapshot());
  browserTestEmail.value = '';
  googleLoginBtn.disabled = false;
  recipes = [];
  weekPlan = createEmptyWeekPlan();
  renderRecipes();
});

toggleFormBtn.addEventListener('click', () => {
  if (formContainer.classList.contains('visible')) {
    closeRecipeForm();
  } else {
    openRecipeForm();
  }
});

uploadImageBtn.addEventListener('click', () => imageFileInput.click());

imageFileInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const dataUrl = await resizeImage(file);
  pendingImageUpload = {
    dataUrl,
    filename: file.name || 'bild.jpg',
  };
  previewImg.src = dataUrl;
  imagePreview.style.display = 'block';
  imageUrlInput.value = '';
  imageFileInput.value = '';
});

imageUrlInput.addEventListener('input', () => {
  const value = imageUrlInput.value.trim();
  if (value && (isExternalImageUrl(value) || isDataUrl(value))) {
    previewImg.src = value;
    imagePreview.style.display = 'block';
  } else if (!value && !pendingImageUpload) {
    imagePreview.style.display = 'none';
  }
  if (value) {
    pendingImageUpload = null;
  }
});

recipeForm.addEventListener('submit', handleRecipeSubmit);

togglePlannerBtn.addEventListener('click', () => {
  const open = weekPlanner.style.display === 'none';
  weekPlanner.style.display = open ? 'block' : 'none';
  togglePlannerBtn.setAttribute('aria-expanded', String(open));
  if (open) {
    renderPlannerSummary();
    renderWeekPlanner();
    updatePlannerShoppingList();
  }
});

clearPlanBtn.addEventListener('click', async () => {
  if (!DAYS.some((day) => (weekPlan[day] || []).length > 0)) return;
  weekPlan = createEmptyWeekPlan();
  await persistWeekPlan();
});

shoppingSearchInput.addEventListener('input', (event) => {
  const query = event.target.value.toLowerCase();
  if (!query) {
    shoppingList.textContent = fullShoppingList;
    return;
  }
  const filtered = fullShoppingList.split('\n').filter((line) => line.toLowerCase().includes(query)).join('\n');
  shoppingList.textContent = filtered || '(Keine Treffer)';
});

exportShoppingBtn.addEventListener('click', () => {
  const text = shoppingList.textContent;
  if (!text.trim()) return;
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `einkaufsliste_${new Date().toISOString().split('T')[0]}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
});

exportBtn.addEventListener('click', async () => {
  await waitForAppReady();
  const payload = await repository.exportCookbook();
  downloadJson(`kochbuch_${new Date().toISOString().split('T')[0]}.json`, payload);
});

importBtn.addEventListener('click', () => importFile.click());

importFile.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    await waitForAppReady();
    const payload = JSON.parse(await file.text());
    const summary = await repository.importCookbookPayload(payload);
    alert(buildImportMessage(summary));
    await refreshAppData({ silent: true });
  } catch (error) {
    alert(`Fehler beim Importieren: ${error.message}`);
  } finally {
    importFile.value = '';
  }
});

migrateLocalBtn.addEventListener('click', async () => {
  try {
    await waitForAppReady();
    const summary = await repository.migrateLegacyLocalData();
    alert(summary.migrated ? buildImportMessage(summary) : 'Keine lokalen Daten für die Migration gefunden.');
    await refreshAppData({ silent: true });
  } catch (error) {
    alert(`Migration fehlgeschlagen: ${error.message}`);
  }
});

searchInput.addEventListener('input', renderRecipes);
sortSelect.addEventListener('change', renderRecipes);
toggleFavoritesBtn.addEventListener('click', toggleFavoritesFilter);
clearTagFilterBtn.addEventListener('click', clearTagFilter);
modalCloseBtn.addEventListener('click', () => closeRecipeModal());
modalFavoriteBtn.addEventListener('click', async () => {
  if (!currentModalRecipe) return;
  await repository.toggleFavorite(currentModalRecipe.id);
  await refreshAppData({ silent: true });
  currentModalRecipe = recipes.find((recipe) => recipe.id === currentModalRecipe.id) || currentModalRecipe;
  renderRecipeModal();
});
modalCookedBtn.addEventListener('click', async () => {
  if (!currentModalRecipe) return;
  await repository.markRecipeCooked(currentModalRecipe.id);
  await refreshAppData({ silent: true });
  currentModalRecipe = recipes.find((recipe) => recipe.id === currentModalRecipe.id) || currentModalRecipe;
  renderRecipeModal();
});
modalEditBtn.addEventListener('click', editRecipeModal);
modalServingsSelect.addEventListener('change', updateModalServings);
confirmDeleteBtn.addEventListener('click', confirmDelete);
cancelDeleteBtn.addEventListener('click', cancelDelete);
deleteConfirm.addEventListener('click', (event) => {
  if (event.target === deleteConfirm) {
    cancelDelete();
  }
});
REQUIRED_FIELDS.forEach((_message, input) => {
  input.addEventListener('input', () => updateRequiredFieldValidity(input));
  input.addEventListener('blur', () => updateRequiredFieldValidity(input));
});

document.addEventListener('input', (event) => {
  if (event.target.matches('[data-day-picker-search]')) {
    filterDayPicker(event.target.dataset.dayPickerSearch, event.target.value);
  }
});

document.addEventListener('change', async (event) => {
  if (event.target.matches('[data-day-picker-slot]')) {
    activeDayPickerSlot = isValidMealSlot(event.target.value) ? event.target.value : 'abend';
    const day = event.target.dataset.dayPickerSlot;
    const list = document.getElementById(`picker-list-${day}`);
    if (list) {
      list.innerHTML = renderDayPickerItems(day, document.getElementById(`picker-search-${day}`)?.value || '');
    }
    return;
  }

  if (event.target.matches('[data-action="plan-serving"]')) {
    await updatePlanEntryServings(event.target.dataset.day, Number.parseInt(event.target.dataset.index, 10), Number.parseInt(event.target.value, 10));
    return;
  }

  if (event.target.matches('[data-action="plan-slot"]')) {
    await updatePlanEntrySlot(event.target.dataset.day, Number.parseInt(event.target.dataset.index, 10), event.target.value);
  }
});

document.addEventListener('click', async (event) => {
  const actionTarget = event.target.closest('[data-action]');

  if (actionTarget) {
    const { action } = actionTarget.dataset;

    if (action === 'filter-tag') {
      setTagFilter(decodeURIComponent(actionTarget.dataset.tag));
      return;
    }

    if (action === 'open-recipe') {
      openRecipeModal(actionTarget.dataset.recipeId, {
        servings: Number.parseInt(actionTarget.dataset.modalServings, 10),
        trigger: actionTarget,
      });
      return;
    }

    if (action === 'toggle-favorite') {
      await repository.toggleFavorite(actionTarget.dataset.recipeId);
      await refreshAppData({ silent: true });
      return;
    }

    if (action === 'mark-cooked') {
      await repository.markRecipeCooked(actionTarget.dataset.recipeId);
      await refreshAppData({ silent: true });
      return;
    }

    if (action === 'delete-recipe') {
      askDelete(actionTarget.dataset.recipeId, actionTarget);
      return;
    }

    if (action === 'toggle-day-picker') {
      toggleDayPicker(actionTarget.dataset.day);
      return;
    }

    if (action === 'add-to-day') {
      await addToDay(actionTarget.dataset.day, actionTarget.dataset.recipeId);
      return;
    }

    if (action === 'remove-plan-entry') {
      await removeFromDay(actionTarget.dataset.day, Number.parseInt(actionTarget.dataset.index, 10));
      return;
    }

    if (action === 'open-form') {
      openRecipeForm();
      return;
    }

    if (action === 'open-import') {
      if (latestAppData.capabilities?.canAdmin) {
        importFile.click();
      }
      return;
    }
  }

  if (activeDayPicker && !event.target.closest('.day-add-wrapper')) {
    activeDayPicker = null;
    renderWeekPlanner();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  if (deleteConfirm.classList.contains('visible')) {
    cancelDelete();
    return;
  }

  if (recipeModal.classList.contains('visible')) {
    closeRecipeModal();
    return;
  }

  if (activeDayPicker) {
    activeDayPicker = null;
    renderWeekPlanner();
  }
});

recipeModal.addEventListener('click', (event) => {
  if (event.target === recipeModal) {
    closeRecipeModal();
  }
});

window.addEventListener('focus', async () => {
  if (authService.getSnapshot().accessState === 'signed_in') {
    await refreshAppData({ silent: true });
  }
});

authService.onAuthStateChange(async (snapshot) => {
  renderAuthShell(snapshot);
  if (snapshot.accessState === 'signed_in') {
    await refreshAppData({ silent: true });
  }
});

document.addEventListener('DOMContentLoaded', async () => {
  renderAuthShell(authService.getSnapshot());
  togglePlannerBtn.setAttribute('aria-expanded', 'false');

  await authService.initialize();
  const snapshot = authService.getSnapshot();
  renderAuthShell(snapshot);

  if (snapshot.accessState === 'signed_in') {
    await refreshAppData({ silent: true });
  } else if (snapshot.accessState === 'signed_out' && config.backend === 'browser-test') {
    browserTestEmail.value = 'admin@kochbuch.local';
  }

  const legacySnapshot = readLegacyLocalSnapshot(window.localStorage);
  if (legacySnapshot.hasLegacyData && snapshot.accessState !== 'signed_in') {
    loginMessage.textContent = config.backend === 'browser-test'
      ? 'Lokale Kochbuchdaten gefunden. Nach dem Test-Login kann die Einmal-Migration gestartet werden.'
      : 'Lokale Kochbuchdaten gefunden. Nach dem Google-Login kann die Einmal-Migration gestartet werden.';
  }
});
