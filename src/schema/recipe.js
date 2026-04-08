import { isValidDateString, formatDateLabel, isSameCalendarDay, toIsoTimestamp } from './date-utils.js';
import { normalizeMultilineText, normalizeIngredientsSource, normalizeTags, normalizePositiveInteger } from './normalize.js';
import { generateId } from './id-generation.js';
import { parseIngredientsText } from './ingredients.js';

export function isDataUrl(value) {
  return String(value || '').trim().startsWith('data:');
}

export function isExternalImageUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
}

export function hasRequiredRecipeFields(recipe = {}) {
  return String(recipe.title || '').trim().length > 0
    && normalizeMultilineText(recipe.rawIngredients).length > 0
    && normalizeMultilineText(recipe.instructions).length > 0;
}

export function getCookedTimestamp(recipe) {
  return isValidDateString(recipe.lastCookedAt) ? new Date(recipe.lastCookedAt).getTime() : 0;
}

export function formatLastCooked(recipe, variant = 'long') {
  if (!isValidDateString(recipe.lastCookedAt)) return '';

  const cookedAt = new Date(recipe.lastCookedAt);
  const formattedDate = cookedAt.toLocaleDateString('de-DE');

  if (isSameCalendarDay(cookedAt, new Date())) {
    return 'Heute gekocht';
  }

  return variant === 'short'
    ? `Zuletzt ${formattedDate}`
    : `Zuletzt gekocht am ${formattedDate}`;
}

export function compareTitles(a, b) {
  return String(a.title || '').localeCompare(String(b.title || ''), 'de', { sensitivity: 'base' });
}

export function getTitleKey(title) {
  return String(title || '').trim().toLocaleLowerCase('de-DE');
}

function normalizeParsedIngredients(rawIngredients, parsedIngredients) {
  if (Array.isArray(parsedIngredients) && parsedIngredients.length) {
    return parsedIngredients
      .filter((ingredient) => ingredient && String(ingredient.name || '').trim())
      .map((ingredient) => ({
        quantity: ingredient.quantity === null || ingredient.quantity === undefined || Number.isNaN(Number(ingredient.quantity))
          ? null
          : Number(ingredient.quantity),
        unit: ingredient.unit ? String(ingredient.unit).trim() : null,
        name: String(ingredient.name || '').trim(),
      }));
  }

  return parseIngredientsText(rawIngredients);
}

export function normalizeRecipeRecord(rawRecipe = {}, options = {}) {
  const existingId = options.id || rawRecipe.id;
  const rawIngredients = normalizeMultilineText(
    rawRecipe.rawIngredients || normalizeIngredientsSource(rawRecipe.ingredients),
  );
  const parsedIngredients = normalizeParsedIngredients(rawIngredients, rawRecipe.parsedIngredients);
  const rawImageValue = String(
    rawRecipe.externalImageUrl
      || rawRecipe.external_image_url
      || rawRecipe.imageUrl
      || '',
  ).trim();

  return {
    id: String(existingId || generateId()),
    createdAt: toIsoTimestamp(rawRecipe.createdAt, new Date()),
    updatedAt: toIsoTimestamp(rawRecipe.updatedAt || rawRecipe.createdAt, new Date()),
    title: String(rawRecipe.title || '').trim(),
    baseServings: normalizePositiveInteger(rawRecipe.baseServings, 2),
    prepTime: Math.max(0, Number.parseInt(rawRecipe.prepTime, 10) || 0),
    cookTime: Math.max(0, Number.parseInt(rawRecipe.cookTime, 10) || 0),
    tags: normalizeTags(rawRecipe.tags),
    description: String(rawRecipe.description || rawRecipe.summary || '').trim(),
    rawIngredients,
    parsedIngredients,
    instructions: normalizeMultilineText(rawRecipe.instructions || rawRecipe.method || rawRecipe.steps || ''),
    plating: normalizeMultilineText(rawRecipe.plating || rawRecipe.serving || ''),
    tips: normalizeMultilineText(rawRecipe.tips || rawRecipe.notes || ''),
    imagePath: rawRecipe.imagePath || rawRecipe.image_path || null,
    externalImageUrl: isExternalImageUrl(rawImageValue) ? rawImageValue : null,
    portableImageDataUrl: isDataUrl(rawRecipe.portableImageDataUrl) ? String(rawRecipe.portableImageDataUrl).trim() : null,
    legacyImageDataUrl: isDataUrl(rawImageValue) ? rawImageValue : null,
    createdBy: rawRecipe.createdBy || rawRecipe.created_by || null,
  };
}

export function normalizeUserRecipeStateRecord(rawState = {}, fallbackRecipeId = '') {
  return {
    recipeId: String(rawState.recipeId || rawState.recipe_id || fallbackRecipeId || ''),
    favorite: Boolean(rawState.favorite),
    lastCookedAt: isValidDateString(rawState.lastCookedAt || rawState.last_cooked_at)
      ? new Date(rawState.lastCookedAt || rawState.last_cooked_at).toISOString()
      : null,
  };
}

export function buildPersonalStateMap(records = []) {
  return records.reduce((map, record) => {
    const normalized = normalizeUserRecipeStateRecord(record);
    if (!normalized.recipeId) return map;
    map.set(normalized.recipeId, normalized);
    return map;
  }, new Map());
}

export function buildRecipeViewModels(sharedRecipes = [], personalStateMap = new Map(), imageUrlByRecipeId = new Map(), creatorNameByUserId = new Map()) {
  return sharedRecipes.map((recipe) => {
    const personalState = personalStateMap.get(recipe.id) || { favorite: false, lastCookedAt: null };
    return {
      ...recipe,
      createdAtLabel: formatDateLabel(recipe.createdAt),
      favorite: Boolean(personalState.favorite),
      lastCookedAt: personalState.lastCookedAt || null,
      imageUrl: imageUrlByRecipeId.get(recipe.id) || recipe.externalImageUrl || '',
      imageEditorValue: recipe.externalImageUrl || '',
      createdByName: (recipe.createdBy && creatorNameByUserId.get(recipe.createdBy)) || null,
    };
  });
}

export function extractLegacyPersonalState(rawRecipe) {
  return {
    favorite: Boolean(rawRecipe?.favorite),
    lastCookedAt: isValidDateString(rawRecipe?.lastCookedAt) ? new Date(rawRecipe.lastCookedAt).toISOString() : null,
  };
}
