import { DAYS } from './constants.js';
import { normalizePositiveInteger } from './normalize.js';
import { createPlanEntryId } from './id-generation.js';
import { isValidMealSlot } from './meal-slots.js';

export function createEmptyWeekPlan() {
  return { Mo: [], Di: [], Mi: [], Do: [], Fr: [], Sa: [], So: [] };
}

export function getPlanEntrySignature(entry) {
  return `${entry.recipeId}|${entry.slot}|${entry.servings}`;
}

export function normalizeWeekPlanEntry(entry, recipesById = new Map(), context = {}) {
  const recipeId = String(
    typeof entry === 'object' && entry !== null
      ? entry.recipeId ?? entry.recipe_id ?? entry.id ?? ''
      : entry ?? '',
  ).trim();

  if (!recipeId) return null;

  const fallbackServings = recipesById.get(recipeId)?.baseServings || 2;
  const servings = normalizePositiveInteger(
    typeof entry === 'object' && entry !== null ? entry.servings : '',
    fallbackServings,
  );
  const slot = isValidMealSlot(typeof entry === 'object' && entry !== null ? entry.slot : '') ? entry.slot : 'abend';
  const explicitPlanEntryId = String(
    typeof entry === 'object' && entry !== null
      ? entry.planEntryId ?? entry.plan_entry_id ?? ''
      : '',
  ).trim();
  const planEntryId = explicitPlanEntryId || createPlanEntryId(
    `${context.day || 'day'}|${Number.isInteger(context.index) ? context.index : 'idx'}|${recipeId}|${slot}|${servings}`,
  );

  return {
    planEntryId,
    recipeId,
    servings,
    slot,
  };
}

export function normalizeWeekPlan(rawWeekPlan, recipesById = new Map()) {
  const candidate = rawWeekPlan && typeof rawWeekPlan === 'object' ? rawWeekPlan : {};
  return DAYS.reduce((plan, day) => {
    const entries = Array.isArray(candidate[day]) ? candidate[day] : [];
    plan[day] = entries
      .map((entry, index) => normalizeWeekPlanEntry(entry, recipesById, { day, index }))
      .filter(Boolean);
    return plan;
  }, createEmptyWeekPlan());
}

export function mergeWeekPlans(basePlan, incomingPlan) {
  const merged = createEmptyWeekPlan();
  DAYS.forEach((day) => {
    const entries = [...(basePlan[day] || []), ...(incomingPlan[day] || [])];
    const seen = new Set();
    merged[day] = entries.filter((entry) => {
      const signature = getPlanEntrySignature(entry);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    });
  });
  return merged;
}

export function getPlannerStats(weekPlan, recipes = []) {
  const recipeById = new Map(recipes.map((recipe) => [String(recipe.id), recipe]));
  const entries = DAYS.flatMap((day) => weekPlan[day] || []);
  const favoriteEntries = entries.filter((entry) => recipeById.get(String(entry.recipeId))?.favorite).length;
  const plannedDays = DAYS.filter((day) => (weekPlan[day] || []).length > 0).length;
  const uniqueRecipes = new Set(entries.map((entry) => String(entry.recipeId))).size;
  return {
    entries: entries.length,
    favoriteEntries,
    plannedDays,
    uniqueRecipes,
  };
}
