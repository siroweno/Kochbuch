import './styles.css';
import { loadRuntimeConfig } from './bootstrap/runtime-config.js';
import { createAppServices } from './bootstrap/app.js';
import { createUiState } from './ui/state-controller.js';
import { createRecipeFormController } from './ui/recipe-form.js';
import { bindAppEvents } from './ui/events.js';
import { createDialogController } from './ui/modals.js';
import { createAppEventHandlers } from './ui/app-event-handlers.js';
import {
  getFilteredSortedRecipes,
  renderCollectionSummary,
  renderRecipeGrid,
  renderRecipeModalContent,
} from './ui/recipes-view.js';
import {
  getPlannerCandidates,
  buildShoppingListText,
  renderDayPickerItems,
  renderWeekPlanner,
} from './ui/planner-view.js';
import { createEffectsLayer } from './ui/effects-layer.js';
import { createNotificationCenter } from './ui/notifications.js';
import { setVisible } from './ui/view-helpers.js';
import {
  createPlanEntryId,
  createEmptyWeekPlan,
  DAYS,
  getMealSlotLabel,
  getPlannerStats,
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

await loadRuntimeConfig();

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
const summaryFeaturePlannerValue = document.getElementById('summaryFeaturePlannerValue');
const summaryFeatureFavoriteValue = document.getElementById('summaryFeatureFavoriteValue');
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
const uiAnnouncements = document.getElementById('uiAnnouncements');
const notificationStack = document.getElementById('notificationStack');

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
const modalPlannerToggle = document.getElementById('modalPlannerToggle');
const modalPlannerPanel = document.getElementById('modalPlannerPanel');
const modalPlannerDay = document.getElementById('modalPlannerDay');
const modalPlannerSlot = document.getElementById('modalPlannerSlot');
const modalPlannerServings = document.getElementById('modalPlannerServings');
const modalPlannerSaveBtn = document.getElementById('modalPlannerSaveBtn');
const modalPlannerCancelBtn = document.getElementById('modalPlannerCancelBtn');
const modalPlannerFeedback = document.getElementById('modalPlannerFeedback');
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

const reducedMotionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)') || null;
const effectsLayer = createEffectsLayer({
  liveRegion: uiAnnouncements,
  reducedMotion: reducedMotionQuery?.matches || false,
});
const notifications = createNotificationCenter({
  container: notificationStack,
  liveRegion: uiAnnouncements,
});
state.motionMode = reducedMotionQuery?.matches ? 'reduce' : 'full';

function syncBodyScrollLock() {
  const shouldLock = modalController.isOpen() || deleteDialogController.isOpen();
  document.body.style.overflow = shouldLock ? 'hidden' : '';
}

function escapeSelectorValue(value) {
  const stringValue = String(value ?? '');
  return globalThis.CSS?.escape ? globalThis.CSS.escape(stringValue) : stringValue.replace(/"/g, '\\"');
}

function cloneWeekPlan(plan) {
  return JSON.parse(JSON.stringify(plan || createEmptyWeekPlan()));
}

function getActiveWeekPlan() {
  return state.plannerDraftWeekPlan || state.weekPlan;
}

function getTodayDayKey() {
  const mapping = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  return mapping[new Date().getDay()] || 'Mo';
}

function updateMotionMode(reduceMotion) {
  state.motionMode = reduceMotion ? 'reduce' : 'full';
  effectsLayer.setReducedMotion(reduceMotion);
}

function clearLoadingDelay() {
  if (state.loadingDelayTimer) {
    window.clearTimeout(state.loadingDelayTimer);
    state.loadingDelayTimer = null;
  }
}

function setLoadingVisible(visible) {
  state.loadingVisible = visible;
  setVisible(loadingPanel, visible);
}

function syncLoadingPanel(snapshot) {
  if (snapshot.accessState === 'loading') {
    if (state.loadingVisible || state.loadingDelayTimer) return;
    state.loadingDelayTimer = window.setTimeout(() => {
      state.loadingDelayTimer = null;
      if (state.latestAuthSnapshot.accessState === 'loading') {
        setLoadingVisible(true);
      }
    }, 250);
    return;
  }

  clearLoadingDelay();
  setLoadingVisible(false);
}

function announceUi(message) {
  state.uiAnnouncement = String(message || '').trim();
  if (!state.uiAnnouncement) return;
  effectsLayer.announce(state.uiAnnouncement);
}

function setPendingFocusTarget(target) {
  state.pendingFocusTarget = target || null;
}

function getPendingFocusElement(target = state.pendingFocusTarget) {
  if (!target) return null;

  if (target.selector) {
    return document.querySelector(target.selector);
  }

  if (target.type === 'favorite-grid' && target.recipeId) {
    return document.querySelector(`[data-action="toggle-favorite"][data-recipe-id="${escapeSelectorValue(target.recipeId)}"]`);
  }

  if (target.type === 'modal-favorite') {
    return modalFavoriteBtn;
  }

  if (target.type === 'modal-planner-toggle') {
    return modalPlannerToggle;
  }

  if (target.type === 'modal-planner-feedback') {
    return modalPlannerFeedback;
  }

  if (target.type === 'day-picker-trigger' && target.day) {
    return document.querySelector(`[data-action="toggle-day-picker"][data-day="${escapeSelectorValue(target.day)}"]`);
  }

  if (target.type === 'plan-entry' && target.planEntryId) {
    const baseSelector = `[data-plan-entry-id="${escapeSelectorValue(target.planEntryId)}"]`;
    if (target.action) {
      return document.querySelector(`${baseSelector}[data-action="${escapeSelectorValue(target.action)}"]`);
    }
    return document.querySelector(baseSelector);
  }

  return null;
}

function restorePendingFocusTarget() {
  if (!state.pendingFocusTarget) return;
  const target = state.pendingFocusTarget;

  window.requestAnimationFrame(() => {
    const element = getPendingFocusElement(target);
    if (element && typeof element.focus === 'function') {
      element.focus();
      state.pendingFocusTarget = null;
    }
  });
}

function resetPlannerDraftState() {
  state.plannerDraftWeekPlan = null;
  state.dragState = null;
  state.activeMoveEntryId = null;
  state.moveEntryDraftDay = null;
  state.moveEntryDraftSlot = state.lastPlannerSlot || 'abend';
}

function updateSummaryFeatureValues() {
  if (!summaryFeaturePlannerValue || !summaryFeatureFavoriteValue) return;
  const plannerStats = getPlannerStats(state.weekPlan, state.recipes);
  summaryFeaturePlannerValue.textContent = String(plannerStats.entries);
  summaryFeatureFavoriteValue.textContent = String(state.recipes.filter((recipe) => recipe.favorite).length);
}

function ensureModalPlanningDefaults() {
  if (!state.modalPlanningDay) {
    state.modalPlanningDay = getTodayDayKey();
  }
  state.modalPlanningSlot = isValidMealSlot(state.modalPlanningSlot) ? state.modalPlanningSlot : (state.lastPlannerSlot || 'abend');
}

function syncModalPlanningUi() {
  ensureModalPlanningDefaults();
  modalPlannerToggle?.setAttribute('aria-expanded', String(state.modalPlanningOpen));
  if (modalPlannerPanel) {
    modalPlannerPanel.classList.toggle('visible', state.modalPlanningOpen);
    modalPlannerPanel.toggleAttribute('hidden', !state.modalPlanningOpen);
  }
  if (modalPlannerDay) modalPlannerDay.value = state.modalPlanningDay || getTodayDayKey();
  if (modalPlannerSlot) modalPlannerSlot.value = state.modalPlanningSlot || 'abend';
  if (modalPlannerServings) {
    modalPlannerServings.value = String(normalizePositiveInteger(modalPlannerServings.value, state.currentModalServings || 2));
    if (state.currentModalServings) {
      modalPlannerServings.value = String(state.currentModalServings);
    }
  }
  if (modalPlannerFeedback) {
    modalPlannerFeedback.textContent = state.modalPlanningFeedback || '';
    modalPlannerFeedback.tabIndex = -1;
  }
}

function initializeModalPlanningState() {
  state.modalPlanningOpen = false;
  state.modalPlanningDay = getTodayDayKey();
  state.modalPlanningSlot = state.lastPlannerSlot || 'abend';
  state.modalPlanningFeedback = '';
}

function setModalPlanningOpen(open) {
  state.modalPlanningOpen = open;
  if (!open) {
    state.modalPlanningFeedback = state.modalPlanningFeedback || '';
  } else {
    state.modalPlanningFeedback = '';
  }
  syncModalPlanningUi();
}

function findPlanEntryLocation(planEntryId, plan = state.weekPlan) {
  for (const day of DAYS) {
    const index = (plan[day] || []).findIndex((entry) => String(entry.planEntryId || '') === String(planEntryId));
    if (index !== -1) {
      return {
        day,
        index,
        entry: plan[day][index],
      };
    }
  }
  return null;
}

function replaceDayEntries(plan, day, entries) {
  plan[day] = entries;
  return plan;
}

function recomposeDayEntries(entriesBySlot) {
  return ['fruehstueck', 'mittag', 'abend', 'snack']
    .flatMap((slot) => entriesBySlot.get(slot) || []);
}

function movePlanEntryWithinPlan(plan, planEntryId, { day: targetDay, slot: targetSlot, position = null }) {
  const nextPlan = cloneWeekPlan(plan);
  const source = findPlanEntryLocation(planEntryId, nextPlan);
  if (!source || !isValidMealSlot(targetSlot) || !DAYS.includes(targetDay)) {
    return nextPlan;
  }

  const movingEntry = { ...source.entry, slot: targetSlot };
  const sourceSlotEntries = (nextPlan[source.day] || []).filter((entry) => entry.slot === source.entry.slot);
  const sourceSlotIndex = sourceSlotEntries.findIndex((entry) => String(entry.planEntryId || '') === String(planEntryId));
  const sourceEntriesBySlot = new Map();
  const targetEntriesBySlot = source.day === targetDay ? sourceEntriesBySlot : new Map();

  ['fruehstueck', 'mittag', 'abend', 'snack'].forEach((slot) => {
    sourceEntriesBySlot.set(slot, (nextPlan[source.day] || []).filter((entry) => entry.slot === slot && entry.planEntryId !== planEntryId));
    if (source.day !== targetDay) {
      targetEntriesBySlot.set(slot, (nextPlan[targetDay] || []).filter((entry) => entry.slot === slot));
    }
  });

  const targetSlotEntries = [...(targetEntriesBySlot.get(targetSlot) || [])];
  let insertAt = Number.isInteger(position)
    ? Math.max(0, Math.min(position, targetSlotEntries.length))
    : targetSlotEntries.length;
  if (source.day === targetDay && source.entry.slot === targetSlot && sourceSlotIndex !== -1 && insertAt > sourceSlotIndex) {
    insertAt -= 1;
  }
  targetSlotEntries.splice(insertAt, 0, movingEntry);
  targetEntriesBySlot.set(targetSlot, targetSlotEntries);

  replaceDayEntries(nextPlan, source.day, recomposeDayEntries(sourceEntriesBySlot));
  replaceDayEntries(
    nextPlan,
    targetDay,
    source.day === targetDay
      ? recomposeDayEntries(targetEntriesBySlot)
      : recomposeDayEntries(targetEntriesBySlot),
  );

  return nextPlan;
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
  syncLoadingPanel(snapshot);
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
  syncModalPlanningUi();
  restorePendingFocusTarget();
}

function renderRecipes() {
  updateFavoriteFilterButton();
  updateTagFilterPill();
  renderCollectionSummary({
    collectionSummary,
    recipes: state.recipes,
    weekPlan: state.weekPlan,
  });
  updateSummaryFeatureValues();

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

  restorePendingFocusTarget();
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
    weekPlan: getActiveWeekPlan(),
    recipes: state.recipes,
    activeDayPicker: state.activeDayPicker,
    activeDayPickerSlot: state.activeDayPickerSlot,
    activeDayPickerQuery: state.activeDayPickerQuery,
    activeMoveEntryId: state.activeMoveEntryId,
    moveEntryDraftDay: state.moveEntryDraftDay,
    moveEntryDraftSlot: state.moveEntryDraftSlot,
    dragState: state.dragState,
    renderServingOptions: renderPlannerServingOptions,
    renderMealSlotOptions,
  });
  restorePendingFocusTarget();
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
  state.plannerDraftWeekPlan = null;
  state.dragState = null;
  applyRoleUi(result.capabilities?.canAdmin);
  renderRecipes();
  refreshPlannerViews();
  migrateLocalBtn.style.display = result.capabilities?.canAdmin && result.migration?.hasLegacyData && !result.migration?.alreadyMigrated ? '' : 'none';
  restorePendingFocusTarget();
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
  initializeModalPlanningState();
  renderRecipeModal();
  modalController.open({
    trigger: options.trigger || document.activeElement,
  });
}

function closeRecipeModal({ restoreFocus = true } = {}) {
  state.modalPlanningOpen = false;
  state.modalPlanningFeedback = '';
  modalController.close({ restoreFocus });
}

function updateModalServings() {
  if (!state.currentModalRecipe) return;
  state.currentModalServings = normalizePositiveInteger(modalServingsSelect.value, state.currentModalRecipe.baseServings);
  if (modalPlannerServings) {
    modalPlannerServings.value = String(state.currentModalServings);
  }
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
    notifications.error(`Loeschen fehlgeschlagen: ${error.message}`);
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
    setPendingFocusTarget({ type: 'day-picker-trigger', day });
    state.activeDayPicker = null;
  } else {
    state.activeDayPicker = day;
    state.activeDayPickerSlot = state.lastPlannerSlot || 'abend';
    state.activeDayPickerQuery = '';
  }

  renderPlanner();
  if (state.activeDayPicker) {
    focusDayPickerSearch(day);
  }
}

function filterDayPicker(day, query) {
  const list = document.getElementById(`picker-list-${day}`);
  const status = document.getElementById(`picker-status-${day}`);
  const normalizedQuery = String(query || '');
  const matches = getPlannerCandidates({
    recipes: state.recipes,
    query: normalizedQuery,
  });
  state.activeDayPickerQuery = normalizedQuery;
  if (!list) return;
  list.innerHTML = renderDayPickerItems({
    day,
    query: normalizedQuery,
    recipes: state.recipes,
    activeDayPickerSlot: state.activeDayPickerSlot,
  });
  if (status) {
    status.textContent = matches.length
      ? `${matches.length} Rezept${matches.length !== 1 ? 'e' : ''} für ${day} verfügbar.`
      : 'Keine passenden Rezepte gefunden.';
  }
}

async function persistWeekPlan() {
  await repository.saveWeekPlan(state.weekPlan);
  await refreshAppData({ silent: true });
}

async function addToDay(day, recipeId, options = {}) {
  const recipe = state.recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;

  state.weekPlan[day].push({
    planEntryId: createPlanEntryId(),
    recipeId: recipe.id,
    servings: normalizePositiveInteger(options.servings, recipe.baseServings),
    slot: isValidMealSlot(options.slot) ? options.slot : state.activeDayPickerSlot,
  });
  state.lastPlannerSlot = isValidMealSlot(options.slot) ? options.slot : state.activeDayPickerSlot;
  state.activeDayPicker = null;
  state.activeDayPickerQuery = '';
  await persistWeekPlan();
}

async function removeFromDay(planEntryId, fallbackDay, fallbackIndex) {
  const location = planEntryId ? findPlanEntryLocation(planEntryId) : null;
  const day = location?.day || fallbackDay;
  const index = location?.index ?? fallbackIndex;
  if (!day || !Number.isInteger(index) || !state.weekPlan[day]?.[index]) return;
  state.weekPlan[day].splice(index, 1);
  await persistWeekPlan();
}

async function updatePlanEntryServings(planEntryId, fallbackDay, fallbackIndex, servings) {
  const location = planEntryId ? findPlanEntryLocation(planEntryId) : null;
  const day = location?.day || fallbackDay;
  const index = location?.index ?? fallbackIndex;
  if (!state.weekPlan[day] || !state.weekPlan[day][index]) return;
  state.weekPlan[day][index].servings = normalizePositiveInteger(servings, state.weekPlan[day][index].servings);
  await persistWeekPlan();
}

async function updatePlanEntrySlot(planEntryId, fallbackDay, fallbackIndex, slot) {
  const location = planEntryId ? findPlanEntryLocation(planEntryId) : null;
  const day = location?.day || fallbackDay;
  const index = location?.index ?? fallbackIndex;
  if (!state.weekPlan[day] || !state.weekPlan[day][index] || !isValidMealSlot(slot)) return;
  state.weekPlan[day][index].slot = slot;
  state.lastPlannerSlot = slot;
  await persistWeekPlan();
}

async function saveModalPlannerEntry() {
  if (!state.currentModalRecipe) return;
  const day = DAYS.includes(modalPlannerDay.value) ? modalPlannerDay.value : getTodayDayKey();
  const slot = isValidMealSlot(modalPlannerSlot.value) ? modalPlannerSlot.value : (state.lastPlannerSlot || 'abend');
  const servings = normalizePositiveInteger(modalPlannerServings.value, state.currentModalServings || state.currentModalRecipe.baseServings);
  state.modalPlanningFeedback = '';
  await addToDay(day, state.currentModalRecipe.id, {
    slot,
    servings,
  });
  state.modalPlanningOpen = false;
  state.modalPlanningDay = day;
  state.modalPlanningSlot = slot;
  state.modalPlanningFeedback = `Für ${day} · ${getMealSlotLabel(slot)} · ${servings} P. eingeplant.`;
  setPendingFocusTarget({ type: 'modal-planner-feedback' });
  announceUi(state.modalPlanningFeedback);
  renderRecipeModal();
}

function toggleMoveEntryComposer(planEntryId) {
  const location = findPlanEntryLocation(planEntryId, getActiveWeekPlan());
  if (!location) return;

  if (state.activeMoveEntryId === planEntryId) {
    state.activeMoveEntryId = null;
    state.moveEntryDraftDay = null;
    state.moveEntryDraftSlot = state.lastPlannerSlot || 'abend';
  } else {
    state.activeMoveEntryId = planEntryId;
    state.moveEntryDraftDay = location.day;
    state.moveEntryDraftSlot = location.entry.slot;
  }

  renderPlanner();
}

async function confirmMoveEntry(planEntryId) {
  if (!state.activeMoveEntryId || state.activeMoveEntryId !== planEntryId) return;
  const nextDay = DAYS.includes(state.moveEntryDraftDay) ? state.moveEntryDraftDay : getTodayDayKey();
  const nextSlot = isValidMealSlot(state.moveEntryDraftSlot) ? state.moveEntryDraftSlot : 'abend';
  state.weekPlan = movePlanEntryWithinPlan(state.weekPlan, planEntryId, {
    day: nextDay,
    slot: nextSlot,
  });
  state.lastPlannerSlot = nextSlot;
  state.activeMoveEntryId = null;
  setPendingFocusTarget({ type: 'plan-entry', planEntryId, action: 'move-plan-entry' });
  announceUi(`Eintrag nach ${nextDay} · ${getMealSlotLabel(nextSlot)} verschoben.`);
  await persistWeekPlan();
}

function clearDragPreviewClasses() {
  document.querySelectorAll('.chip-drop-zone.is-target').forEach((element) => element.classList.remove('is-target'));
  document.querySelectorAll('.day-recipe-chip.is-dragging').forEach((element) => element.classList.remove('is-dragging'));
}

function setDropZonesVisible(visible) {
  weekPlanner.classList.toggle('planner-drag-active', visible);
  document.querySelectorAll('.chip-drop-zone').forEach((element) => {
    element.classList.toggle('visible', visible);
  });
}

function highlightDropTarget(planEntryId, over) {
  clearDragPreviewClasses();
  if (planEntryId) {
    document.querySelectorAll(`.day-recipe-chip[data-plan-entry-id="${escapeSelectorValue(planEntryId)}"]`).forEach((element) => {
      element.classList.add('is-dragging');
    });
  }
  if (!over) return;
  const selector = `.chip-drop-zone[data-drop-day="${escapeSelectorValue(over.day)}"][data-drop-slot="${escapeSelectorValue(over.slot)}"][data-drop-position="${escapeSelectorValue(over.position)}"]`;
  document.querySelectorAll(selector).forEach((element) => element.classList.add('is-target'));
}

function cancelPendingDrag() {
  if (state.dragState?.holdTimer) {
    window.clearTimeout(state.dragState.holdTimer);
  }
  clearDragPreviewClasses();
  setDropZonesVisible(false);
  state.dragState = null;
  state.plannerDraftWeekPlan = null;
}

function startPlanDrag({ planEntryId, day, index, pointerId, pointerType, clientX, clientY }) {
  state.dragState = {
    planEntryId,
    day,
    index,
    pointerId,
    pointerType,
    active: true,
    holdTimer: null,
    originX: clientX,
    originY: clientY,
    over: null,
  };
  state.plannerDraftWeekPlan = cloneWeekPlan(state.weekPlan);
  setDropZonesVisible(true);
  highlightDropTarget(planEntryId, null);
}

function updateDragTarget(clientX, clientY) {
  if (!state.dragState?.active) return;

  const over = getDropTargetAtPoint(clientX, clientY);
  if (!over) {
    state.dragState.over = null;
    highlightDropTarget(state.dragState.planEntryId, null);
    return;
  }

  state.dragState.over = over;
  highlightDropTarget(state.dragState.planEntryId, state.dragState.over);

  const edgeThreshold = 72;
  if (clientY < edgeThreshold) {
    window.scrollBy({ top: -18, behavior: 'auto' });
  } else if (window.innerHeight - clientY < edgeThreshold) {
    window.scrollBy({ top: 18, behavior: 'auto' });
  }
}

function getDropTargetFromElement(element) {
  const dropZone = element?.closest?.('[data-drop-zone]');
  if (dropZone) {
    return {
      day: dropZone.dataset.dropDay,
      slot: dropZone.dataset.dropSlot,
      position: Number.parseInt(dropZone.dataset.dropPosition, 10),
    };
  }

  const slotSection = element?.closest?.('[data-slot-section]');
  const dayColumn = element?.closest?.('[data-day-column]');
  if (!slotSection || !dayColumn) return null;

  return {
    day: dayColumn.dataset.dayColumn,
    slot: slotSection.dataset.slotSection,
    position: Number.parseInt(slotSection.dataset.slotEntryCount || '0', 10),
  };
}

function getDropTargetAtPoint(clientX, clientY) {
  const pointElement = document.elementFromPoint(clientX, clientY);
  const directTarget = getDropTargetFromElement(pointElement);
  if (directTarget) return directTarget;

  const dayColumn = pointElement?.closest?.('[data-day-column]');
  if (!dayColumn) return null;

  const slotSections = Array.from(dayColumn.querySelectorAll('[data-slot-section]'));
  const matchingSection = slotSections.find((section) => {
    const rect = section.getBoundingClientRect();
    return clientY >= rect.top && clientY <= rect.bottom;
  }) || slotSections
    .map((section) => ({ section, rect: section.getBoundingClientRect() }))
    .sort((a, b) => {
      const distanceA = Math.min(Math.abs(clientY - a.rect.top), Math.abs(clientY - a.rect.bottom));
      const distanceB = Math.min(Math.abs(clientY - b.rect.top), Math.abs(clientY - b.rect.bottom));
      return distanceA - distanceB;
    })[0]?.section;

  if (!matchingSection) return null;

  return {
    day: dayColumn.dataset.dayColumn,
    slot: matchingSection.dataset.slotSection,
    position: Number.parseInt(matchingSection.dataset.slotEntryCount || '0', 10),
  };
}

async function finishPlanDrag(clientX = null, clientY = null) {
  if (!state.dragState?.active) {
    cancelPendingDrag();
    return;
  }

  const { planEntryId } = state.dragState;
  const over = state.dragState.over || (
    typeof clientX === 'number' && typeof clientY === 'number'
      ? getDropTargetAtPoint(clientX, clientY)
      : null
  );
  clearDragPreviewClasses();
  setDropZonesVisible(false);

  if (over && DAYS.includes(over.day) && isValidMealSlot(over.slot)) {
    state.weekPlan = movePlanEntryWithinPlan(state.weekPlan, planEntryId, over);
    state.lastPlannerSlot = over.slot;
    setPendingFocusTarget({ type: 'plan-entry', planEntryId, action: 'start-plan-drag' });
    announceUi(`Eintrag nach ${over.day} · ${getMealSlotLabel(over.slot)} verschoben.`);
    state.dragState = null;
    state.plannerDraftWeekPlan = null;
    await persistWeekPlan();
    return;
  }

  state.dragState = null;
  state.plannerDraftWeekPlan = null;
  renderPlanner();
}

async function toggleFavoriteWithEffect({ recipeId, anchor, surface }) {
  const recipe = state.recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;

  const isLike = !recipe.favorite;
  const anchorRect = anchor?.getBoundingClientRect ? anchor.getBoundingClientRect() : null;

  if (surface === 'modal') {
    setPendingFocusTarget({ type: 'modal-favorite' });
  } else {
    setPendingFocusTarget({ type: 'favorite-grid', recipeId });
  }

  if (isLike) {
    effectsLayer.playFavoriteBurst({
      anchor,
      anchorRect,
      surface,
    });
  } else if (state.motionMode !== 'reduce') {
    effectsLayer.playHeartPop({ anchor, anchorRect });
  }

  await repository.toggleFavorite(recipeId);
  if (!isLike) {
    announceUi('Aus Favoriten entfernt');
  }
  await refreshAppData({ silent: true });
  if (surface === 'modal') {
    renderRecipeModal();
  }
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
    notifications.success(buildImportMessage(summary));
    await refreshAppData({ silent: true });
  } catch (error) {
    notifications.error(`Fehler beim Importieren: ${error.message}`);
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
    setPendingFocusTarget({ type: 'day-picker-trigger', day: state.activeDayPicker });
    state.activeDayPicker = null;
    state.activeDayPickerQuery = '';
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
    modalPlannerToggle,
    modalPlannerSaveBtn,
    modalPlannerCancelBtn,
    modalPlannerDay,
    modalPlannerSlot,
    modalPlannerServings,
    confirmDeleteBtn,
    cancelDeleteBtn,
    deleteConfirm,
    recipeModal,
  },
  requiredFields: REQUIRED_FIELDS,
  authService,
  handlers: createAppEventHandlers({
    DAYS,
    addToDay,
    announceUi,
    askDelete,
    authService,
    browserTestEmail,
    buildImportMessage,
    cancelDelete,
    clearTagFilter,
    closeRecipeForm,
    closeRecipeModal,
    confirmDelete,
    createEmptyWeekPlan,
    deleteConfirm,
    deleteDialogController,
    downloadJson,
    editRecipeModal,
    filterDayPicker,
    formContainer,
    formController,
    getDropTargetFromElement,
    googleLoginBtn,
    handleDayPickerKeyboard,
    handleImport,
    handleRecipeSubmit,
    highlightDropTarget,
    imageFileInput,
    isDataUrl,
    isExternalImageUrl,
    isValidMealSlot,
    loginMessage,
    modalController,
    modalFavoriteBtn,
    modalPlannerDay,
    normalizePositiveInteger,
    notifications,
    openRecipeForm,
    openRecipeModal,
    persistWeekPlan,
    recipeImportFile,
    recipeModal,
    refreshAppData,
    renderAuthShell,
    renderPlanner,
    renderRecipeModal,
    renderRecipes,
    repository,
    resetPlannerDraftState,
    restoreImportFile,
    restorePendingFocusTarget,
    removeFromDay,
    saveModalPlannerEntry,
    setPendingFocusTarget,
    setPlannerOpen,
    shoppingList,
    startPlanDrag,
    state,
    syncModalPlanningUi,
    toggleFavoritesFilter,
    toggleFavoriteWithEffect,
    toggleMoveEntryComposer,
    toggleDayPicker,
    updateDragTarget,
    updateModalServings,
    updatePlanEntryServings,
    updatePlanEntrySlot,
    updatePlannerShoppingList,
    waitForAppReady,
    finishPlanDrag,
    cancelPendingDrag,
    confirmMoveEntry,
    setTagFilter,
  }),
});

if (reducedMotionQuery) {
  const handleReducedMotionChange = (event) => {
    updateMotionMode(event.matches);
  };
  if (typeof reducedMotionQuery.addEventListener === 'function') {
    reducedMotionQuery.addEventListener('change', handleReducedMotionChange);
  } else if (typeof reducedMotionQuery.addListener === 'function') {
    reducedMotionQuery.addListener(handleReducedMotionChange);
  }
}

async function initializeApp() {
  updateMotionMode(reducedMotionQuery?.matches || false);
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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initializeApp().catch((error) => {
      loginMessage.textContent = error.message || 'Die App konnte nicht initialisiert werden.';
    });
  });
} else {
  initializeApp().catch((error) => {
    loginMessage.textContent = error.message || 'Die App konnte nicht initialisiert werden.';
  });
}
