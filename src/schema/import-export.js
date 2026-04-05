import { EXPORT_SCHEMA_VERSION, LEGACY_EXPORT_SCHEMA_VERSION } from './constants.js';
import { isValidDateString } from './date-utils.js';
import { createEmptyWeekPlan } from './week-plan.js';

export function normalizeImportPayload(payload) {
  if (Array.isArray(payload)) {
    return {
      schemaVersion: LEGACY_EXPORT_SCHEMA_VERSION,
      recipes: payload,
      weekPlan: null,
      personalState: null,
    };
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  if (Number(payload.schemaVersion) === EXPORT_SCHEMA_VERSION) {
    return {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      recipes: Array.isArray(payload.recipes) ? payload.recipes : [],
      weekPlan: payload.personalState?.weekPlan || null,
      personalState: payload.personalState || null,
    };
  }

  if (Array.isArray(payload.recipes)) {
    return {
      schemaVersion: Number(payload.schemaVersion) || LEGACY_EXPORT_SCHEMA_VERSION,
      recipes: payload.recipes,
      weekPlan: payload.weekPlan && typeof payload.weekPlan === 'object' ? payload.weekPlan : null,
      personalState: null,
    };
  }

  return null;
}

export function buildExportPayload({
  sharedRecipes = [],
  personalStateMap = new Map(),
  weekPlan = createEmptyWeekPlan(),
  portableImageDataUrlByRecipeId = new Map(),
}) {
  return {
    app: 'mein-kochbuch',
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    recipes: sharedRecipes.map((recipe) => ({
      id: recipe.id,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      title: recipe.title,
      baseServings: recipe.baseServings,
      prepTime: recipe.prepTime,
      cookTime: recipe.cookTime,
      tags: recipe.tags,
      description: recipe.description,
      rawIngredients: recipe.rawIngredients,
      parsedIngredients: recipe.parsedIngredients,
      instructions: recipe.instructions,
      plating: recipe.plating,
      tips: recipe.tips,
      imagePath: recipe.imagePath || null,
      externalImageUrl: recipe.externalImageUrl || null,
      portableImageDataUrl: portableImageDataUrlByRecipeId.get(recipe.id) || recipe.portableImageDataUrl || null,
    })),
    personalState: {
      recipeState: Array.from(personalStateMap.values()).map((state) => ({
        recipeId: state.recipeId,
        favorite: Boolean(state.favorite),
        lastCookedAt: state.lastCookedAt || null,
      })),
      weekPlan,
    },
  };
}

export function readLegacyLocalSnapshot(storage = globalThis.localStorage) {
  try {
    const recipes = JSON.parse(storage.getItem('cookbook_recipes') || '[]');
    const weekPlan = JSON.parse(storage.getItem('cookbook_weekplan') || 'null');
    return {
      hasLegacyData: Array.isArray(recipes) && recipes.length > 0,
      recipes: Array.isArray(recipes) ? recipes : [],
      weekPlan: weekPlan && typeof weekPlan === 'object' ? weekPlan : null,
    };
  } catch (error) {
    return {
      hasLegacyData: false,
      recipes: [],
      weekPlan: null,
      error,
    };
  }
}
