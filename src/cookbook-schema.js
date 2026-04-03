export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const SERVING_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
export const EXPORT_SCHEMA_VERSION = 4;
export const LEGACY_EXPORT_SCHEMA_VERSION = 2;
export const MEAL_SLOTS = [
  { id: 'fruehstueck', label: 'Fruehstueck', short: 'Frueh' },
  { id: 'mittag', label: 'Mittag', short: 'Mittag' },
  { id: 'abend', label: 'Abend', short: 'Abend' },
  { id: 'snack', label: 'Snack', short: 'Snack' },
];

const QUANTITY_PATTERN = /^([\d.,]+)\s*([a-zäöü°\/]*)/i;
const UNICODE_FRACTIONS = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅐': '1/7',
  '⅑': '1/9',
  '⅒': '1/10',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅕': '1/5',
  '⅖': '2/5',
  '⅗': '3/5',
  '⅘': '4/5',
  '⅙': '1/6',
  '⅚': '5/6',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
};
const UNIT_ALIASES = {
  g: 'g',
  gramm: 'g',
  kg: 'kg',
  kilo: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  l: 'l',
  liter: 'l',
  el: 'el',
  'eßlöffel': 'el',
  esslöffel: 'el',
  tl: 'tl',
  teelöffel: 'tl',
  stück: 'stück',
  st: 'stück',
  stk: 'stück',
  piece: 'stück',
  prise: 'prise',
  pck: 'pck',
  packung: 'pck',
  dose: 'dose',
  tasse: 'tasse',
  schale: 'schale',
  becher: 'becher',
  blatt: 'blatt',
  zweig: 'zweig',
  zehe: 'zehe',
  splitter: 'splitter',
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function createEmptyWeekPlan() {
  return { Mo: [], Di: [], Mi: [], Do: [], Fr: [], Sa: [], So: [] };
}

export function normalizeMultilineText(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim();
}

export function normalizeIngredientsSource(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (!item || typeof item !== 'object') return '';
        return [item.quantity, item.unit, item.name].filter(Boolean).join(' ').trim();
      })
      .filter(Boolean)
      .join('\n');
  }

  return String(value || '');
}

export function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag || '').trim())
      .filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function isValidMealSlot(slot) {
  return MEAL_SLOTS.some((item) => item.id === slot);
}

export function getMealSlotLabel(slot, short = false) {
  const match = MEAL_SLOTS.find((item) => item.id === slot) || MEAL_SLOTS[2];
  return short ? match.short : match.label;
}

export function renderMealSlotOptions(selected, compact = false) {
  return MEAL_SLOTS.map(
    (slot) => `<option value="${slot.id}"${slot.id === selected ? ' selected' : ''}>${compact ? slot.short : slot.label}</option>`,
  ).join('');
}

export function isValidDateString(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

export function normalizePositiveInteger(value, fallback = 2) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseGermanDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoTimestamp(value, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  if (isValidDateString(value)) {
    return new Date(value).toISOString();
  }

  const germanDate = parseGermanDate(value);
  if (germanDate) {
    return germanDate.toISOString();
  }

  return fallback.toISOString();
}

export function formatDateLabel(value) {
  if (!value) return '';
  const timestamp = isValidDateString(value) ? new Date(value) : parseGermanDate(value);
  if (!timestamp) return '';
  return timestamp.toLocaleDateString('de-DE');
}

export function isSameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
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

export function generateId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `recipe-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

export function createDeterministicUuid(seed) {
  const input = String(seed || '');
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  let h3 = 0xc0decafe ^ input.length;
  let h4 = 0x1234567 ^ input.length;

  for (let index = 0; index < input.length; index += 1) {
    const char = input.charCodeAt(index);
    h1 = Math.imul(h1 ^ char, 2654435761);
    h2 = Math.imul(h2 ^ char, 1597334677);
    h3 = Math.imul(h3 ^ char, 2246822507);
    h4 = Math.imul(h4 ^ char, 3266489909);
  }

  h1 = (h1 ^ (h1 >>> 16)) >>> 0;
  h2 = (h2 ^ (h2 >>> 16)) >>> 0;
  h3 = (h3 ^ (h3 >>> 16)) >>> 0;
  h4 = (h4 ^ (h4 >>> 16)) >>> 0;

  const bytes = [
    h1 >>> 24, (h1 >>> 16) & 0xff, (h1 >>> 8) & 0xff, h1 & 0xff,
    h2 >>> 24, (h2 >>> 16) & 0xff, (h2 >>> 8) & 0xff, h2 & 0xff,
    h3 >>> 24, (h3 >>> 16) & 0xff, (h3 >>> 8) & 0xff, h3 & 0xff,
    h4 >>> 24, (h4 >>> 16) & 0xff, (h4 >>> 8) & 0xff, h4 & 0xff,
  ];

  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.map((byte) => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

export function createStableLegacyRecipeId(rawRecipe = {}) {
  const legacyId = String(rawRecipe.id ?? rawRecipe.recipeId ?? rawRecipe.recipe_id ?? '').trim();
  const title = String(rawRecipe.title ?? '').trim();
  const createdAt = String(rawRecipe.createdAt ?? rawRecipe.created_at ?? '').trim();
  return createDeterministicUuid(`legacy:${legacyId}|${title}|${createdAt}`);
}

export function hasRequiredRecipeFields(recipe = {}) {
  return String(recipe.title || '').trim().length > 0
    && normalizeMultilineText(recipe.rawIngredients).length > 0
    && normalizeMultilineText(recipe.instructions).length > 0;
}

export function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}

export function getPlanEntrySignature(entry) {
  return `${entry.recipeId}|${entry.slot}|${entry.servings}`;
}

export function parseIngredient(line) {
  const value = String(line || '').trim();
  if (!value) return { quantity: null, unit: null, name: '' };

  const normalized = value
    .replace(/(\d)([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2')
    .replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (fraction) => UNICODE_FRACTIONS[fraction] || fraction)
    .replace(/\s+/g, ' ')
    .trim();

  const mixedFractionMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)(?:\s+(.*)|$)/);
  if (mixedFractionMatch) {
    const [, whole, numerator, denominator, rest = ''] = mixedFractionMatch;
    const quantity = Number(whole) + (Number(numerator) / Number(denominator));
    const remainder = rest.trim();
    const unitMatch = remainder.match(/^([a-zäöü°]+)\b\s*(.*)$/i);
    return {
      quantity,
      unit: unitMatch ? (UNIT_ALIASES[unitMatch[1].toLowerCase()] || unitMatch[1].toLowerCase()) : null,
      name: (unitMatch ? unitMatch[2] : remainder).trim(),
    };
  }

  const fractionMatch = normalized.match(/^(\d+)\/(\d+)(?:\s+(.*)|$)/);
  if (fractionMatch) {
    const [, numerator, denominator, rest = ''] = fractionMatch;
    const quantity = Number(numerator) / Number(denominator);
    const remainder = rest.trim();
    const unitMatch = remainder.match(/^([a-zäöü°]+)\b\s*(.*)$/i);
    return {
      quantity,
      unit: unitMatch ? (UNIT_ALIASES[unitMatch[1].toLowerCase()] || unitMatch[1].toLowerCase()) : null,
      name: (unitMatch ? unitMatch[2] : remainder).trim(),
    };
  }

  const unicodeFractionMatch = normalized.match(/^(\d+)?\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?:\s+(.*)|$)/);
  if (unicodeFractionMatch) {
    const [, whole = '0', fraction, rest = ''] = unicodeFractionMatch;
    const quantity = Number(whole) + Number.parseFloat(UNICODE_FRACTIONS[fraction] || '0');
    const remainder = rest.trim();
    const unitMatch = remainder.match(/^([a-zäöü°]+)\b\s*(.*)$/i);
    return {
      quantity,
      unit: unitMatch ? (UNIT_ALIASES[unitMatch[1].toLowerCase()] || unitMatch[1].toLowerCase()) : null,
      name: (unitMatch ? unitMatch[2] : remainder).trim(),
    };
  }

  const decimalMatch = normalized.match(QUANTITY_PATTERN);
  if (!decimalMatch) return { quantity: null, unit: null, name: value };

  let quantity = Number.parseFloat(decimalMatch[1].replace(',', '.'));
  let unit = decimalMatch[2].toLowerCase().trim();
  const name = normalized.substring(decimalMatch[0].length).trim();

  if (unit) unit = UNIT_ALIASES[unit] || unit;
  if (Number.isNaN(quantity)) quantity = null;

  return { quantity, unit: unit || null, name };
}

export function parseIngredientsText(value) {
  return normalizeMultilineText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseIngredient(line));
}

export function scaleIngredient(ingredient, fromServings, toServings) {
  if (ingredient.quantity === null || ingredient.quantity === undefined) {
    return ingredient.name;
  }

  const base = Number(fromServings) || 1;
  const next = Number(toServings) || base;
  let scaled = Math.round(ingredient.quantity * (next / base) * 10) / 10;
  if (scaled === Math.floor(scaled)) scaled = Math.floor(scaled);
  return `${scaled}${ingredient.unit ? ` ${ingredient.unit}` : ''} ${ingredient.name}`;
}

export function isDataUrl(value) {
  return String(value || '').trim().startsWith('data:');
}

export function isExternalImageUrl(value) {
  return /^https?:\/\//i.test(String(value || '').trim());
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

export function normalizeWeekPlanEntry(entry, recipesById = new Map()) {
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

  return {
    recipeId,
    servings,
    slot: isValidMealSlot(typeof entry === 'object' && entry !== null ? entry.slot : '') ? entry.slot : 'abend',
  };
}

export function normalizeWeekPlan(rawWeekPlan, recipesById = new Map()) {
  const candidate = rawWeekPlan && typeof rawWeekPlan === 'object' ? rawWeekPlan : {};
  return DAYS.reduce((plan, day) => {
    const entries = Array.isArray(candidate[day]) ? candidate[day] : [];
    plan[day] = entries
      .map((entry) => normalizeWeekPlanEntry(entry, recipesById))
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

export function buildPersonalStateMap(records = []) {
  return records.reduce((map, record) => {
    const normalized = normalizeUserRecipeStateRecord(record);
    if (!normalized.recipeId) return map;
    map.set(normalized.recipeId, normalized);
    return map;
  }, new Map());
}

export function buildRecipeViewModels(sharedRecipes = [], personalStateMap = new Map(), imageUrlByRecipeId = new Map()) {
  return sharedRecipes.map((recipe) => {
    const personalState = personalStateMap.get(recipe.id) || { favorite: false, lastCookedAt: null };
    return {
      ...recipe,
      createdAtLabel: formatDateLabel(recipe.createdAt),
      favorite: Boolean(personalState.favorite),
      lastCookedAt: personalState.lastCookedAt || null,
      imageUrl: imageUrlByRecipeId.get(recipe.id) || recipe.externalImageUrl || '',
      imageEditorValue: recipe.externalImageUrl || '',
    };
  });
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

export function extractLegacyPersonalState(rawRecipe) {
  return {
    favorite: Boolean(rawRecipe?.favorite),
    lastCookedAt: isValidDateString(rawRecipe?.lastCookedAt) ? new Date(rawRecipe.lastCookedAt).toISOString() : null,
  };
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
