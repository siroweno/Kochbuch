import {
  buildExportPayload,
  buildPersonalStateMap,
  buildRecipeViewModels,
  createEmptyWeekPlan,
  createStableLegacyRecipeId,
  extractLegacyPersonalState,
  hasRequiredRecipeFields,
  isDataUrl,
  isExternalImageUrl,
  isUuid,
  normalizeImportPayload,
  normalizeRecipeRecord,
  normalizePositiveInteger,
  normalizeWeekPlan,
  readLegacyLocalSnapshot,
} from './cookbook-schema.js';

const MIGRATION_MARKER_KEY = 'cookbook_cloud_migration_done_v1';

function ensureSession(snapshot) {
  if (snapshot.accessState !== 'signed_in' || !snapshot.sessionUser) {
    throw new Error('Bitte melde dich zuerst an.');
  }
}

function ensureAdmin(snapshot) {
  ensureSession(snapshot);
  if (!snapshot.canAdmin) {
    throw new Error('Nur Admins duerfen diese Aktion ausfuehren.');
  }
}

function isCompleteRecipeRecord(recipe) {
  return hasRequiredRecipeFields(recipe);
}

function normalizeImportedRecipeId(rawRecipe, normalizedRecipe) {
  if (isUuid(normalizedRecipe.id)) {
    return normalizedRecipe.id;
  }

  return createStableLegacyRecipeId(rawRecipe);
}

function normalizeImportedRecipeRecord(rawRecipe) {
  const normalizedRecipe = normalizeRecipeRecord(rawRecipe);
  normalizedRecipe.id = normalizeImportedRecipeId(rawRecipe, normalizedRecipe);
  return normalizedRecipe;
}

function cloneWeekPlan(weekPlan) {
  return JSON.parse(JSON.stringify(weekPlan || createEmptyWeekPlan()));
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Bild konnte nicht gelesen werden.'));
    reader.readAsDataURL(blob);
  });
}

async function fetchImageDataUrl(imageUrl) {
  if (!imageUrl || isDataUrl(imageUrl)) {
    return String(imageUrl || '').trim() || null;
  }

  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Bild konnte nicht geladen werden (${response.status}).`);
  }

  return blobToDataUrl(await response.blob());
}

export function createCookbookRepository({ authService, createDriver }) {
  const cache = {
    sharedRecipes: [],
    personalStateMap: new Map(),
    weekPlan: createEmptyWeekPlan(),
    recipes: [],
  };

  function getSnapshot() {
    return authService.getSnapshot();
  }

  function buildLoadResult() {
    const snapshot = getSnapshot();
    return {
      backend: snapshot.backend,
      user: snapshot.sessionUser,
      profile: snapshot.profile,
      recipes: cache.recipes,
      weekPlan: cloneWeekPlan(cache.weekPlan),
      checkedItems: cache.checkedItems || [],
      capabilities: {
        canAdmin: snapshot.canAdmin,
      },
      migration: getLegacyLocalStateSummary(),
    };
  }

  async function applyCacheFromBundle(bundle) {
    cache.sharedRecipes = bundle.sharedRecipes;
    cache.personalStateMap = buildPersonalStateMap(bundle.personalStateRecords);
    cache.weekPlan = bundle.weekPlan;
    cache.checkedItems = bundle.checkedItems || [];
    cache.recipes = buildRecipeViewModels(bundle.sharedRecipes, cache.personalStateMap, bundle.imageUrlByRecipeId, bundle.creatorNameByUserId || new Map());
  }

  async function collectPortableImageDataUrlByRecipeId() {
    const portableImageDataUrlByRecipeId = new Map();

    await Promise.all(cache.recipes.map(async (recipe) => {
      if (!recipe.imagePath) return;
      const imageUrl = recipe.imageUrl || '';
      if (!imageUrl) return;

      try {
        const portableImageDataUrl = await fetchImageDataUrl(imageUrl);
        if (portableImageDataUrl) {
          portableImageDataUrlByRecipeId.set(recipe.id, portableImageDataUrl);
        }
      } catch (_error) {
        // Export stays usable even if an individual image cannot be fetched.
      }
    }));

    return portableImageDataUrlByRecipeId;
  }

  function getSharedRecipeById(recipeId) {
    return cache.sharedRecipes.find((recipe) => recipe.id === String(recipeId)) || null;
  }

  async function applyImportedRecipeImage(driver, recipe, existingRecipe, { replaceMissingImage = false } = {}) {
    let imagePath = existingRecipe?.imagePath || null;
    let externalImageUrl = existingRecipe?.externalImageUrl || null;
    const portableImageDataUrl = recipe.portableImageDataUrl || recipe.legacyImageDataUrl || null;

    if (portableImageDataUrl) {
      try {
        const upload = await driver.uploadImageDataUrl(portableImageDataUrl, `${recipe.title || 'rezeptbild'}.jpg`);
        if (existingRecipe?.imagePath && existingRecipe.imagePath !== upload.imagePath) {
          await driver.deleteImage(existingRecipe.imagePath);
        }
        imagePath = upload.imagePath;
        externalImageUrl = null;
      } catch (_error) {
        if (replaceMissingImage && existingRecipe?.imagePath) {
          await driver.deleteImage(existingRecipe.imagePath);
        }
        if (replaceMissingImage) {
          imagePath = null;
          externalImageUrl = null;
        }
      }
    } else if (recipe.externalImageUrl) {
      if (existingRecipe?.imagePath) {
        await driver.deleteImage(existingRecipe.imagePath);
      }
      imagePath = null;
      externalImageUrl = recipe.externalImageUrl;
    } else if (replaceMissingImage) {
      if (existingRecipe?.imagePath) {
        await driver.deleteImage(existingRecipe.imagePath);
      }
      imagePath = null;
      externalImageUrl = null;
    }

    return { imagePath, externalImageUrl };
  }

  async function persistRecipe(recipeInput) {
    const snapshot = getSnapshot();
    ensureAdmin(snapshot);

    const driver = createDriver();
    const existing = recipeInput.id ? getSharedRecipeById(recipeInput.id) : null;
    const normalized = normalizeRecipeRecord({
      ...(existing || {}),
      ...recipeInput,
    }, { id: recipeInput.id || existing?.id });

    if (!isCompleteRecipeRecord(normalized)) {
      throw new Error('Bitte gib Titel, Zutaten und Zubereitung an.');
    }

    const image = recipeInput.image || {
      mode: 'keep',
      previousImagePath: existing?.imagePath || null,
      previousExternalImageUrl: existing?.externalImageUrl || null,
    };

    let imagePath = existing?.imagePath || null;
    let externalImageUrl = existing?.externalImageUrl || null;

    if (image.mode === 'upload' && image.uploadDataUrl) {
      const upload = await driver.uploadImageDataUrl(image.uploadDataUrl, image.filename || `${normalized.title}.jpg`);
      if (existing?.imagePath && existing.imagePath !== upload.imagePath) {
        await driver.deleteImage(existing.imagePath);
      }
      imagePath = upload.imagePath;
      externalImageUrl = null;
    } else if (image.mode === 'external') {
      if (existing?.imagePath) {
        await driver.deleteImage(existing.imagePath);
      }
      imagePath = null;
      externalImageUrl = image.externalUrl || null;
    } else if (image.mode === 'remove') {
      if (existing?.imagePath) {
        await driver.deleteImage(existing.imagePath);
      }
      imagePath = null;
      externalImageUrl = null;
    }

    await driver.saveRecipeRecord({
      ...normalized,
      imagePath,
      externalImageUrl,
      updatedAt: new Date().toISOString(),
      createdAt: existing?.createdAt || normalized.createdAt,
    }, {
      existingRecipeIds: cache.sharedRecipes.map((recipe) => recipe.id),
    });
  }

  async function applyImportedPersonalState(driver, entries, { mode, currentStateRecipeIds }) {
    if (mode !== 'restore') {
      return { importedEntries: 0, removedEntries: 0 };
    }

    const importedRecipeIds = new Set();
    let importedEntries = 0;

    for (const entry of entries) {
      const recipeId = String(entry.recipeId || entry.sourceRecipeId || '').trim();
      if (!recipeId) continue;

      importedRecipeIds.add(recipeId);
      await driver.upsertUserRecipeState(recipeId, {
        favorite: Boolean(entry.favorite),
        lastCookedAt: entry.lastCookedAt || null,
      });
      importedEntries += 1;
    }

    let removedEntries = 0;
    for (const recipeId of currentStateRecipeIds) {
      if (importedRecipeIds.has(recipeId)) continue;
      if (typeof driver.deleteUserRecipeState !== 'function') continue;
      await driver.deleteUserRecipeState(recipeId);
      removedEntries += 1;
    }

    return { importedEntries, removedEntries };
  }

  function mapImportedWeekPlan(rawWeekPlan, mappedRecipeIdBySource, recipeLookup) {
    const mapped = createEmptyWeekPlan();
    const sourceWeekPlan = normalizeWeekPlan(rawWeekPlan || createEmptyWeekPlan());

    Object.keys(sourceWeekPlan).forEach((day) => {
      mapped[day] = sourceWeekPlan[day]
        .map((entry) => {
          const targetRecipeId = mappedRecipeIdBySource.get(String(entry.recipeId)) || String(entry.recipeId);
          if (!recipeLookup.has(targetRecipeId)) return null;
          return {
            planEntryId: entry.planEntryId,
            recipeId: targetRecipeId,
            servings: normalizePositiveInteger(entry.servings, recipeLookup.get(targetRecipeId)?.baseServings || 2),
            slot: entry.slot,
          };
        })
        .filter(Boolean);
    });

    return mapped;
  }

  return {
    async loadAppData() {
      const snapshot = getSnapshot();
      if (snapshot.accessState !== 'signed_in') {
        cache.sharedRecipes = [];
        cache.personalStateMap = new Map();
        cache.weekPlan = createEmptyWeekPlan();
        cache.recipes = [];
        return buildLoadResult();
      }

      const driver = createDriver();
      const bundle = await driver.loadBundle();
      await applyCacheFromBundle(bundle);
      return buildLoadResult();
    },

    async reload() {
      return this.loadAppData();
    },

    async saveRecipe(recipeInput) {
      await persistRecipe(recipeInput);
      return this.reload();
    },

    async deleteRecipe(recipeId) {
      const snapshot = getSnapshot();
      ensureAdmin(snapshot);
      const existing = getSharedRecipeById(recipeId);
      if (!existing) return this.reload();
      const driver = createDriver();
      if (existing.imagePath) {
        await driver.deleteImage(existing.imagePath);
      }
      await driver.deleteRecipeRecord(existing.id);
      return this.reload();
    },

    async toggleFavorite(recipeId) {
      const snapshot = getSnapshot();
      ensureSession(snapshot);
      const current = cache.personalStateMap.get(String(recipeId)) || { favorite: false, lastCookedAt: null };
      const driver = createDriver();
      await driver.upsertUserRecipeState(String(recipeId), {
        favorite: !current.favorite,
        lastCookedAt: current.lastCookedAt || null,
      });
      return this.reload();
    },

    async markRecipeCooked(recipeId) {
      const snapshot = getSnapshot();
      ensureSession(snapshot);
      const current = cache.personalStateMap.get(String(recipeId)) || { favorite: false };
      const driver = createDriver();
      await driver.upsertUserRecipeState(String(recipeId), {
        favorite: Boolean(current.favorite),
        lastCookedAt: new Date().toISOString(),
      });
      return this.reload();
    },

    async saveWeekPlan(plan) {
      const snapshot = getSnapshot();
      ensureSession(snapshot);
      const driver = createDriver();
      const recipeLookup = new Map(cache.sharedRecipes.map((recipe) => [recipe.id, recipe]));
      const normalizedPlan = normalizeWeekPlan(plan, recipeLookup);
      await driver.saveWeekPlan(normalizedPlan);
      return this.reload();
    },

    async saveCheckedItems(checkedItems) {
      const snapshot = getSnapshot();
      ensureSession(snapshot);
      const driver = createDriver();
      await driver.saveCheckedItems(checkedItems);
      cache.checkedItems = checkedItems;
    },

    async exportCookbook() {
      if (!cache.sharedRecipes.length) {
        await this.loadAppData();
      }
      const portableImageDataUrlByRecipeId = await collectPortableImageDataUrlByRecipeId();
      return buildExportPayload({
        sharedRecipes: cache.sharedRecipes,
        personalStateMap: cache.personalStateMap,
        weekPlan: cache.weekPlan,
        portableImageDataUrlByRecipeId,
      });
    },

    async importCookbookPayload(payload, options = {}) {
      return this.importWithMode(payload, { ...options, mode: options.mode || 'restore' });
    },

    async restoreCookbookPayload(payload) {
      return this.importWithMode(payload, { mode: 'restore' });
    },

    async importCookbookRecipesPayload(payload) {
      return this.importWithMode(payload, { mode: 'additive' });
    },

    async importWithMode(payload, { mode = 'restore' } = {}) {
      const snapshot = getSnapshot();
      ensureAdmin(snapshot);

      const normalizedPayload = normalizeImportPayload(payload);
      if (!normalizedPayload) {
        throw new Error('Ungültiges Dateiformat');
      }

      const driver = createDriver();
      const workingRecipesById = new Map(cache.sharedRecipes.map((recipe) => [recipe.id, recipe]));
      const mappedRecipeIdBySource = new Map();
      const importedPersonalState = [];
      let importedRecipes = 0;
      let duplicateRecipes = 0;
      let invalidRecipes = 0;

      for (const rawRecipe of normalizedPayload.recipes) {
        if (!rawRecipe || typeof rawRecipe !== 'object') {
          invalidRecipes += 1;
          continue;
        }

        const normalizedRecipe = normalizeImportedRecipeRecord(rawRecipe);
        if (!isCompleteRecipeRecord(normalizedRecipe)) {
          invalidRecipes += 1;
          continue;
        }

        const sourceKey = String(rawRecipe.id ?? normalizedRecipe.id);
        const existing = workingRecipesById.get(normalizedRecipe.id) || null;
        const recipeToSave = { ...normalizedRecipe };
        const image = await applyImportedRecipeImage(driver, recipeToSave, existing, {
          replaceMissingImage: mode === 'restore',
        });

        await driver.saveRecipeRecord({
          ...recipeToSave,
          imagePath: image.imagePath,
          externalImageUrl: image.externalImageUrl,
        }, {
          existingRecipeIds: Array.from(workingRecipesById.keys()),
        });
        workingRecipesById.set(recipeToSave.id, {
          ...recipeToSave,
          imagePath: image.imagePath,
          externalImageUrl: image.externalImageUrl,
        });
        mappedRecipeIdBySource.set(sourceKey, recipeToSave.id);
        importedRecipes += 1;
        if (existing) {
          duplicateRecipes += 1;
        }

        if (mode === 'restore') {
          const legacyState = extractLegacyPersonalState(rawRecipe);
          if (legacyState.favorite || legacyState.lastCookedAt) {
            importedPersonalState.push({
              recipeId: recipeToSave.id,
              ...legacyState,
            });
          }
        }
      }

      if (mode === 'restore' && normalizedPayload.personalState?.recipeState) {
        normalizedPayload.personalState.recipeState.forEach((state) => {
          const recipeId = mappedRecipeIdBySource.get(String(state.recipeId)) || String(state.recipeId || '').trim();
          if (!recipeId || !workingRecipesById.has(recipeId)) return;
          if (!state.favorite && !state.lastCookedAt) return;
          importedPersonalState.push({
            recipeId,
            favorite: Boolean(state.favorite),
            lastCookedAt: state.lastCookedAt || null,
          });
        });
      }

      const importedStateResult = await applyImportedPersonalState(driver, importedPersonalState, {
        mode,
        currentStateRecipeIds: cache.personalStateMap.keys(),
      });

      let importedWeekPlan = createEmptyWeekPlan();
      if (mode === 'restore') {
        const recipeLookup = new Map(workingRecipesById.entries());
        importedWeekPlan = mapImportedWeekPlan(
          normalizedPayload.weekPlan || normalizedPayload.personalState?.weekPlan,
          mappedRecipeIdBySource,
          recipeLookup,
        );
        await driver.saveWeekPlan(importedWeekPlan);
      }

      await this.reload();

      return {
        importedRecipes,
        duplicateRecipes,
        invalidRecipes,
        importedStateEntries: importedStateResult.importedEntries,
        removedStateEntries: importedStateResult.removedEntries,
        importedPlannerEntries: Object.values(importedWeekPlan).reduce((sum, entries) => sum + entries.length, 0),
        importMode: mode,
      };
    },

    async migrateLegacyLocalData() {
      const snapshot = getSnapshot();
      ensureAdmin(snapshot);

      const legacySnapshot = readLegacyLocalSnapshot(window.localStorage);
      if (!legacySnapshot.hasLegacyData) {
        return {
          migrated: false,
          importedRecipes: 0,
          duplicateRecipes: 0,
          invalidRecipes: 0,
          importedStateEntries: 0,
          removedStateEntries: 0,
          importedPlannerEntries: 0,
        };
      }

      const summary = await this.restoreCookbookPayload({
        app: 'mein-kochbuch',
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        recipes: legacySnapshot.recipes,
        weekPlan: legacySnapshot.weekPlan,
      });

      window.localStorage.setItem(MIGRATION_MARKER_KEY, 'true');
      return {
        migrated: true,
        ...summary,
      };
    },

    getLegacyLocalStateSummary() {
      const legacySnapshot = readLegacyLocalSnapshot(window.localStorage);
      return {
        hasLegacyData: legacySnapshot.hasLegacyData,
        alreadyMigrated: window.localStorage.getItem(MIGRATION_MARKER_KEY) === 'true',
      };
    },
  };
}

export function getLegacyLocalStateSummary() {
  const legacySnapshot = readLegacyLocalSnapshot(window.localStorage);
  return {
    hasLegacyData: legacySnapshot.hasLegacyData,
    alreadyMigrated: window.localStorage.getItem(MIGRATION_MARKER_KEY) === 'true',
  };
}
