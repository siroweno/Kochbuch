import { loadRuntimeConfig } from './bootstrap/runtime-config.js';
import { createAppServices } from './bootstrap/app.js';
import { createUiState } from './ui/state-controller.js';
import { createRecipeFormController } from './ui/recipe-form.js';
import { getAppDom } from './ui/app-dom.js';
import { bindAppEvents } from './ui/events.js';
import { createDialogController } from './ui/modals.js';
import { createAppEventHandlers } from './ui/app-event-handlers.js';
import { createRecipesController } from './ui/recipes-controller.js';
import { createPlannerController } from './ui/planner-controller.js';
import { createModalRecipeController } from './ui/modal-recipe-controller.js';
import { getPlannerCandidates, renderDayPickerItems } from './ui/planner-view.js';
import { createEffectsLayer } from './ui/effects-layer.js';
import { createNotificationCenter } from './ui/notifications.js';
import { setVisible } from './ui/view-helpers.js';
import {
  createPlanEntryId,
  createEmptyWeekPlan,
  DAYS,
  getMealSlotLabel,
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
import { renderSkeletonRecipes } from './ui/recipes-view.js';

await loadRuntimeConfig();

const { config, authService, repository } = createAppServices();
const state = createUiState(authService);

const dom = getAppDom();
const { shell, auth, recipes, planner, modal, deleteDialog, toolbar } = dom;
const {
  appShell,
  loadingPanel,
  uiAnnouncements,
  notificationStack,
} = shell;
const {
  authBar,
  authBarName,
  authBarMeta,
  signOutBtn,
  loginPanel,
  loginIntro,
  googleLoginActions,
  googleLoginBtn,
  browserTestLoginForm,
  browserTestEmail,
  loginMessage,
  authHint,
  accessPanel,
  accessMessage,
  configPanel,
} = auth;
const {
  toggleFormBtn,
  toggleFavoritesBtn,
  formContainer,
  formTitle,
  recipeForm,
  recipeGrid,
  searchInput,
  sortSelect,
  recipeCount,
  tagFilterPill,
  tagFilterLabel,
  clearTagFilterBtn,
  titleInput,
  servingsInput,
  prepTimeInput,
  cookTimeInput,
  tagsInput,
  imageUrlInput,
  imageFileInput,
  imagePreview,
  previewImg,
  ingredientsInput,
  instructionsInput,
  platingInput,
  tipsInput,
  descriptionInput,
  uploadImageBtn,
  exportBtn,
  restoreImportBtn,
  recipeImportBtn,
  restoreImportFile,
  recipeImportFile,
  migrateLocalBtn,
} = recipes;
const {
  togglePlannerBtn,
  weekPlanner,
  daysGrid,
  shoppingList,
  shoppingSearchInput,
  exportShoppingBtn,
  clearPlanBtn,
} = planner;
const {
  overlay: recipeModal,
  content: recipeModalContent,
  closeBtn: modalCloseBtn,
  favoriteBtn: modalFavoriteBtn,
  editBtn: modalEditBtn,
  cookedBtn: modalCookedBtn,
  cookedStatus: modalCookedStatus,
  servingsSelect: modalServingsSelect,
  image: modalImage,
  title: modalTitle,
  date: modalDate,
  headerMeta: modalHeaderMeta,
  description: modalDescription,
  ingredients: modalIngredients,
  instructions: modalInstructions,
  plating: modalPlating,
  tips: modalTips,
  plannerToggle: modalPlannerToggle,
  plannerPanel: modalPlannerPanel,
  plannerDay: modalPlannerDay,
  plannerSlot: modalPlannerSlot,
  plannerServings: modalPlannerServings,
  plannerSaveBtn: modalPlannerSaveBtn,
  plannerCancelBtn: modalPlannerCancelBtn,
  plannerFeedback: modalPlannerFeedback,
  descriptionSection,
  platingWrapper,
  tipsSection,
} = modal;
const {
  overlay: deleteConfirm,
  content: deleteConfirmBox,
  name: deleteConfirmName,
  confirmBtn: confirmDeleteBtn,
  cancelBtn: cancelDeleteBtn,
} = deleteDialog;

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

const modalRecipeController = createModalRecipeController({
  state,
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
  getCanAdmin: () => Boolean(state.latestAppData.capabilities?.canAdmin),
  renderServingOptions: renderModalServingOptions,
  syncModalPlanningUi,
  restorePendingFocusTarget,
});

const recipesController = createRecipesController({
  state,
  elements: {
    toggleFavoritesBtn,
    tagFilterPill,
    tagFilterLabel,
    recipeGrid,
    recipeCount,
    searchInput,
    sortSelect,
  },
  getCanAdmin: () => Boolean(state.latestAppData.capabilities?.canAdmin),
  modalController,
  modalRecipeController,
  restorePendingFocusTarget,
});

const plannerController = createPlannerController({
  state,
  elements: {
    daysGrid,
    shoppingList,
    shoppingSearchInput,
  },
  getActiveWeekPlan,
  renderServingOptions: renderPlannerServingOptions,
  renderMealSlotOptions,
  restorePendingFocusTarget,
});

const renderRecipeModal = () => modalRecipeController.render();
const renderRecipes = () => recipesController.render();
const renderPlanner = () => plannerController.render();
const updatePlannerShoppingList = () => plannerController.updateShoppingList();
const refreshPlannerViews = () => plannerController.refresh();

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
  // Login-Panel: animierter Übergang beim Einloggen
  if (snapshot.accessState !== 'signed_out' && loginPanel.classList.contains('visible')) {
    // Statt sofort: animierte Buchseiten-Wende
    loginPanel.classList.add('closing');
    loginPanel.addEventListener('animationend', () => {
      loginPanel.classList.remove('visible', 'closing');
      loginPanel.style.display = 'none';
    }, { once: true });
  } else {
    setVisible(loginPanel, snapshot.accessState === 'signed_out');
  }
  syncLoadingPanel(snapshot);
  setVisible(accessPanel, snapshot.accessState === 'no_access');
  setVisible(configPanel, snapshot.accessState === 'config_missing');
  // App-Shell: animiertes Aufdecken beim Einloggen
  if (snapshot.accessState === 'signed_in' && appShell.classList.contains('app-shell-hidden')) {
    appShell.classList.remove('app-shell-hidden');
    appShell.classList.add('app-shell-opening');
    appShell.addEventListener('animationend', () => {
      appShell.classList.remove('app-shell-opening');
    }, { once: true });
  } else {
    appShell.classList.toggle('app-shell-hidden', snapshot.accessState !== 'signed_in');
  }
  applyRoleUi(snapshot.canAdmin);
}

function applyLoadResult(result, { scope = 'full' } = {}) {
  state.latestAppData = result;
  state.recipes = result.recipes || [];
  state.recipeLookup = new Map(state.recipes.map((recipe) => [String(recipe.id), recipe]));
  state.weekPlan = result.weekPlan || createEmptyWeekPlan();
  state.plannerDraftWeekPlan = null;
  state.dragState = null;
  applyRoleUi(result.capabilities?.canAdmin);

  if (scope === 'planner') {
    plannerController.refresh();
  } else if (scope === 'recipes') {
    recipesController.render();
    if (state.plannerOpen) {
      plannerController.render();
    }
  } else {
    recipesController.render();
    plannerController.refresh();
  }

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
  recipesController.render();
}

function setTagFilter(tag) {
  if (state.activeTagFilter === tag) {
    clearTagFilter();
    return;
  }

  state.activeTagFilter = tag;
  recipesController.render();
}

function toggleFavoritesFilter() {
  state.favoriteFilterActive = !state.favoriteFilterActive;
  recipesController.render();
}

function openRecipeModal(recipeId, options = {}) {
  const recipe = state.recipeLookup.get(String(recipeId)) || state.recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;
  state.currentModalRecipe = recipe;
  state.currentModalServings = normalizePositiveInteger(options.servings, recipe.baseServings);
  initializeModalPlanningState();
  modalRecipeController.render();
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
  modalRecipeController.render();
}

function editRecipeModal() {
  if (!state.currentModalRecipe || !state.latestAppData.capabilities?.canAdmin) return;
  const recipe = state.currentModalRecipe;
  closeRecipeModal({ restoreFocus: false });
  state.editingRecipeId = recipe.id;
  formController.prefillRecipeForm(recipe);
}

function askDelete(recipeId, trigger = null) {
  const recipe = state.recipeLookup.get(String(recipeId)) || state.recipes.find((item) => item.id === String(recipeId));
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
    const result = await repository.deleteRecipe(recipeId);
    deleteDialogController.close();
    applyLoadResult(result);
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

  plannerController.render();
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
  const result = await repository.saveWeekPlan(state.weekPlan);
  applyLoadResult(result, { scope: 'planner' });
}

async function addToDay(day, recipeId, options = {}) {
  const recipe = state.recipeLookup.get(String(recipeId)) || state.recipes.find((item) => item.id === String(recipeId));
  if (!recipe) return;

  const previousWeekPlan = JSON.parse(JSON.stringify(state.weekPlan));

  state.weekPlan[day].push({
    planEntryId: createPlanEntryId(),
    recipeId: recipe.id,
    servings: normalizePositiveInteger(options.servings, recipe.baseServings),
    slot: isValidMealSlot(options.slot) ? options.slot : state.activeDayPickerSlot,
  });
  state.lastPlannerSlot = isValidMealSlot(options.slot) ? options.slot : state.activeDayPickerSlot;
  state.activeDayPicker = null;
  state.activeDayPickerQuery = '';
  plannerController.render();
  updatePlannerShoppingList();

  persistWeekPlan().catch(() => {
    state.weekPlan = previousWeekPlan;
    plannerController.render();
    updatePlannerShoppingList();
    notifications.error('Konnte nicht gespeichert werden.');
  });
}

function removeFromDay(planEntryId, fallbackDay, fallbackIndex) {
  const location = planEntryId ? findPlanEntryLocation(planEntryId) : null;
  const day = location?.day || fallbackDay;
  const index = location?.index ?? fallbackIndex;
  if (!day || !Number.isInteger(index) || !state.weekPlan[day]?.[index]) return;

  const previousWeekPlan = JSON.parse(JSON.stringify(state.weekPlan));
  state.weekPlan[day].splice(index, 1);
  plannerController.render();
  updatePlannerShoppingList();

  persistWeekPlan().catch(() => {
    state.weekPlan = previousWeekPlan;
    plannerController.render();
    updatePlannerShoppingList();
    notifications.error('Konnte nicht gespeichert werden.');
  });
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
  addToDay(day, state.currentModalRecipe.id, {
    slot,
    servings,
  });
  state.modalPlanningOpen = false;
  state.modalPlanningDay = day;
  state.modalPlanningSlot = slot;
  state.modalPlanningFeedback = `Für ${day} · ${getMealSlotLabel(slot)} · ${servings} P. eingeplant.`;
  setPendingFocusTarget({ type: 'modal-planner-feedback' });
  announceUi(state.modalPlanningFeedback);
  modalRecipeController.render();
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

  plannerController.render();
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

function removeGhost() {
  const ghost = state.dragState?.ghost;
  if (!ghost) return;

  const targetZone = document.querySelector('.chip-drop-zone.is-target');
  if (targetZone) {
    // Ghost gleitet zur Drop-Zone
    const rect = targetZone.getBoundingClientRect();
    ghost.style.transition = 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)';
    ghost.style.left = `${rect.left + rect.width / 2 - ghost.offsetWidth / 2}px`;
    ghost.style.top = `${rect.top}px`;
    ghost.style.transform = 'scale(0.6) rotate(0deg)';
    ghost.style.opacity = '0.4';
  } else {
    ghost.style.transition = 'all 0.2s ease';
    ghost.style.opacity = '0';
    ghost.style.transform = 'rotate(6deg) scale(0.8)';
  }
  setTimeout(() => ghost.remove(), 300);
  state.dragState.ghost = null;
}

function cancelPendingDrag() {
  if (state.dragState?.holdTimer) {
    window.clearTimeout(state.dragState.holdTimer);
  }
  removeGhost();
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
  // Ghost erstellen
  const chipEl = document.querySelector(`[data-action="start-plan-drag"][data-plan-entry-id="${planEntryId}"]`)?.closest('.day-recipe-chip');
  if (chipEl) {
    const rect = chipEl.getBoundingClientRect();
    const ghost = chipEl.cloneNode(true);
    ghost.classList.add('drag-ghost');
    ghost.removeAttribute('data-action');
    ghost.style.cssText = `
      position: fixed;
      left: ${rect.left}px;
      top: ${rect.top}px;
      width: ${rect.width}px;
      pointer-events: none;
      z-index: 1000;
    `;
    document.body.appendChild(ghost);
    state.dragState.ghost = ghost;
    state.dragState.ghostOffsetX = clientX - rect.left;
    state.dragState.ghostOffsetY = clientY - rect.top;
  }
}

function updateDragTarget(clientX, clientY) {
  if (!state.dragState?.active) return;
  // Ghost dem Cursor folgen lassen
  const ghost = state.dragState?.ghost;
  if (ghost) {
    ghost.style.left = `${clientX - state.dragState.ghostOffsetX}px`;
    ghost.style.top = `${clientY - state.dragState.ghostOffsetY}px`;
  }

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
    removeGhost();
    state.dragState = null;
    state.plannerDraftWeekPlan = null;
    await persistWeekPlan();
    return;
  }

  removeGhost();
  state.dragState = null;
  state.plannerDraftWeekPlan = null;
  plannerController.render();
}

function toggleFavoriteWithEffect({ recipeId, anchor, surface }) {
  const recipe = state.recipeLookup.get(String(recipeId)) || state.recipes.find((item) => item.id === String(recipeId));
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

  // Optimistic update: flip favorite immediately
  recipe.favorite = isLike;
  recipesController.render();
  if (state.currentModalRecipe?.id === String(recipeId)) {
    renderRecipeModal();
  }
  if (!isLike) {
    announceUi('Aus Favoriten entfernt');
  }

  repository.toggleFavorite(recipeId)
    .then((result) => {
      applyLoadResult(result, { scope: 'recipes' });
    })
    .catch(() => {
      // Rollback
      recipe.favorite = !isLike;
      recipesController.render();
      if (state.currentModalRecipe?.id === String(recipeId)) {
        renderRecipeModal();
      }
      notifications.error('Favorit konnte nicht gespeichert werden.');
    });
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

  const result = await repository.saveRecipe({
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
  applyLoadResult(result);
}

function handleDayPickerKeyboard(event) {
  if (!state.activeDayPicker) return false;

  if (event.key === 'Escape' && event.target.closest('.day-picker')) {
    event.preventDefault();
    setPendingFocusTarget({ type: 'day-picker-trigger', day: state.activeDayPicker });
    state.activeDayPicker = null;
    state.activeDayPickerQuery = '';
    plannerController.render();
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
    toolbarToggle: toolbar.toolbarToggle,
    toolbarClose: toolbar.toolbarClose,
    toolbarOverlay: toolbar.toolbarOverlay,
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
    applyLoadResult,
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
    toolbar,
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
    // Skeletons zeigen während Rezepte laden
    if (recipeGrid) {
      renderSkeletonRecipes(recipeGrid, 8);
    }
    await refreshAppData({ silent: true });
  } else if (snapshot.accessState === 'signed_out' && config.backend === 'browser-test') {
    browserTestEmail.value = 'admin@kochbuch.local';
  }

  // Cursor "Umrühr"-Animation mit Partikeln beim Klicken
  document.addEventListener('mousedown', (e) => {
    document.body.classList.add('cursor-stir');

    // Partikel-Burst am Klickpunkt
    const colors = ['#d4a574', '#c9956f', '#e8c99a', '#b8844a', '#dbb07a'];
    for (let i = 0; i < 6; i++) {
      const particle = document.createElement('div');
      particle.className = 'stir-particle';
      const angle = (Math.PI * 2 * i) / 6 + (Math.random() - 0.5) * 0.8;
      const distance = 14 + Math.random() * 18;
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      particle.style.left = `${e.clientX - 3}px`;
      particle.style.top = `${e.clientY - 3}px`;
      particle.style.setProperty('--dx', `${dx}px`);
      particle.style.setProperty('--dy', `${dy}px`);
      particle.style.background = colors[i % colors.length];
      particle.style.width = `${3 + Math.random() * 4}px`;
      particle.style.height = particle.style.width;
      document.body.appendChild(particle);
      particle.addEventListener('animationend', () => particle.remove());
    }
  });

  document.addEventListener('mouseup', () => {
    setTimeout(() => document.body.classList.remove('cursor-stir'), 150);
  });

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
