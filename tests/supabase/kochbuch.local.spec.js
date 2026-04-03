const { randomUUID } = require('crypto');
const { test, expect } = require('@playwright/test');
const { createClient } = require('@supabase/supabase-js');

function getLocalSupabaseEnv() {
  return {
    url: process.env.SUPABASE_URL || process.env.API_URL || '',
    anonKey: process.env.SUPABASE_ANON_KEY || process.env.ANON_KEY || '',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || '',
  };
}

function hasLocalSupabaseEnv() {
  const env = getLocalSupabaseEnv();
  return Boolean(env.url && env.anonKey && env.serviceRoleKey);
}

function createServiceClient() {
  const env = getLocalSupabaseEnv();
  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function createAnonClient() {
  const env = getLocalSupabaseEnv();
  return createClient(env.url, env.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function buildRecipeRow(overrides = {}) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: 'Supabase Testgericht',
    base_servings: 2,
    prep_time: 10,
    cook_time: 20,
    tags: ['Test'],
    description: 'Lokales Supabase-Rezept',
    raw_ingredients: '1 Zwiebel\n2 Karotten',
    parsed_ingredients: [
      { quantity: 1, unit: null, name: 'Zwiebel' },
      { quantity: 2, unit: null, name: 'Karotten' },
    ],
    instructions: 'Alles kochen.',
    plating: '',
    tips: '',
    image_path: null,
    external_image_url: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

async function createUser(serviceClient, { email, password }) {
  const { data, error } = await serviceClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    throw error;
  }

  return data.user;
}

async function signInUser({ email, password }) {
  const client = createAnonClient();
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return client;
}

async function cleanupCookbookState(serviceClient) {
  await serviceClient.from('user_week_plan').delete().not('user_id', 'is', null);
  await serviceClient.from('user_recipe_state').delete().not('user_id', 'is', null);
  await serviceClient.from('recipes').delete().not('id', 'is', null);
  await serviceClient.from('admin_emails').delete().not('email', 'is', null);

  const { data: objects } = await serviceClient.storage.from('recipe-images').list('recipes', {
    limit: 100,
  });
  if (Array.isArray(objects) && objects.length > 0) {
    await serviceClient.storage.from('recipe-images').remove(
      objects.map((object) => `recipes/${object.name}`),
    );
  }
}

test.describe('Kochbuch local Supabase integration', () => {
  test.beforeEach(async () => {
    test.skip(!hasLocalSupabaseEnv(), 'Set SUPABASE_URL/API_URL, SUPABASE_ANON_KEY/ANON_KEY and SUPABASE_SERVICE_ROLE_KEY/SERVICE_ROLE_KEY after `supabase start`.');
    await cleanupCookbookState(createServiceClient());
  });

  test('hardened RPC only syncs the signed-in user profile', async () => {
    const serviceClient = createServiceClient();
    const suffix = Date.now();
    const adminEmail = `admin-${suffix}@kochbuch.local`;
    const readerEmail = `reader-${suffix}@kochbuch.local`;
    const password = 'kochbuch-secret-123';

    const adminUser = await createUser(serviceClient, { email: adminEmail, password });
    await createUser(serviceClient, { email: readerEmail, password });
    await serviceClient.from('admin_emails').upsert({ email: adminEmail });

    const readerClient = await signInUser({ email: readerEmail, password });
    const adminClient = await signInUser({ email: adminEmail, password });

    const safeReaderSync = await readerClient.rpc('sync_profile_for_current_user');
    expect(safeReaderSync.error).toBeNull();

    const unsafeSync = await readerClient.rpc('sync_profile_for_user', {
      target_user_id: adminUser.id,
      target_user_email: adminEmail,
    });
    expect(unsafeSync.error).not.toBeNull();

    const safeAdminSync = await adminClient.rpc('sync_profile_for_current_user');
    expect(safeAdminSync.error).toBeNull();

    const { data: profiles, error: profilesError } = await serviceClient
      .from('profiles')
      .select('id,email,role')
      .in('email', [adminEmail, readerEmail]);
    expect(profilesError).toBeNull();
    const profileByEmail = new Map((profiles || []).map((profile) => [profile.email, profile]));
    expect(profileByEmail.get(adminEmail)?.role).toBe('admin');
    expect(profileByEmail.get(readerEmail)?.role).toBe('reader');
  });

  test('RLS and storage separate shared recipes from personal state', async () => {
    const serviceClient = createServiceClient();
    const suffix = Date.now();
    const adminEmail = `admin-storage-${suffix}@kochbuch.local`;
    const readerEmail = `reader-storage-${suffix}@kochbuch.local`;
    const password = 'kochbuch-secret-123';

    const adminUser = await createUser(serviceClient, { email: adminEmail, password });
    const readerUser = await createUser(serviceClient, { email: readerEmail, password });
    await serviceClient.from('admin_emails').upsert({ email: adminEmail });

    const adminClient = await signInUser({ email: adminEmail, password });
    const readerClient = await signInUser({ email: readerEmail, password });
    await adminClient.rpc('sync_profile_for_current_user');
    await readerClient.rpc('sync_profile_for_current_user');

    const recipeRow = buildRecipeRow({
      created_by: adminUser.id,
      updated_by: adminUser.id,
    });
    const insertRecipe = await adminClient.from('recipes').insert(recipeRow).select('id').single();
    expect(insertRecipe.error).toBeNull();

    const readerRecipeInsert = await readerClient.from('recipes').insert(buildRecipeRow());
    expect(readerRecipeInsert.error).not.toBeNull();

    const readerRecipes = await readerClient.from('recipes').select('id,title');
    expect(readerRecipes.error).toBeNull();
    expect(readerRecipes.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: recipeRow.id, title: recipeRow.title }),
      ]),
    );

    const readerState = await readerClient.from('user_recipe_state').upsert({
      user_id: readerUser.id,
      recipe_id: recipeRow.id,
      favorite: true,
      last_cooked_at: new Date().toISOString(),
    });
    expect(readerState.error).toBeNull();

    const readerWeekPlan = await readerClient.from('user_week_plan').upsert({
      user_id: readerUser.id,
      plan: {
        Mo: [{ recipeId: recipeRow.id, servings: 3, slot: 'abend' }],
        Di: [],
        Mi: [],
        Do: [],
        Fr: [],
        Sa: [],
        So: [],
      },
    });
    expect(readerWeekPlan.error).toBeNull();

    const adminOwnState = await adminClient
      .from('user_recipe_state')
      .select('recipe_id,favorite')
      .eq('user_id', adminUser.id);
    expect(adminOwnState.error).toBeNull();
    expect(adminOwnState.data || []).toHaveLength(0);

    const imagePath = `recipes/${randomUUID()}.png`;
    const upload = await adminClient.storage
      .from('recipe-images')
      .upload(imagePath, new Blob(['test-image'], { type: 'image/png' }), {
        contentType: 'image/png',
        upsert: true,
      });
    expect(upload.error).toBeNull();

    const readerUpload = await readerClient.storage
      .from('recipe-images')
      .upload(`recipes/${randomUUID()}.png`, new Blob(['denied'], { type: 'image/png' }), {
        contentType: 'image/png',
        upsert: true,
      });
    expect(readerUpload.error).not.toBeNull();

    const signedUrl = await readerClient.storage.from('recipe-images').createSignedUrl(imagePath, 60);
    expect(signedUrl.error).toBeNull();
    expect(signedUrl.data?.signedUrl).toMatch(/^https?:\/\//);
  });
});
