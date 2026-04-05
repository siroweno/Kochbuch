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

// --- Phase 4: auth-shell controller (needs modalController/deleteDialogController/clearPlanDialogController - created next) ---
// Forward-declared; wired after dialog controllers are created.
let authShell;

const modalController = createDialogController({
  overlay: recipeModal,
  content: recipeModalContent,
  appShell,
  initialFocus: () => modalCloseBtn,
  onOpen: () => authShell.syncBodyScrollLock(),
  onClose: () => {
    state.currentModalRecipe = null;
    state.currentModalServings = null;
    authShell.syncBodyScrollLock();
  },
});

const deleteDialogController = createDialogController({
  overlay: deleteConfirm,
  content: deleteConfirmBox,
  appShell,
  initialFocus: () => cancelDeleteBtn,
  onOpen: () => authShell.syncBodyScrollLock(),
  onClose: () => {
    state.pendingDeleteId = null;
    authShell.syncBodyScrollLock();
  },
});

const clearPlanDialogController = createDialogController({
  overlay: clearPlanConfirm,
  content: clearPlanConfirmBox,
  appShell,
  initialFocus: () => cancelClearPlanBtn,
  onOpen: () => authShell.syncBodyScrollLock(),
  onClose: () => authShell.syncBodyScrollLock(),
});

// Now create authShell with dialog controllers available
authShell = createAuthShellController({
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
  modalController,
  deleteDialogController,
  clearPlanDialogController,
  loadingController,
});

// syncModalPlanningUi is needed by modalRecipeController — forward-declared, wired after recipeModalActions
let recipeModalActions;
const syncModalPlanningUiFn = (...args) => recipeModalActions.syncModalPlanningUi(...args);

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
  syncModalPlanningUi: syncModalPlanningUiFn,
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

// plannerActions.getActiveWeekPlan is needed by plannerController — forward-declared
let plannerActions;
const getActiveWeekPlanFn = () => plannerActions.getActiveWeekPlan();

const plannerController = createPlannerController({
  state,
  elements: {
    daysGrid,
    shoppingList,
    shoppingSearchInput,
  },
  getActiveWeekPlan: getActiveWeekPlanFn,
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

plannerActions = createPlannerActions({
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

const dragDropController = createDragDropController({
  state,
  dom: { weekPlanner },
  plannerController,
  focusManager,
  plannerActions,
  announceUi,
});

recipeModalActions = createRecipeModalActions({
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
  } else if (snapshot.accessState === 'signed_out' && config.backend === 'browser-test') {
    browserTestEmail.value = 'admin@kochbuch.local';
  }

  createBackgroundParticles();

  // Cursor "Schreib"-Animation mit Partikeln beim Klicken
  document.addEventListener('mousedown', (e) => {
    document.body.classList.add('cursor-write');

    // Partikel-Burst am Klickpunkt (Gold-Tintenspritzer)
    const colors = ['#C9A84C', '#E8CC6E', '#D4943A', '#B87333', '#C9A84C'];
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
    setTimeout(() => document.body.classList.remove('cursor-write'), 150);
  });

  // Ink-Ripple-Effekt bei jedem Klick
  document.addEventListener('click', (e) => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ripple = document.createElement('div');
    ripple.className = 'ink-ripple';
    ripple.style.left = e.clientX + 'px';
    ripple.style.top = e.clientY + 'px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 650);
  });

  // Cursor-Glow (nur Desktop, nur wenn keine reduzierte Bewegung)
  if (window.matchMedia('(pointer: fine)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const glow = document.createElement('div');
    glow.id = 'cursor-glow';
    document.body.appendChild(glow);
    let rafId = null;
    document.addEventListener('mousemove', (e) => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        glow.style.left = e.clientX + 'px';
        glow.style.top = e.clientY + 'px';
        rafId = null;
      });
    });
  }

  const legacySnapshot = readLegacyLocalSnapshot(window.localStorage);
  if (legacySnapshot.hasLegacyData && snapshot.accessState !== 'signed_in') {
    loginMessage.textContent = config.backend === 'browser-test'
      ? 'Lokale Kochbuchdaten gefunden. Nach dem Test-Login kann die Einmal-Migration gestartet werden.'
      : 'Lokale Kochbuchdaten gefunden. Nach dem Google-Login kann die Einmal-Migration gestartet werden.';
  }

  // ── Fixed header with JS-driven transform animation ──
  //    Header is position:fixed. A spacer div reserves layout space.
  //    JS animates ONLY transform & opacity via rAF = zero reflow, zero flicker.
  //    No CSS animation-timeline, no sticky, no negative-top — just simple math.
  const headerEl = document.getElementById('siteHeader');
  const headerInner = headerEl ? headerEl.querySelector('.header-inner') : null;
  const subtitleEl = headerEl ? headerEl.querySelector('.subtitle') : null;
  const spacerEl = document.getElementById('headerSpacer');
  const userMenuEl = document.getElementById('userMenu');
  const toolbarToggleEl = document.getElementById('toolbarToggle');

  if (headerEl && headerInner && spacerEl) {
    const COMPACT_H = 38;
    const RANGE = 100; // scroll distance over which animation completes

    // Set spacer height to match header's natural height
    function measureHeader() {
      // Temporarily remove fixed so we can measure natural height
      headerEl.style.position = 'static';
      const h = headerEl.offsetHeight;
      headerEl.style.position = '';
      spacerEl.style.height = h + 'px';
      return h;
    }
    const fullH = measureHeader();

    // Set header to clip at compact height when scrolled
    headerEl.style.height = fullH + 'px';

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const sy = window.scrollY;
        const p = Math.min(sy / RANGE, 1); // 0 = top, 1 = fully compact

        // Clip header visually (no layout change — clip-path is GPU composited)
        const visibleH = fullH - (fullH - COMPACT_H) * p;
        headerEl.style.clipPath = 'inset(0 0 ' + (fullH - visibleH).toFixed(0) + 'px 0)';

        // Position the gradient fade right below the clipped header
        spacerEl.style.setProperty('--hdr-clip-h', visibleH.toFixed(0) + 'px');

        // Inner: scale down, keep title visible at top
        const scale = 1 - 0.58 * p; // 1 → 0.42
        headerInner.style.transform = 'scale(' + scale.toFixed(3) + ')';

        // Subtitle: fade out
        if (subtitleEl) {
          subtitleEl.style.opacity = Math.max(0, 1 - p * 3).toFixed(2);
        }

        // Background gradient: fade in (both on header ::before and spacer ::after)
        headerEl.style.setProperty('--hdr-bg-op', p.toFixed(2));
        spacerEl.style.setProperty('--hdr-bg-op', p.toFixed(2));

        // Arabeske: fade out
        headerEl.style.setProperty('--hdr-ara-op', (0.45 * (1 - p)).toFixed(3));

        // Icons fade
        const iconOp = Math.max(0, 1 - p * 2.5).toFixed(2);
        const iconPtr = Number(iconOp) < 0.1 ? 'none' : '';
        if (userMenuEl) { userMenuEl.style.opacity = iconOp; userMenuEl.style.pointerEvents = iconPtr; }
        if (toolbarToggleEl) { toolbarToggleEl.style.opacity = iconOp; toolbarToggleEl.style.pointerEvents = iconPtr; }

        ticking = false;
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // User menu: open/close on click instead of hover
  const userMenuTrigger = document.getElementById('userMenuTrigger');
  const userMenuDropdown = document.getElementById('userMenuDropdown');
  if (userMenuTrigger && userMenuDropdown) {
    userMenuTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      userMenuDropdown.classList.toggle('visible');
    });
    document.addEventListener('click', () => {
      userMenuDropdown.classList.remove('visible');
    });
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
