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
import { createEffectsLayer } from './ui/effects-layer.js';
import { createBackgroundParticles } from './ui/bg-particles.js';
import { createNotificationCenter } from './ui/notifications.js';
import { setVisible } from './ui/view-helpers.js';
import {
  createEmptyWeekPlan,
  DAYS,
  isDataUrl,
  isExternalImageUrl,
  isValidMealSlot,
  normalizeMultilineText,
  normalizePositiveInteger,
  parseIngredientsText,
  readLegacyLocalSnapshot,
  renderMealSlotOptions,
  RECIPE_CATEGORIES,
} from './cookbook-schema.js';
import { renderSkeletonRecipes } from './ui/recipes-view.js';
import { renderPlannerServingOptions, renderModalServingOptions } from './ui/serving-options.js';
import { createFocusManager } from './ui/focus-manager.js';
import { createLoadingController } from './ui/loading-controller.js';
import { createAuthShellController } from './ui/auth-shell.js';
import { createTagBarController } from './ui/tag-bar-controller.js';
import { createDataController } from './ui/data-controller.js';
import { createPlannerActions } from './ui/planner-actions.js';
import { createDragDropController } from './ui/drag-drop-controller.js';
import { createRecipeModalActions } from './ui/recipe-modal-actions.js';
import { downloadJson, buildImportMessage, createImportExportController } from './ui/import-export.js';
import { createFavoriteController } from './ui/favorite-controller.js';
import { initializeCursorEffects } from './ui/cursor-effects.js';
import { initializeHeaderScroll } from './ui/header-scroll.js';
import { initializeUserMenu } from './ui/user-menu.js';
import { createShoppingListController } from './ui/shopping-list.js';

await loadRuntimeConfig();

const { config, authService, repository } = createAppServices();
const state = createUiState(authService);

const dom = getAppDom();
const { shell, auth, recipes, planner, modal, deleteDialog, clearPlanDialog, toolbar } = dom;
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
  topBarFavoritesBtn,
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
  categorySelect,
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
  tagBar,
  tagBarList,
  tagBarExpand,
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
  ingredientsToggle,
  ingredientsCount,
  notesSection,
  platingNote,
  tipsNote,
} = modal;
const {
  overlay: deleteConfirm,
  content: deleteConfirmBox,
  name: deleteConfirmName,
  confirmBtn: confirmDeleteBtn,
  cancelBtn: cancelDeleteBtn,
} = deleteDialog;
const {
  overlay: clearPlanConfirm,
  content: clearPlanConfirmBox,
  confirmBtn: confirmClearPlanBtn,
  cancelBtn: cancelClearPlanBtn,
} = clearPlanDialog;

const focusManager = createFocusManager({
  state,
  dom: { modalFavoriteBtn, modalPlannerToggle, modalPlannerFeedback, daysGrid, modalEditBtn, weekPlanner },
});
const { setPendingFocusTarget, restorePendingFocusTarget } = focusManager;

const loadingController = createLoadingController({ state, dom: { loadingPanel }, setVisible });

const REQUIRED_FIELDS = new Map([
  [titleInput, 'Bitte gib einen Rezeptnamen ein.'],
  [ingredientsInput, 'Bitte trage mindestens eine Zutat ein.'],
  [instructionsInput, 'Bitte trage eine Zubereitung ein.'],
]);

// Populate category dropdown from RECIPE_CATEGORIES
RECIPE_CATEGORIES.forEach((cat) => {
  const option = document.createElement('option');
  option.value = cat.id;
  option.textContent = `${cat.icon} ${cat.label}`;
  categorySelect.appendChild(option);
});

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
    categorySelect,
    tagsInput,
    descriptionInput,
    ingredientsInput,
    instructionsInput,
    platingInput,
    tipsInput,
    formTitle,
  },
  requiredFields: REQUIRED_FIELDS,
  recipeCategories: RECIPE_CATEGORIES,
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

function updateMotionMode(reduceMotion) {
  state.motionMode = reduceMotion ? 'reduce' : 'full';
  effectsLayer.setReducedMotion(reduceMotion);
}

function announceUi(message) {
  state.uiAnnouncement = String(message || '').trim();
  if (!state.uiAnnouncement) return;
  effectsLayer.announce(state.uiAnnouncement);
}

// syncBodyScrollLock is a standalone function — no circular dependency.
// Dialog controllers reference it in callbacks; authShell also exposes it.
const dialogs = {};
function syncBodyScrollLock() {
  const shouldLock = dialogs.modal?.isOpen() || dialogs.delete?.isOpen() || dialogs.clearPlan?.isOpen();
  document.body.style.overflow = shouldLock ? 'hidden' : '';
}

const modalController = createDialogController({
  overlay: recipeModal,
  content: recipeModalContent,
  appShell,
  initialFocus: () => modalCloseBtn,
  onOpen: () => syncBodyScrollLock(),
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
  onOpen: () => syncBodyScrollLock(),
  onClose: () => {
    state.pendingDeleteId = null;
    syncBodyScrollLock();
  },
});

const clearPlanDialogController = createDialogController({
  overlay: clearPlanConfirm,
  content: clearPlanConfirmBox,
  appShell,
  initialFocus: () => cancelClearPlanBtn,
  onOpen: () => syncBodyScrollLock(),
  onClose: () => syncBodyScrollLock(),
});

// Wire dialogs object now that controllers exist
dialogs.modal = modalController;
dialogs.delete = deleteDialogController;
dialogs.clearPlan = clearPlanDialogController;

const authShell = createAuthShellController({
  state,
  config,
  dom: {
    loginPanel,
    loginMessage,
    loginIntro,
    authHint,
    accessPanel,
    accessMessage,
    configPanel,
    appShell,
    authBar,
    authBarName,
    authBarMeta,
    googleLoginActions,
    browserTestLoginForm,
  },
  loadingController,
});

// Lazy-resolved references for circular controller dependencies.
// These callbacks are only invoked at runtime (not during init), so the
// actual controllers are guaranteed to exist when the callbacks fire.
const lazy = {};


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
    ingredientsToggle,
    ingredientsCount,
    notesSection,
    platingNote,
    tipsNote,
  },
  getCanAdmin: () => Boolean(state.latestAppData.capabilities?.canAdmin),
  renderServingOptions: renderModalServingOptions,
  syncModalPlanningUi: (...args) => lazy.recipeModalActions.syncModalPlanningUi(...args),
  syncIngredientsToggleUi: () => lazy.syncIngredientsToggleUi(),
  restorePendingFocusTarget,
});

const recipesController = createRecipesController({
  state,
  elements: {
    toggleFavoritesBtn,
    topBarFavoritesBtn,
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
  getActiveWeekPlan: () => lazy.plannerActions.getActiveWeekPlan(),
  renderServingOptions: renderPlannerServingOptions,
  renderMealSlotOptions,
  restorePendingFocusTarget,
});

const renderRecipeModal = () => modalRecipeController.render();
const renderRecipes = () => recipesController.render();
const renderPlanner = () => plannerController.render();
const updatePlannerShoppingList = () => plannerController.updateShoppingList();

// --- Phase 4 new controllers ---

const tagBarController = createTagBarController({
  state,
  dom: { tagBarList, tagBarExpand, tagBar, tagFilterPill, tagFilterLabel, clearTagFilterBtn, toggleFavoritesBtn, topBarFavoritesBtn },
  recipesController,
});

const dataController = createDataController({
  state,
  repository,
  authService,
  authShell,
  recipesController,
  plannerController,
  tagBarController,
  focusManager,
  updatePlannerShoppingList,
  dom: { migrateLocalBtn },
});

const plannerActions = createPlannerActions({
  state,
  dom: { weekPlanner, togglePlannerBtn },
  repository,
  plannerController,
  notifications,
  focusManager,
  dataController,
  updatePlannerShoppingList,
  announceUi,
});
lazy.plannerActions = plannerActions;

const dragDropController = createDragDropController({
  state,
  dom: { weekPlanner },
  plannerController,
  focusManager,
  plannerActions,
  announceUi,
});

const recipeModalActions = createRecipeModalActions({
  state,
  dom: {
    modalPlannerToggle,
    modalPlannerPanel,
    modalPlannerDay,
    modalPlannerSlot,
    modalPlannerServings,
    modalPlannerFeedback,
    modalServingsSelect,
    deleteConfirmName,
    confirmDeleteBtn,
  },
  modalController,
  deleteDialogController,
  modalRecipeController,
  formController,
  focusManager,
  plannerActions,
  notifications,
  dataController,
  repository,
  announceUi,
});
lazy.recipeModalActions = recipeModalActions;

const favoriteController = createFavoriteController({
  state,
  repository,
  effectsLayer,
  recipesController,
  modalRecipeController,
  notifications,
  focusManager,
  dataController,
  announceUi,
});

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

const importExportController = createImportExportController({
  state,
  repository,
  formController,
  notifications,
  dataController,
  closeRecipeForm,
  normalizeMultilineText,
  isExternalImageUrl,
  normalizePositiveInteger,
  parseIngredientsText,
  ingredientsInput,
  imageUrlInput,
  titleInput,
  servingsInput,
  prepTimeInput,
  cookTimeInput,
  descriptionInput,
  instructionsInput,
  platingInput,
  tipsInput,
});

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

  const items = Array.from(document.querySelectorAll(`#picker-list-${state.activeDayPicker} .planner-day-picker-item[data-action="add-to-day"]`));
  if (!items.length) return false;

  if (event.target.matches('[data-day-picker-search]') && event.key === 'ArrowDown') {
    event.preventDefault();
    items[0].focus();
    return true;
  }

  if (!event.target.classList.contains('planner-day-picker-item')) {
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
    topBarFavoritesBtn,
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
    confirmClearPlanBtn,
    cancelClearPlanBtn,
    clearPlanConfirm,
    recipeModal,
    toolbarToggle: toolbar.toolbarToggle,
    toolbarClose: toolbar.toolbarClose,
    toolbarOverlay: toolbar.toolbarOverlay,
  },
  requiredFields: REQUIRED_FIELDS,
  authService,
  handlers: createAppEventHandlers({
    DAYS,
    addToDay: (...args) => plannerActions.addToDay(...args),
    announceUi,
    askDelete: (...args) => recipeModalActions.askDelete(...args),
    authService,
    browserTestEmail,
    buildImportMessage,
    cancelDelete: () => recipeModalActions.cancelDelete(),
    clearTagFilter: () => tagBarController.clearTagFilter(),
    closeRecipeForm,
    closeRecipeModal: (...args) => recipeModalActions.closeRecipeModal(...args),
    confirmDelete: () => recipeModalActions.confirmDelete(),
    createEmptyWeekPlan,
    deleteConfirm,
    clearPlanDialogController,
    deleteDialogController,
    downloadJson,
    editRecipeModal: () => recipeModalActions.editRecipeModal(),
    filterDayPicker: (...args) => plannerActions.filterDayPicker(...args),
    formContainer,
    formController,
    getDropTargetFromElement: (...args) => dragDropController.getDropTargetFromElement(...args),
    googleLoginBtn,
    handleDayPickerKeyboard,
    handleImport: (...args) => importExportController.handleImport(...args),
    handleRecipeSubmit: (...args) => importExportController.handleRecipeSubmit(...args),
    highlightDropTarget: (...args) => dragDropController.highlightDropTarget(...args),
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
    openRecipeModal: (...args) => recipeModalActions.openRecipeModal(...args),
    persistWeekPlan: () => plannerActions.persistWeekPlan(),
    recipeImportFile,
    recipeModal,
    applyLoadResult: (...args) => dataController.applyLoadResult(...args),
    refreshAppData: (...args) => dataController.refreshAppData(...args),
    renderAuthShell: (...args) => authShell.renderAuthShell(...args),
    runMirageTransition: (...args) => authShell.runMirageTransition(...args),
    showMirageOverlay: () => authShell.showMirageOverlay(),
    isMirageTransitionActive: () => authShell.isMirageTransitionActive(),
    renderPlanner,
    renderRecipeModal,
    renderRecipes,
    repository,
    resetPlannerDraftState: () => plannerActions.resetPlannerDraftState(),
    restoreImportFile,
    restorePendingFocusTarget,
    removeFromDay: (...args) => plannerActions.removeFromDay(...args),
    saveModalPlannerEntry: () => recipeModalActions.saveModalPlannerEntry(),
    setPendingFocusTarget,
    setPlannerOpen: (...args) => plannerActions.setPlannerOpen(...args),
    shoppingList,
    startPlanDrag: (...args) => dragDropController.startPlanDrag(...args),
    state,
    syncModalPlanningUi: (...args) => recipeModalActions.syncModalPlanningUi(...args),
    toggleFavoritesFilter: () => tagBarController.toggleFavoritesFilter(),
    toggleFavoriteWithEffect: (...args) => favoriteController.toggleFavoriteWithEffect(...args),
    toggleMoveEntryComposer: (...args) => plannerActions.toggleMoveEntryComposer(...args),
    toggleDayPicker: (...args) => plannerActions.toggleDayPicker(...args),
    updateDragTarget: (...args) => dragDropController.updateDragTarget(...args),
    updateModalServings: () => recipeModalActions.updateModalServings(),
    updatePlanEntryServings: (...args) => plannerActions.updatePlanEntryServings(...args),
    updatePlanEntrySlot: (...args) => plannerActions.updatePlanEntrySlot(...args),
    updatePlannerShoppingList,
    waitForAppReady: () => dataController.waitForAppReady(),
    finishPlanDrag: (...args) => dragDropController.finishPlanDrag(...args),
    cancelPendingDrag: () => dragDropController.cancelPendingDrag(),
    confirmMoveEntry: (...args) => plannerActions.confirmMoveEntry(...args),
    setTagFilter: (...args) => tagBarController.setTagFilter(...args),
    toolbar,
  }),
});

// Tag bar: expand/collapse toggle
if (tagBarExpand) {
  tagBarExpand.addEventListener('click', () => {
    tagBar.classList.toggle('expanded');
    tagBarController.renderTagBar();
  });
}

// Tag bar: delegate click on tags — handled by onDocumentClick in app-event-handlers.js

// Ingredients toggle in recipe modal
function syncIngredientsToggleUi() {
  const wrapper = document.getElementById('modalIngredientsWrapper');
  if (wrapper) wrapper.classList.toggle('ingredients-expanded', state.modalIngredientsExpanded);
  if (ingredientsToggle) ingredientsToggle.setAttribute('aria-expanded', String(state.modalIngredientsExpanded));
}
lazy.syncIngredientsToggleUi = syncIngredientsToggleUi;
if (ingredientsToggle) {
  ingredientsToggle.addEventListener('click', () => {
    state.modalIngredientsExpanded = !state.modalIngredientsExpanded;
    syncIngredientsToggleUi();
  });
}

// ── Shopping List Overlay ──
const shoppingFab = document.getElementById('shoppingFab');
const shoppingFabBadge = document.getElementById('shoppingFabBadge');
const shoppingOverlay = document.getElementById('shoppingOverlay');
const shoppingOverlayBody = document.getElementById('shoppingOverlayBody');
const shoppingProgress = document.getElementById('shoppingProgress');
const shoppingClose = document.getElementById('shoppingClose');
const shoppingClearBtn = document.getElementById('shoppingClearBtn');
const shoppingShareBtn = document.getElementById('shoppingShareBtn');

let shoppingController = null;

function refreshShoppingList() {
  // Keep checked state from existing controller if available
  const existingChecked = shoppingController?.getCheckedKeys?.() || null;
  shoppingController = createShoppingListController({
    weekPlan: state.weekPlan,
    recipes: state.recipes,
    recipeLookup: state.recipeLookup,
    initialChecked: existingChecked || state.latestAppData?.checkedItems || null,
  });
  shoppingController.setOverlayElements({
    overlay: shoppingOverlay,
    body: shoppingOverlayBody,
    progress: shoppingProgress,
  });
  shoppingController.build();

  // Update FAB visibility + badge
  const hasItems = shoppingController.hasItems();
  if (shoppingFab) {
    shoppingFab.classList.toggle('has-items', hasItems);
  }
  if (shoppingFabBadge) {
    const total = shoppingController.getTotalCount();
    shoppingFabBadge.textContent = String(total);
    shoppingFabBadge.style.display = total > 0 ? '' : 'none';
  }
}

function openShoppingOverlay() {
  refreshShoppingList();
  shoppingController.render(shoppingOverlayBody);
  shoppingOverlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeShoppingOverlay() {
  shoppingOverlay.classList.remove('visible');
  document.body.style.overflow = '';
}

if (shoppingFab) {
  shoppingFab.addEventListener('click', openShoppingOverlay);
}
if (shoppingClose) {
  shoppingClose.addEventListener('click', closeShoppingOverlay);
}
if (shoppingOverlay) {
  shoppingOverlay.addEventListener('click', (e) => {
    if (e.target === shoppingOverlay) closeShoppingOverlay();
  });
}
if (shoppingClearBtn) {
  shoppingClearBtn.addEventListener('click', () => {
    if (shoppingController) {
      shoppingController.clearChecked();
    }
  });
}
if (shoppingShareBtn) {
  shoppingShareBtn.addEventListener('click', () => {
    if (!shoppingController) return;
    const text = shoppingController.getPlainText();
    if (!text.trim()) return;
    if (navigator.share) {
      navigator.share({ title: 'Einkaufsliste', text }).catch(() => {});
    } else {
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `einkaufsliste_${new Date().toISOString().split('T')[0]}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
    }
  });
}
const shoppingSaveBtn = document.getElementById('shoppingSaveBtn');
if (shoppingSaveBtn) {
  shoppingSaveBtn.addEventListener('click', async () => {
    if (shoppingController) {
      const items = shoppingController.getCheckedKeys();
      shoppingSaveBtn.disabled = true;
      shoppingSaveBtn.textContent = 'Wird gespeichert...';
      try {
        await repository.saveCheckedItems(items);
        // Update local state so next open preserves checks
        if (state.latestAppData) state.latestAppData.checkedItems = items;
        shoppingSaveBtn.textContent = '✓ Gespeichert!';
        setTimeout(() => {
          closeShoppingOverlay();
          shoppingSaveBtn.textContent = '✓ Speichern & Schließen';
          shoppingSaveBtn.disabled = false;
        }, 600);
      } catch (_error) {
        shoppingSaveBtn.textContent = 'Fehler – nochmal versuchen';
        shoppingSaveBtn.disabled = false;
      }
    } else {
      closeShoppingOverlay();
    }
  });
}
if (shoppingOverlayBody) {
  shoppingOverlayBody.addEventListener('click', (e) => {
    const item = e.target.closest('[data-shopping-key]');
    if (item && shoppingController) {
      shoppingController.toggleItem(item.dataset.shoppingKey);
    }
  });
}

// Hook into planner updates to refresh FAB badge
const _origUpdateShoppingList = plannerController.updateShoppingList.bind(plannerController);
plannerController.updateShoppingList = function () {
  _origUpdateShoppingList();
  refreshShoppingList();
};

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
  authShell.renderAuthShell(authService.getSnapshot());
  plannerActions.setPlannerOpen(false);

  await authService.initialize();
  const snapshot = authService.getSnapshot();
  authShell.renderAuthShell(snapshot);

  if (snapshot.accessState === 'signed_in') {
    // Skeletons zeigen während Rezepte laden
    if (recipeGrid) {
      renderSkeletonRecipes(recipeGrid, 8);
    }
    await dataController.refreshAppData({ silent: true });
    refreshShoppingList();
    window.scrollTo(0, 0);
  } else if (snapshot.accessState === 'signed_out' && config.backend === 'browser-test') {
    browserTestEmail.value = 'admin@kochbuch.local';
  }

  /* eslint-disable no-unused-vars -- retained for future teardown */
  const _bgParticles = createBackgroundParticles();
  const _cursorEffects = initializeCursorEffects();
  /* eslint-enable no-unused-vars */

  const legacySnapshot = readLegacyLocalSnapshot(window.localStorage);
  if (legacySnapshot.hasLegacyData && snapshot.accessState !== 'signed_in') {
    loginMessage.textContent = config.backend === 'browser-test'
      ? 'Lokale Kochbuchdaten gefunden. Nach dem Test-Login kann die Einmal-Migration gestartet werden.'
      : 'Lokale Kochbuchdaten gefunden. Nach dem Google-Login kann die Einmal-Migration gestartet werden.';
  }

  /* eslint-disable no-unused-vars -- retained for future teardown */
  const _headerScroll = initializeHeaderScroll();
  const _userMenu = initializeUserMenu();
  /* eslint-enable no-unused-vars */
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
