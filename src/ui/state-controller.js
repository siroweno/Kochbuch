import { createEmptyWeekPlan } from '../cookbook-schema.js';

export function createUiState(authService) {
  return {
    recipes: [],
    weekPlan: createEmptyWeekPlan(),
    currentModalRecipe: null,
    currentModalServings: null,
    editingRecipeId: null,
    activeTagFilter: null,
    favoriteFilterActive: false,
    pendingDeleteId: null,
    activeDayPicker: null,
    activeDayPickerSlot: 'abend',
    fullShoppingList: '',
    plannerOpen: false,
    lastModalTrigger: null,
    lastDeleteTrigger: null,
    latestAuthSnapshot: authService.getSnapshot(),
    latestAppData: {
      recipes: [],
      weekPlan: createEmptyWeekPlan(),
      capabilities: { canAdmin: false },
      migration: { hasLegacyData: false, alreadyMigrated: false },
    },
    pendingImageUpload: null,
    inflightRefreshPromise: null,
    importMode: 'restore',
  };
}
