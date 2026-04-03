import {
  createEmptyWeekPlan,
  hasRequiredRecipeFields,
  normalizeRecipeRecord,
  normalizeUserRecipeStateRecord,
  normalizeWeekPlan,
} from '../cookbook-schema.js';

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

function isCompleteRecipeRecord(recipe) {
  return hasRequiredRecipeFields(recipe);
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

export function createSupabaseRepositoryDriver({ authService }) {
  const supabase = authService.getSupabaseClient();

  return {
    async loadBundle() {
      const snapshot = authService.getSnapshot();
      ensureSession(snapshot);

      if (typeof authService.syncProfileForCurrentUser === 'function') {
        await authService.syncProfileForCurrentUser();
      }

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
      })).filter(isCompleteRecipeRecord);

      const personalStateRecords = (stateResponse.data || []).map((row) => normalizeUserRecipeStateRecord({
        recipeId: row.recipe_id,
        favorite: row.favorite,
        lastCookedAt: row.last_cooked_at,
      }));

      const weekPlan = normalizeWeekPlan(
        planResponse.data?.plan || createEmptyWeekPlan(),
        new Map(sharedRecipes.map((recipe) => [recipe.id, recipe])),
      );
      const imageUrlByRecipeId = await resolveSupabaseImageUrls(sharedRecipes, supabase);

      return {
        sharedRecipes,
        personalStateRecords,
        weekPlan,
        imageUrlByRecipeId,
      };
    },

    async saveRecipeRecord(recipe) {
      const snapshot = authService.getSnapshot();
      ensureAdmin(snapshot);
      if (!isCompleteRecipeRecord(recipe)) {
        throw new Error('Bitte gib Titel, Zutaten und Zubereitung an.');
      }
      const { error } = await supabase.from('recipes').upsert(mapRecipeRecordToRow(recipe, snapshot.sessionUser.id));
      if (error) throw error;
    },

    async deleteRecipeRecord(recipeId) {
      const { error } = await supabase.from('recipes').delete().eq('id', recipeId);
      if (error) throw error;
    },

    async upsertUserRecipeState(recipeId, patch) {
      const snapshot = authService.getSnapshot();
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

    async deleteUserRecipeState(recipeId) {
      const snapshot = authService.getSnapshot();
      ensureSession(snapshot);
      const { error } = await supabase
        .from('user_recipe_state')
        .delete()
        .eq('user_id', snapshot.sessionUser.id)
        .eq('recipe_id', recipeId);
      if (error) throw error;
    },

    async saveWeekPlan(plan) {
      const snapshot = authService.getSnapshot();
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
