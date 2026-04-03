import {
  createEmptyWeekPlan,
  hasRequiredRecipeFields,
  normalizeRecipeRecord,
  normalizeUserRecipeStateRecord,
  normalizeWeekPlan,
} from '../cookbook-schema.js';

function parseJsonResponse(response) {
  return response.text().then((text) => {
    const payload = text ? JSON.parse(text) : {};
    if (!response.ok) {
      const error = new Error(payload.error || payload.message || `Request failed with ${response.status}`);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  });
}

function isCompleteRecipeRecord(recipe) {
  return hasRequiredRecipeFields(recipe);
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

export function createBrowserTestRepositoryDriver({ authService, browserTestBasePath }) {
  function getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...authService.getBrowserTestHeaders(),
    };
  }

  async function request(pathname, options = {}) {
    const response = await fetch(`${browserTestBasePath}${pathname}`, {
      headers: getHeaders(),
      ...options,
    });
    return parseJsonResponse(response);
  }

  return {
    async loadBundle() {
      const payload = await request('/cookbook', { method: 'GET' });
      const sharedRecipes = (payload.recipes || []).map((recipe) => normalizeRecipeRecord(recipe)).filter(isCompleteRecipeRecord);
      const imageUrlByRecipeId = extractResolvedImageUrls(payload.recipes || []);
      const personalStateRecords = (payload.userRecipeState || []).map((state) => normalizeUserRecipeStateRecord(state));
      const weekPlan = normalizeWeekPlan(
        payload.weekPlan || createEmptyWeekPlan(),
        new Map(sharedRecipes.map((recipe) => [recipe.id, recipe])),
      );
      return {
        sharedRecipes,
        personalStateRecords,
        weekPlan,
        imageUrlByRecipeId,
      };
    },

    async saveRecipeRecord(recipe, { existingRecipeIds = [] } = {}) {
      if (!isCompleteRecipeRecord(recipe)) {
        throw new Error('Bitte gib Titel, Zutaten und Zubereitung an.');
      }
      const pathname = recipe.id && existingRecipeIds.includes(recipe.id)
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

    async deleteUserRecipeState(recipeId) {
      await request(`/user-recipe-state/${encodeURIComponent(recipeId)}`, {
        method: 'DELETE',
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
