import { createAppServices } from './bootstrap/app.js';
import { createUiState } from './ui/state-controller.js';
import { createRecipeFormController } from './ui/recipe-form.js';
import { bindAppEvents } from './ui/events.js';
import { createDialogController } from './ui/modals.js';
import {
  getFilteredSortedRecipes,
  renderCollectionSummary,
  renderRecipeGrid,
  renderRecipeModalContent,
} from './ui/recipes-view.js';
import {
  buildShoppingListText,
  renderDayPickerItems,
  renderWeekPlanner,
} from './ui/planner-view.js';
import { setVisible } from './ui/view-helpers.js';
import {
  createEmptyWeekPlan,
  DAYS,
  isDataUrl,
  isExternalImageUrl,
  isValidMealSlot,
  normalizeMultilineText,
  normalizePositiveInteger,
  normalizeTags,
  parseIngredientsText,
  readLegacyLocalSnapshot,
  renderMealSlotOptions,
  SERVING_OPTIONS,
} from './cookbook-schema.js';

const { config, authService, repository } = createAppServices();
const state = createUiState(authService);

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
const formTitle = document.getElementById('formTitle');
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
const restoreImportBtn = document.getElementById('restoreImportBtn');
const recipeImportBtn = document.getElementById('recipeImportBtn');
const restoreImportFile = document.getElementById('restoreImportFile');
const recipeImportFile = document.getElementById('recipeImportFile');
const migrateLocalBtn = document.getElementById('migrateLocalBtn');
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
const recipeModalContent = recipeModal.querySelector('.modal-content');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalFavoriteBtn = document.getElementById('modalFavoriteBtn');
const modalEditBtn = document.getElementById('modalEditBtn');
const modalCookedBtn = document.getElementById('modalCookedBtn');
const modalCookedStatus = document.getElementById('modalCookedStatus');
const modalServingsSelect = document.getElementById('modalServings');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalDate = document.getElementById('modalDate');
const modalHeaderMeta = document.getElementById('modalHeaderMeta');
const modalDescription = document.getElementById('modalDescription');
const modalIngredients = document.getElementById('modalIngredients');
const modalInstructions = document.getElementById('modalInstructions');
const modalPlating = document.getElementById('modalPlating');
const modalTips = document.getElementById('modalTips');
const descriptionSection = document.getElementById('descriptionSectionModal');
const platingWrapper = document.getElementById('modalPlatingWrapper');
const tipsSection = document.getElementById('tipsSectionModal');

const deleteConfirm = document.getElementById('deleteConfirm');
const deleteConfirmBox = deleteConfirm.querySelector('.confirm-box');
const deleteConfirmName = document.getElementById('deleteConfirmName');
const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');

const REQUIRED_FIELDS = new Map([
  [titleInput, 'Bitte gib einen Rezeptnamen ein.'],
  [ingredientsInput, 'Bitte trage mindestens eine Zutat ein.'],
  [instructionsInput, 'Bitte trage eine Zubereitung ein.'],
]);

const formController = createRecipeFormController({
  elements: {
    recipeForm,
    formContainer,
    toggleFormBtn,
    titleInput,
    servingsInput,
    imagePreview,
    previewImg,
    imageUrlInput,
    imageFileInput,
    prepTimeInput,
    cookTimeInput,
    tagsInput,
    descriptionInput,
    ingredientsInput,
    instructionsInput,
    platingInput,
    tipsInput,
    formTitle,
  },
  requiredFields: REQUIRED_FIELDS,
});

const modalController = createDialogController({
  overlay: recipeModal,
  content: recipeModalContent,
  appShell,
  initialFocus: () => modalCloseBtn,
  onOpen: syncBodyScrollLock,
  onClose: () => {
    state.currentModalRecipe = null;
    state.currentModalServings = null;
    syncBodyScrollLock();
  },
});

const deleteDialogController = createDialogController({
  overlay: deleteConfirm,
  content: deleteConfirmBox,
  appShell,
  initialFocus: () => cancelDeleteBtn,
  onOpen: syncBodyScrollLock,
  onClose: () => {
    state.pendingDeleteId = null;
    syncBodyScrollLock();
  },
});

function syncBodyScrollLock() {
  const shouldLock = modalController.isOpen() || deleteDialogController.isOpen();
  document.body.style.overflow = shouldLock ? 'hidden' : '';
}

function getServingOptionValues(selected) {
  const values = new Set(SERVING_OPTIONS);
  values.add(normalizePositiveInteger(selected, 2));
  return Array.from(values).sort((a, b) => a - b);
}

function renderServingOptions(selected, formatLabel) {
  return getServingOptionValues(selected)
    .map((value) => `<option value="${value}"${value === Number(selected) ? ' selected' : ''}>${formatLabel(value)}</option>`)
    .join('');
}

function renderPlannerServingOptions(selected) {
  return renderServingOptions(selected, (value) => `${value} P.`);
}

function renderModalServingOptions(selected) {
  return renderServingOptions(selected, (value) => String(value));
}

function applyRoleUi(canAdmin) {
  document.querySelectorAll('[data-admin-only]').forEach((element) => {
    element.classList.toggle('admin-hidden', !canAdmin);
  });
}

function updateFavoriteFilterButton() {
  toggleFavoritesBtn.classList.toggle('active', state.favoriteFilterActive);
  toggleFavoritesBtn.setAttribute('aria-pressed', String(state.favoriteFilterActive));
}

function updateTagFilterPill() {
  tagFilterPill.classList.toggle('visible', Boolean(state.activeTagFilter));
  if (state.activeTagFilter) {
    tagFilterLabel.textContent = state.activeTagFilter;
  }
}

function setPlannerOpen(open) {
  state.plannerOpen = open;
  weekPlanner.style.display = open ? 'block' : 'none';
  weekPlanner.toggleAttribute('hidden', !open);
  togglePlannerBtn.setAttribute('aria-expanded', String(open));
}

function openRecipeForm() {
  if (!state.latestAppData.capabilities?.canAdmin) return;
  state.editingRecipeId = null;
  formController.resetForm();
  servingsInput.value = '2';
  formController.openRecipeForm();
}

function closeRecipeForm() {
  state.editingRecipeId = null;
  formController.closeRecipeForm();
}

function renderAuthShell(snapshot) {
  state.latestAuthSnapshot = snapshot;

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

function buildFilteredRecipes() {
  return getFilteredSortedRecipes({
    recipes: state.recipes,
    query: searchInput.value,
    activeTagFilter: state.activeTagFilter,
    favoriteFilterActive: state.favoriteFilterActive,
    sort: sortSelect.value,
  });
}

function renderRecipeModal() {
  if (!state.currentModalRecipe) return;
  const currentRecipe = state.recipes.find((recipe) => recipe.id === state.currentModalRecipe.id) || state.currentModalRecipe;
  state.currentModalRecipe = currentRecipe;
  renderRecipeModalContent({
    recipe: currentRecipe,
    displayServings: state.currentModalServings || currentRecipe.baseServings,
    canAdmin: state.latestAppData.capabilities?.canAdmin,
    renderServingOptions: renderModalServingOptions,
    elements: {
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
    },
  });
}

function renderRecipes() {
  updateFavoriteFilterButton();
  updateTagFilterPill();
  renderCollectionSummary({
    collectionSummary,
    recipes: state.recipes,
    weekPlan: state.weekPlan,
  });

  renderRecipeGrid({
    recipeGrid,
    recipeCount,
    recipes: state.recipes,
    filteredRecipes: buildFilteredRecipes(),
    activeTagFilter: state.activeTagFilter,
    query: searchInput.value,
    favoriteFilterActive: state.favoriteFilterActive,
    canAdmin: state.latestAppData.capabilities?.canAdmin,
  });

  if (modalController.isOpen()) {
    renderRecipeModal();
  }
}

function updatePlannerShoppingList() {
  state.fullShoppingList = buildShoppingListText({
    weekPlan: state.weekPlan,
    recipes: state.recipes,
  });
  shoppingList.textContent = state.fullShoppingList || '';
  shoppingSearchInput.value = '';
}

function renderPlanner() {
  renderWeekPlanner({
    daysGrid,
    plannerSummary,
    weekPlan: state.weekPlan,
    recipes: state.recipes,
    activeDayPicker: state.activeDayPicker,
    activeDayPickerSlot: state.activeDayPickerSlot,
    renderServingOptions: renderPlannerServingOptions,
    renderMealSlotOptions,
  });
}

function refreshPlannerViews() {
  if (!state.plannerOpen) return;
  renderPlanner();
  updatePlannerShoppingList();
}

function applyLoadResult(result) {
  state.latestAppData = result;
  state.recipes = result.recipes || [];
  state.weekPlan = result.weekPlan || createEmptyWeekPlan();
  applyRoleUi(result.capabilities?.canAdmin);
  renderRecipes();
  refreshPlannerViews();
  migrateLocalBtn.style.display = result.capabilities?.canAdmin && result.migration?.hasLegacyData && !result.migration?.alreadyMigrated ? '' : 'none';
}

async function refreshAppData({ silent = false } = {}) {
  if (state.inflightRefreshPromise) {
    return state.inflightRefreshPromise;
  }

  state.inflightRefreshPromise = (async () => {
    if (!silent) {
      renderAuthShell({
        ...state.latestAuthSnapshot,
        accessState: state.latestAuthSnapshot.accessState === 'signed_in' ? 'loading' : state.latestAuthSnapshot.accessState,
      });
    }
    const result = await repository.loadAppData();
    renderAuthShell(authService.getSnapshot());
    applyLoadResult(result);
    return result;
  })();

  try {
    return await state.inflightRefreshPromise;
  } finally {
    state.inflightRefreshPromise = null;
  }
}

async function waitForAppReady() {
  if (!state.inflightRefreshPromise) return;

  try {
    await state.inflightRefreshPromise;
  } catch (_error) {
    // Callers surface their own action errors. We only want to wait for the current load to settle.
  }
}

function clearTagFilter() {
  state.activeTagFilter = null;
  renderRecipes();
}

function setTagFilter(tag) {
  if (state.activeTagFilter === tag) {
    clearTagFilter();
    return;
  }

  state.activeTagFilter = tag;
  renderRecipes();
}

function toggleFavoritesFilter() {
  state.favoriteFilterActive = !state.favoriteFilterActive;
  renderRecipes();
}

function openRecipeModal(recipeId, options = {}) {
  const recipe = state.recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;
  state.currentModalRecipe = recipe;
  state.currentModalServings = normalizePositiveInteger(options.servings, recipe.baseServings);
  renderRecipeModal();
  modalController.open({
    trigger: options.trigger || document.activeElement,
  });
}

function closeRecipeModal({ restoreFocus = true } = {}) {
  modalController.close({ restoreFocus });
}

function updateModalServings() {
  if (!state.currentModalRecipe) return;
  state.currentModalServings = normalizePositiveInteger(modalServingsSelect.value, state.currentModalRecipe.baseServings);
  renderRecipeModal();
}

function editRecipeModal() {
  if (!state.currentModalRecipe || !state.latestAppData.capabilities?.canAdmin) return;
  const recipe = state.currentModalRecipe;
  closeRecipeModal({ restoreFocus: false });
  state.editingRecipeId = recipe.id;
  formController.prefillRecipeForm(recipe);
}

function askDelete(recipeId, trigger = null) {
  const recipe = state.recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;
  state.pendingDeleteId = recipe.id;
  deleteConfirmName.textContent = `"${recipe.title}"`;
  deleteDialogController.open({
    trigger: trigger || document.activeElement,
  });
}

async function confirmDelete() {
  if (!state.pendingDeleteId) return;
  const recipeId = state.pendingDeleteId;
  const previousLabel = confirmDeleteBtn.textContent;
  confirmDeleteBtn.disabled = true;
  confirmDeleteBtn.textContent = 'Loesche...';

  try {
    await waitForAppReady();
    await repository.deleteRecipe(recipeId);
    deleteDialogController.close();
    await refreshAppData({ silent: true });
  } catch (error) {
    alert(`Loeschen fehlgeschlagen: ${error.message}`);
  } finally {
    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = previousLabel;
  }
}

function cancelDelete() {
  deleteDialogController.close();
}

function focusDayPickerSearch(day) {
  const input = document.getElementById(`picker-search-${day}`);
  if (input) {
    setTimeout(() => input.focus(), 50);
  }
}

function toggleDayPicker(day) {
  if (state.activeDayPicker === day) {
    state.activeDayPicker = null;
  } else {
    state.activeDayPicker = day;
    state.activeDayPickerSlot = 'abend';
  }

  renderPlanner();
  if (state.activeDayPicker) {
    focusDayPickerSearch(day);
  }
}

function filterDayPicker(day, query) {
  const list = document.getElementById(`picker-list-${day}`);
  if (!list) return;
  list.innerHTML = renderDayPickerItems({
    day,
    query,
    recipes: state.recipes,
    activeDayPickerSlot: state.activeDayPickerSlot,
  });
}

async function persistWeekPlan() {
  await repository.saveWeekPlan(state.weekPlan);
  await refreshAppData({ silent: true });
}

async function addToDay(day, recipeId) {
  const recipe = state.recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;

  state.weekPlan[day].push({
    recipeId: recipe.id,
    servings: recipe.baseServings,
    slot: state.activeDayPickerSlot,
  });
  state.activeDayPicker = null;
  await persistWeekPlan();
}

async function removeFromDay(day, index) {
  state.weekPlan[day].splice(index, 1);
  await persistWeekPlan();
}

async function updatePlanEntryServings(day, index, servings) {
  if (!state.weekPlan[day] || !state.weekPlan[day][index]) return;
  state.weekPlan[day][index].servings = normalizePositiveInteger(servings, state.weekPlan[day][index].servings);
  await persistWeekPlan();
}

async function updatePlanEntrySlot(day, index, slot) {
  if (!state.weekPlan[day] || !state.weekPlan[day][index] || !isValidMealSlot(slot)) return;
  state.weekPlan[day][index].slot = slot;
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
  const modeLabel = summary.importMode === 'additive' ? 'ergänzt' : 'wiederhergestellt';
  let message = `${summary.importedRecipes} Rezept${summary.importedRecipes !== 1 ? 'e' : ''} ${modeLabel}.`;
  if (summary.duplicateRecipes > 0) {
    message += ` ${summary.duplicateRecipes} vorhandene Rezept${summary.duplicateRecipes !== 1 ? 'e' : ''} aktualisiert.`;
  }
  if (summary.invalidRecipes > 0) {
    message += ` ${summary.invalidRecipes} ungueltig${summary.invalidRecipes !== 1 ? 'e' : ''} Eintrag${summary.invalidRecipes !== 1 ? 'e' : ''} ignoriert.`;
  }
  if (summary.importMode === 'restore') {
    if (summary.importedStateEntries > 0) {
      message += ` Persönlicher Zustand: ${summary.importedStateEntries} Eintrag${summary.importedStateEntries !== 1 ? 'e' : ''} übernommen.`;
    }
    if (summary.removedStateEntries > 0) {
      message += ` ${summary.removedStateEntries} alte Zustands-Eintrag${summary.removedStateEntries !== 1 ? 'e' : ''} ersetzt.`;
    }
    if (summary.importedPlannerEntries > 0) {
      message += ` Wochenplan: ${summary.importedPlannerEntries} Eintrag${summary.importedPlannerEntries !== 1 ? 'e' : ''} übernommen.`;
    } else {
      message += ' Wochenplan wurde leer oder bereinigt wiederhergestellt.';
    }
  }
  return message;
}

async function handleImport(mode, input) {
  const file = input.files[0];
  if (!file) return;

  try {
    await waitForAppReady();
    const payload = JSON.parse(await file.text());
    const summary = mode === 'restore'
      ? await repository.restoreCookbookPayload(payload)
      : await repository.importCookbookRecipesPayload(payload);
    alert(buildImportMessage(summary));
    await refreshAppData({ silent: true });
  } catch (error) {
    alert(`Fehler beim Importieren: ${error.message}`);
  } finally {
    input.value = '';
  }
}

async function handleRecipeSubmit(event) {
  event.preventDefault();
  if (!formController.validateRecipeForm()) return;
  await waitForAppReady();

  const existing = state.editingRecipeId ? state.recipes.find((recipe) => recipe.id === state.editingRecipeId) : null;
  const rawIngredients = normalizeMultilineText(ingredientsInput.value);
  const imageValue = imageUrlInput.value.trim();
  let image = {
    mode: 'keep',
    previousImagePath: existing?.imagePath || null,
    previousExternalImageUrl: existing?.externalImageUrl || null,
  };

  const pendingImageUpload = formController.getPendingImageUpload();
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
  } else if (!imageValue && !pendingImageUpload && (existing?.imagePath || existing?.externalImageUrl)) {
    image = {
      mode: 'remove',
      previousImagePath: existing?.imagePath || null,
      previousExternalImageUrl: existing?.externalImageUrl || null,
    };
  }

  await repository.saveRecipe({
    id: existing?.id,
    title: titleInput.value.trim(),
    baseServings: normalizePositiveInteger(servingsInput.value, existing?.baseServings || 2),
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

  state.editingRecipeId = null;
  formController.closeRecipeForm();
  await refreshAppData({ silent: true });
}

function handleDayPickerKeyboard(event) {
  if (!state.activeDayPicker) return false;

  if (event.key === 'Escape' && event.target.closest('.day-picker')) {
    event.preventDefault();
    state.activeDayPicker = null;
    renderPlanner();
    return true;
  }

  const items = Array.from(document.querySelectorAll(`#picker-list-${state.activeDayPicker} .day-picker-item[data-action="add-to-day"]`));
  if (!items.length) return false;

  if (event.target.matches('[data-day-picker-search]') && event.key === 'ArrowDown') {
    event.preventDefault();
    items[0].focus();
    return true;
  }

  if (!event.target.classList.contains('day-picker-item')) {
    return false;
  }

  const currentIndex = items.indexOf(event.target);
  if (currentIndex === -1) return false;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    items[(currentIndex + 1) % items.length].focus();
    return true;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (currentIndex === 0) {
      const input = document.getElementById(`picker-search-${state.activeDayPicker}`);
      (input || items[items.length - 1]).focus();
    } else {
      items[currentIndex - 1].focus();
    }
    return true;
  }

  return false;
}

bindAppEvents({
  elements: {
    googleLoginBtn,
    browserTestLoginForm,
    signOutBtn,
    toggleFormBtn,
    uploadImageBtn,
    imageFileInput,
    imageUrlInput,
    recipeForm,
    togglePlannerBtn,
    clearPlanBtn,
    shoppingSearchInput,
    exportShoppingBtn,
    exportBtn,
    restoreImportBtn,
    recipeImportBtn,
    restoreImportFile,
    recipeImportFile,
    migrateLocalBtn,
    searchInput,
    sortSelect,
    toggleFavoritesBtn,
    clearTagFilterBtn,
    modalCloseBtn,
    modalFavoriteBtn,
    modalCookedBtn,
    modalEditBtn,
    modalServingsSelect,
    confirmDeleteBtn,
    cancelDeleteBtn,
    deleteConfirm,
    recipeModal,
  },
  requiredFields: REQUIRED_FIELDS,
  authService,
  handlers: {
    async onGoogleLogin() {
      try {
        googleLoginBtn.disabled = true;
        await authService.signInWithGoogle();
        renderAuthShell(authService.getSnapshot());
      } catch (error) {
        googleLoginBtn.disabled = false;
        loginMessage.textContent = error.message || 'Google-Login fehlgeschlagen.';
      }
    },

    async onBrowserTestLoginSubmit(event) {
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
    },

    async onSignOut() {
      await authService.signOut();
      renderAuthShell(authService.getSnapshot());
      browserTestEmail.value = '';
      googleLoginBtn.disabled = false;
      state.recipes = [];
      state.weekPlan = createEmptyWeekPlan();
      state.activeDayPicker = null;
      state.favoriteFilterActive = false;
      state.activeTagFilter = null;
      setPlannerOpen(false);
      renderRecipes();
    },

    onToggleRecipeForm() {
      if (formContainer.classList.contains('visible')) {
        closeRecipeForm();
      } else {
        openRecipeForm();
      }
    },

    onUploadImageClick() {
      imageFileInput.click();
    },

    async onImageFileChange(event) {
      const file = event.target.files[0];
      if (!file) return;
      await formController.handleImageFileChange(file);
    },

    onImageUrlInput() {
      formController.handleImageUrlInput({ isDataUrl, isExternalImageUrl });
    },

    onRecipeSubmit: handleRecipeSubmit,

    onTogglePlanner() {
      setPlannerOpen(!state.plannerOpen);
      if (state.plannerOpen) {
        renderPlanner();
        updatePlannerShoppingList();
      }
    },

    async onClearPlan() {
      if (!DAYS.some((day) => (state.weekPlan[day] || []).length > 0)) return;
      state.weekPlan = createEmptyWeekPlan();
      await persistWeekPlan();
    },

    onShoppingSearch(event) {
      const query = event.target.value.toLowerCase();
      if (!query) {
        shoppingList.textContent = state.fullShoppingList;
        return;
      }
      const filtered = state.fullShoppingList.split('\n').filter((line) => line.toLowerCase().includes(query)).join('\n');
      shoppingList.textContent = filtered || '(Keine Treffer)';
    },

    onExportShopping() {
      const text = shoppingList.textContent;
      if (!text.trim()) return;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `einkaufsliste_${new Date().toISOString().split('T')[0]}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
    },

    async onExportCookbook() {
      await waitForAppReady();
      const payload = await repository.exportCookbook();
      downloadJson(`kochbuch_${new Date().toISOString().split('T')[0]}.json`, payload);
    },

    onOpenRestoreImport() {
      restoreImportFile.click();
    },

    onOpenRecipeImport() {
      recipeImportFile.click();
    },

    async onRestoreImportChange() {
      await handleImport('restore', restoreImportFile);
    },

    async onRecipeImportChange() {
      await handleImport('additive', recipeImportFile);
    },

    async onMigrateLocal() {
      try {
        await waitForAppReady();
        const summary = await repository.migrateLegacyLocalData();
        alert(summary.migrated ? buildImportMessage(summary) : 'Keine lokalen Daten für die Migration gefunden.');
        await refreshAppData({ silent: true });
      } catch (error) {
        alert(`Migration fehlgeschlagen: ${error.message}`);
      }
    },

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

    onCloseModal() {
      closeRecipeModal();
    },

    async onToggleModalFavorite() {
      if (!state.currentModalRecipe) return;
      await repository.toggleFavorite(state.currentModalRecipe.id);
      await refreshAppData({ silent: true });
      renderRecipeModal();
    },

    async onModalCooked() {
      if (!state.currentModalRecipe) return;
      await repository.markRecipeCooked(state.currentModalRecipe.id);
      await refreshAppData({ silent: true });
      renderRecipeModal();
    },

    onEditModal() {
      editRecipeModal();
    },

    onModalServingsChange() {
      updateModalServings();
    },

    onConfirmDelete: confirmDelete,

    onCancelDelete() {
      cancelDelete();
    },

    onDeleteOverlayClick(event) {
      if (event.target === deleteConfirm) {
        cancelDelete();
      }
    },

    onRequiredFieldInput(input) {
      formController.updateRequiredFieldValidity(input);
    },

    onRequiredFieldBlur(input) {
      formController.updateRequiredFieldValidity(input);
    },

    onDocumentInput(event) {
      if (event.target.matches('[data-day-picker-search]')) {
        filterDayPicker(event.target.dataset.dayPickerSearch, event.target.value);
      }
    },

    async onDocumentChange(event) {
      if (event.target.matches('[data-day-picker-slot]')) {
        state.activeDayPickerSlot = isValidMealSlot(event.target.value) ? event.target.value : 'abend';
        const day = event.target.dataset.dayPickerSlot;
        const query = document.getElementById(`picker-search-${day}`)?.value || '';
        filterDayPicker(day, query);
        return;
      }

      if (event.target.matches('[data-action="plan-serving"]')) {
        await updatePlanEntryServings(
          event.target.dataset.day,
          Number.parseInt(event.target.dataset.index, 10),
          Number.parseInt(event.target.value, 10),
        );
        return;
      }

      if (event.target.matches('[data-action="plan-slot"]')) {
        await updatePlanEntrySlot(
          event.target.dataset.day,
          Number.parseInt(event.target.dataset.index, 10),
          event.target.value,
        );
      }
    },

    async onDocumentClick(event) {
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
          if (state.latestAppData.capabilities?.canAdmin) {
            recipeImportFile.click();
          }
          return;
        }
      }

      if (state.activeDayPicker && !event.target.closest('.day-add-wrapper')) {
        state.activeDayPicker = null;
        renderPlanner();
      }
    },

    onDocumentKeydown(event) {
      if (deleteDialogController.handleKeydown(event)) return;
      if (modalController.handleKeydown(event)) return;
      if (handleDayPickerKeyboard(event)) return;

      if (event.key !== 'Escape') return;

      if (deleteDialogController.isOpen()) {
        cancelDelete();
        return;
      }

      if (modalController.isOpen()) {
        closeRecipeModal();
        return;
      }

      if (state.activeDayPicker) {
        state.activeDayPicker = null;
        renderPlanner();
      }
    },

    onModalOverlayClick(event) {
      if (event.target === recipeModal) {
        closeRecipeModal();
      }
    },

    async onWindowFocus() {
      if (authService.getSnapshot().accessState === 'signed_in') {
        await refreshAppData({ silent: true });
      }
    },

    async onAuthStateChange(snapshot) {
      renderAuthShell(snapshot);
      if (snapshot.accessState === 'signed_in') {
        await refreshAppData({ silent: true });
      }
    },
  },
});

document.addEventListener('DOMContentLoaded', async () => {
  renderAuthShell(authService.getSnapshot());
  setPlannerOpen(false);

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
