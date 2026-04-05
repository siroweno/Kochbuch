import { UUID_PATTERN } from './constants.js';

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

export function createPlanEntryId(seed = '') {
  if (String(seed || '').trim()) {
    return createDeterministicUuid(`plan:${String(seed).trim()}`);
  }

  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return createDeterministicUuid(`plan:${Date.now()}|${Math.random().toString(16).slice(2, 10)}`);
}

export function isUuid(value) {
  return UUID_PATTERN.test(String(value || '').trim());
}
