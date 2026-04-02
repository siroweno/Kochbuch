import {
  buildExportPayload,
  buildPersonalStateMap,
  buildRecipeViewModels,
  createEmptyWeekPlan,
  extractLegacyPersonalState,
  generateId,
  getTitleKey,
  isDataUrl,
  isExternalImageUrl,
  isUuid,
  normalizeImportPayload,
  normalizeRecipeRecord,
  normalizeUserRecipeStateRecord,
  normalizeWeekPlan,
  readLegacyLocalSnapshot,
  mergeWeekPlans,
} from './cookbook-schema.js';

const MIGRATION_MARKER_KEY = 'cookbook_cloud_migration_done_v1';
const STORAGE_BUCKET = 'recipe-images';

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

async function parseJsonResponse(response) {
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const error = new Error(payload.error || payload.message || `Request failed with ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function mapRecipeRecordToRow(recipe, userId) {
  return {
    id: recipe.id,
    title: recipe.title,
    base_servings: recipe.baseServings,
    prep_time: recipe.prepTime,
    cook_time: recipe.cookTime,
    tags: recipe.tags,
    description: recipe.description,
    raw_ingredients: recipe.rawIngredients,
    parsed_ingredients: recipe.parsedIngredients,
    instructions: recipe.instructions,
    plating: recipe.plating,
    tips: recipe.tips,
    image_path: recipe.imagePath,
    external_image_url: recipe.externalImageUrl,
    created_at: recipe.createdAt,
    updated_at: recipe.updatedAt,
    created_by: userId || null,
    updated_by: userId || null,
  };
}

function dataUrlToBlob(dataUrl) {
  const [header, body] = String(dataUrl || '').split(',');
  const mimeMatch = header?.match(/^data:(.*?);base64$/);
  const mimeType = mimeMatch?.[1] || 'application/octet-stream';
  const binary = window.atob(body || '');
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

function createImagePath(filename = '') {
  const safeName = String(filename || 'rezeptbild.jpg')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'rezeptbild.jpg';
  return `recipes/${Date.now()}-${Math.random().toString(16).slice(2, 10)}-${safeName}`;
}

function cloneWeekPlan(weekPlan) {
  return JSON.parse(JSON.stringify(weekPlan || createEmptyWeekPlan()));
}

function extractResolvedImageUrls(rawRecipes = []) {
  return rawRecipes.reduce((map, rawRecipe) => {
    const recipeId = String(rawRecipe.id || '');
    const resolved = rawRecipe.resolvedImageUrl || rawRecipe.resolved_image_url || '';
    if (recipeId && resolved) {
      map.set(recipeId, resolved);
    }
    return map;
  }, new Map());
}

export function createCookbookRepository({ config, authService }) {
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
      capabilities: {
        canAdmin: snapshot.canAdmin,
      },
      migration: getLegacyLocalStateSummary(),
    };
  }

  async function resolveSupabaseImageUrls(sharedRecipes, supabase) {
    const imageUrlByRecipeId = new Map();

    await Promise.all(sharedRecipes.map(async (recipe) => {
      if (!recipe.imagePath) return;
      const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(recipe.imagePath, 60 * 60);
      if (data?.signedUrl) {
        imageUrlByRecipeId.set(recipe.id, data.signedUrl);
      }
    }));

    return imageUrlByRecipeId;
  }

  function createSupabaseDriver() {
    const supabase = authService.getSupabaseClient();

    return {
      async loadBundle() {
        const snapshot = getSnapshot();
        ensureSession(snapshot);

        await authService.syncProfileFromAllowlist();

        const [recipesResponse, stateResponse, planResponse] = await Promise.all([
          supabase
            .from('recipes')
            .select('*')
            .order('created_at', { ascending: false }),
          supabase
            .from('user_recipe_state')
            .select('recipe_id,favorite,last_cooked_at')
            .eq('user_id', snapshot.sessionUser.id),
          supabase
            .from('user_week_plan')
            .select('plan')
            .eq('user_id', snapshot.sessionUser.id)
            .maybeSingle(),
        ]);

        if (recipesResponse.error) throw recipesResponse.error;
        if (stateResponse.error) throw stateResponse.error;
        if (planResponse.error) throw planResponse.error;

        const rawRecipes = recipesResponse.data || [];
        const sharedRecipes = rawRecipes.map((row) => normalizeRecipeRecord({
          id: row.id,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          title: row.title,
          baseServings: row.base_servings,
          prepTime: row.prep_time,
          cookTime: row.cook_time,
          tags: row.tags,
          description: row.description,
          rawIngredients: row.raw_ingredients,
          parsedIngredients: row.parsed_ingredients,
          instructions: row.instructions,
          plating: row.plating,
          tips: row.tips,
          imagePath: row.image_path,
          externalImageUrl: row.external_image_url,
        })).filter((recipe) => recipe.title);

        const personalStateRecords = (stateResponse.data || []).map((row) => normalizeUserRecipeStateRecord({
          recipeId: row.recipe_id,
          favorite: row.favorite,
          lastCookedAt: row.last_cooked_at,
        }));

        const weekPlan = normalizeWeekPlan(planResponse.data?.plan || createEmptyWeekPlan(), new Map(sharedRecipes.map((recipe) => [recipe.id, recipe])));
        const imageUrlByRecipeId = await resolveSupabaseImageUrls(sharedRecipes, supabase);

        return {
          sharedRecipes,
          personalStateRecords,
          weekPlan,
          imageUrlByRecipeId,
        };
      },

      async saveRecipeRecord(recipe) {
        const snapshot = getSnapshot();
        ensureAdmin(snapshot);
        const { error } = await supabase.from('recipes').upsert(mapRecipeRecordToRow(recipe, snapshot.sessionUser.id));
        if (error) throw error;
      },

      async deleteRecipeRecord(recipeId) {
        const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
        if (error) throw error;
      },

      async upsertUserRecipeState(recipeId, patch) {
        const snapshot = getSnapshot();
        ensureSession(snapshot);
        const payload = {
          user_id: snapshot.sessionUser.id,
          recipe_id: recipeId,
          favorite: Boolean(patch.favorite),
          last_cooked_at: patch.lastCookedAt || null,
        };
        const { error } = await supabase.from('user_recipe_state').upsert(payload);
        if (error) throw error;
      },

      async saveWeekPlan(plan) {
        const snapshot = getSnapshot();
        ensureSession(snapshot);
        const { error } = await supabase.from('user_week_plan').upsert({
          user_id: snapshot.sessionUser.id,
          plan,
        });
        if (error) throw error;
      },

      async uploadImageDataUrl(dataUrl, filename) {
        const blob = dataUrlToBlob(dataUrl);
        const imagePath = createImagePath(filename);
        const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(imagePath, blob, {
          upsert: true,
          contentType: blob.type,
        });
        if (error) throw error;
        return { imagePath };
      },

      async deleteImage(imagePath) {
        if (!imagePath) return;
        await supabase.storage.from(STORAGE_BUCKET).remove([imagePath]);
      },
    };
  }

  function createBrowserTestDriver() {
    function getHeaders() {
      return {
        'Content-Type': 'application/json',
        ...authService.getBrowserTestHeaders(),
      };
    }

    async function request(pathname, options = {}) {
      const response = await fetch(`${config.browserTestBasePath}${pathname}`, {
        headers: getHeaders(),
        ...options,
      });
      return parseJsonResponse(response);
    }

    return {
      async loadBundle() {
        const payload = await request('/cookbook', { method: 'GET' });
        const sharedRecipes = (payload.recipes || []).map((recipe) => normalizeRecipeRecord(recipe)).filter((recipe) => recipe.title);
        const imageUrlByRecipeId = extractResolvedImageUrls(payload.recipes || []);
        const personalStateRecords = (payload.userRecipeState || []).map((state) => normalizeUserRecipeStateRecord(state));
        const weekPlan = normalizeWeekPlan(payload.weekPlan || createEmptyWeekPlan(), new Map(sharedRecipes.map((recipe) => [recipe.id, recipe])));
        return {
          sharedRecipes,
          personalStateRecords,
          weekPlan,
          imageUrlByRecipeId,
        };
      },

      async saveRecipeRecord(recipe) {
        const pathname = recipe.id && cache.sharedRecipes.some((existing) => existing.id === recipe.id)
          ? `/recipes/${encodeURIComponent(recipe.id)}`
          : '/recipes';
        const method = pathname === '/recipes' ? 'POST' : 'PUT';
        await request(pathname, {
          method,
          body: JSON.stringify({ recipe }),
        });
      },

      async deleteRecipeRecord(recipeId) {
        await request(`/recipes/${encodeURIComponent(recipeId)}`, {
          method: 'DELETE',
        });
      },

      async upsertUserRecipeState(recipeId, patch) {
        await request(`/user-recipe-state/${encodeURIComponent(recipeId)}`, {
          method: 'PUT',
          body: JSON.stringify({
            favorite: Boolean(patch.favorite),
            lastCookedAt: patch.lastCookedAt || null,
          }),
        });
      },

      async saveWeekPlan(plan) {
        await request('/week-plan', {
          method: 'PUT',
          body: JSON.stringify({ plan }),
        });
      },

      async uploadImageDataUrl(dataUrl, filename) {
        const payload = await request('/upload', {
          method: 'POST',
          body: JSON.stringify({ dataUrl, filename }),
        });
        return {
          imagePath: payload.imagePath,
        };
      },

      async deleteImage(_imagePath) {
        // browser-test mode keeps image payloads in server memory; recipe deletion is enough
      },
    };
  }

  function createDriver() {
    return config.backend === 'browser-test'
      ? createBrowserTestDriver()
      : createSupabaseDriver();
  }

  async function applyCacheFromBundle(bundle) {
    cache.sharedRecipes = bundle.sharedRecipes;
    cache.personalStateMap = buildPersonalStateMap(bundle.personalStateRecords);
    cache.weekPlan = bundle.weekPlan;
    cache.recipes = buildRecipeViewModels(bundle.sharedRecipes, cache.personalStateMap, bundle.imageUrlByRecipeId);
  }

  function getSharedRecipeById(recipeId) {
    return cache.sharedRecipes.find((recipe) => recipe.id === String(recipeId)) || null;
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

    if (!normalized.title) {
      throw new Error('Bitte gib einen Rezeptnamen ein.');
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
    });
  }

  async function applyPersonalStateImport(entries, mappedRecipeIdBySource) {
    const driver = createDriver();
    let importedEntries = 0;

    for (const entry of entries) {
      const mappedRecipeId = mappedRecipeIdBySource.get(String(entry.sourceRecipeId || entry.recipeId || ''))
        || String(entry.recipeId || '')
        || mappedRecipeIdBySource.get(getTitleKey(entry.title || ''));
      if (!mappedRecipeId) continue;

      await driver.upsertUserRecipeState(mappedRecipeId, {
        favorite: Boolean(entry.favorite),
        lastCookedAt: entry.lastCookedAt || null,
      });
      importedEntries += 1;
    }

    return importedEntries;
  }

  function mapImportedWeekPlan(rawWeekPlan, mappedRecipeIdBySource, recipeLookup) {
    const mapped = createEmptyWeekPlan();
    Object.assign(mapped, createEmptyWeekPlan());

    const sourceWeekPlan = normalizeWeekPlan(rawWeekPlan || createEmptyWeekPlan());

    Object.keys(sourceWeekPlan).forEach((day) => {
      mapped[day] = sourceWeekPlan[day]
        .map((entry) => {
          const targetRecipeId = mappedRecipeIdBySource.get(String(entry.recipeId)) || String(entry.recipeId);
          if (!recipeLookup.has(targetRecipeId)) return null;
          return {
            recipeId: targetRecipeId,
            servings: entry.servings,
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

    async exportCookbook() {
      if (!cache.sharedRecipes.length) {
        await this.loadAppData();
      }
      return buildExportPayload({
        sharedRecipes: cache.sharedRecipes,
        personalStateMap: cache.personalStateMap,
        weekPlan: cache.weekPlan,
      });
    },

    async importCookbookPayload(payload) {
      const snapshot = getSnapshot();
      ensureAdmin(snapshot);

      const normalizedPayload = normalizeImportPayload(payload);
      if (!normalizedPayload) {
        throw new Error('Ungültiges Dateiformat');
      }

      const driver = createDriver();
      const workingRecipes = [...cache.sharedRecipes];
      const knownTitles = new Map(workingRecipes.map((recipe) => [getTitleKey(recipe.title), recipe]));
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

        const normalizedRecipe = normalizeRecipeRecord(rawRecipe);
        if (!normalizedRecipe.title) {
          invalidRecipes += 1;
          continue;
        }

        const sourceKey = String(rawRecipe.id ?? normalizedRecipe.id);
        if (!isUuid(normalizedRecipe.id)) {
          normalizedRecipe.id = generateId();
        }

        const titleKey = getTitleKey(normalizedRecipe.title);
        const existing = knownTitles.get(titleKey);
        const recipeToSave = isUuid(normalizedRecipe.id)
          ? normalizedRecipe
          : {
            ...normalizedRecipe,
            id: generateId(),
          };

        if (existing) {
          duplicateRecipes += 1;
          mappedRecipeIdBySource.set(sourceKey, existing.id);
          importedPersonalState.push({
            sourceRecipeId: sourceKey,
            title: normalizedRecipe.title,
            ...extractLegacyPersonalState(rawRecipe),
          });
          continue;
        }

        if (recipeToSave.legacyImageDataUrl) {
          const upload = await driver.uploadImageDataUrl(recipeToSave.legacyImageDataUrl, `${recipeToSave.title}.jpg`);
          recipeToSave.imagePath = upload.imagePath;
          recipeToSave.externalImageUrl = null;
        }

        await driver.saveRecipeRecord(recipeToSave);
        workingRecipes.push(recipeToSave);
        knownTitles.set(titleKey, recipeToSave);
        mappedRecipeIdBySource.set(sourceKey, recipeToSave.id);
        importedPersonalState.push({
          sourceRecipeId: sourceKey,
          title: recipeToSave.title,
          ...extractLegacyPersonalState(rawRecipe),
        });
        importedRecipes += 1;
      }

      if (normalizedPayload.personalState?.recipeState) {
        normalizedPayload.personalState.recipeState.forEach((state) => {
          importedPersonalState.push({
            sourceRecipeId: state.recipeId,
            title: '',
            favorite: Boolean(state.favorite),
            lastCookedAt: state.lastCookedAt || null,
          });
        });
      }

      const importedStateCount = await applyPersonalStateImport(importedPersonalState, mappedRecipeIdBySource);
      const recipeLookup = new Map(workingRecipes.map((recipe) => [recipe.id, recipe]));
      const importedWeekPlan = mapImportedWeekPlan(
        normalizedPayload.weekPlan || normalizedPayload.personalState?.weekPlan,
        mappedRecipeIdBySource,
        recipeLookup,
      );
      const mergedWeekPlan = mergeWeekPlans(cache.weekPlan, importedWeekPlan);
      await driver.saveWeekPlan(mergedWeekPlan);

      await this.reload();

      return {
        importedRecipes,
        duplicateRecipes,
        invalidRecipes,
        importedStateEntries: importedStateCount,
        importedPlannerEntries: Object.values(importedWeekPlan).reduce((sum, entries) => sum + entries.length, 0),
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
          importedPlannerEntries: 0,
        };
      }

      const summary = await this.importCookbookPayload({
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
