const http = require('http');
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

const HOST = '127.0.0.1';
const PORT = Number(process.env.PORT || 4173);
const ROOT_DIR = __dirname;
const ADMIN_TEST_EMAIL = 'admin@kochbuch.local';
const ALLOWED_STATIC_PATHS = new Set(['/index.html', '/runtime-config.js']);
const ALLOWED_STATIC_PREFIXES = ['/src/', '/data/'];

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
};

function createEmptyWeekPlan() {
  return { Mo: [], Di: [], Mi: [], Do: [], Fr: [], Sa: [], So: [] };
}

function normalizeMultilineText(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizePositiveInteger(value, fallback = 2) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function hasRequiredRecipeFields(recipe) {
  return String(recipe.title || '').trim().length > 0
    && normalizeMultilineText(recipe.rawIngredients).length > 0
    && normalizeMultilineText(recipe.instructions).length > 0;
}

function createDefaultState() {
  return {
    usersByEmail: {},
    sessions: {},
    recipes: [],
    userRecipeStateByUserId: {},
    userWeekPlanByUserId: {},
    storage: {},
  };
}

let browserTestState = createDefaultState();

function getAuthToken(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function getUserFromSession(request) {
  const token = getAuthToken(request);
  if (!token || !browserTestState.sessions[token]) {
    return null;
  }
  return browserTestState.sessions[token];
}

function getProfileForEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  const user = browserTestState.usersByEmail[normalizedEmail];
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    role: normalizedEmail === ADMIN_TEST_EMAIL ? 'admin' : 'reader',
    is_active: true,
  };
}

function ensureUser(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!browserTestState.usersByEmail[normalizedEmail]) {
    browserTestState.usersByEmail[normalizedEmail] = {
      id: randomUUID(),
      email: normalizedEmail,
    };
  }
  return browserTestState.usersByEmail[normalizedEmail];
}

function getUserRecipeState(userId) {
  if (!browserTestState.userRecipeStateByUserId[userId]) {
    browserTestState.userRecipeStateByUserId[userId] = {};
  }
  return browserTestState.userRecipeStateByUserId[userId];
}

function getUserWeekPlan(userId) {
  if (!browserTestState.userWeekPlanByUserId[userId]) {
    browserTestState.userWeekPlanByUserId[userId] = createEmptyWeekPlan();
  }
  return browserTestState.userWeekPlanByUserId[userId];
}

function serializeRecipe(recipe) {
  return {
    ...recipe,
    resolvedImageUrl: recipe.imagePath ? browserTestState.storage[recipe.imagePath]?.dataUrl || '' : '',
  };
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
}

function requireMember(request, response) {
  const session = getUserFromSession(request);
  if (!session) {
    writeJson(response, 401, { error: 'Nicht angemeldet.' });
    return null;
  }

  const profile = getProfileForEmail(session.email);
  if (!profile) {
    writeJson(response, 403, { error: 'Kein Zugriff.' });
    return null;
  }

  return { session, profile };
}

function requireAdmin(request, response) {
  const auth = requireMember(request, response);
  if (!auth) return null;
  if (auth.profile.role !== 'admin') {
    writeJson(response, 403, { error: 'Nur Admins duerfen diese Aktion ausfuehren.' });
    return null;
  }
  return auth;
}

function normalizeRecipePayload(recipe) {
  return {
    id: String(recipe.id || randomUUID()),
    createdAt: recipe.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    title: String(recipe.title || '').trim(),
    baseServings: normalizePositiveInteger(recipe.baseServings, 2),
    prepTime: Number(recipe.prepTime || 0),
    cookTime: Number(recipe.cookTime || 0),
    tags: Array.isArray(recipe.tags) ? recipe.tags : [],
    description: String(recipe.description || ''),
    rawIngredients: normalizeMultilineText(recipe.rawIngredients || ''),
    parsedIngredients: Array.isArray(recipe.parsedIngredients) ? recipe.parsedIngredients : [],
    instructions: normalizeMultilineText(recipe.instructions || ''),
    plating: String(recipe.plating || ''),
    tips: String(recipe.tips || ''),
    imagePath: recipe.imagePath || null,
    externalImageUrl: recipe.externalImageUrl || null,
  };
}

function applySeed(seed) {
  if (!seed || typeof seed !== 'object') return;

  if (Array.isArray(seed.recipes)) {
    browserTestState.recipes = seed.recipes.map((recipe) => normalizeRecipePayload(recipe));
  }

  if (seed.storage && typeof seed.storage === 'object') {
    browserTestState.storage = { ...seed.storage };
  }
}

async function handleBrowserTestApi(request, response, pathname) {
  if (request.method === 'POST' && pathname === '/api/browser-test/reset') {
    const payload = await readJson(request).catch(() => ({}));
    browserTestState = createDefaultState();
    applySeed(payload.seed);
    writeJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/browser-test/login') {
    const payload = await readJson(request);
    const email = normalizeEmail(payload.email);
    if (!email) {
      writeJson(response, 400, { error: 'E-Mail fehlt.' });
      return true;
    }

    const user = ensureUser(email);
    const sessionToken = randomUUID();
    browserTestState.sessions[sessionToken] = {
      token: sessionToken,
      userId: user.id,
      email: user.email,
    };
    const profile = getProfileForEmail(email);

    writeJson(response, 200, {
      sessionToken,
      accessState: 'signed_in',
      sessionUser: { id: user.id, email: user.email },
      profile,
      message: 'Im Browser-Test-Backend wurdest du direkt angemeldet.',
    });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/browser-test/logout') {
    const token = getAuthToken(request);
    if (token) {
      delete browserTestState.sessions[token];
    }
    writeJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/browser-test/session') {
    const session = getUserFromSession(request);
    if (!session) {
      writeJson(response, 200, {
        accessState: 'signed_out',
        sessionUser: null,
        profile: null,
      });
      return true;
    }

    const profile = getProfileForEmail(session.email);
    writeJson(response, 200, {
      accessState: profile ? 'signed_in' : 'signed_out',
      sessionUser: { id: session.userId, email: session.email },
      profile,
      message: profile ? '' : 'Session konnte nicht zugeordnet werden.',
    });
    return true;
  }

  if (request.method === 'GET' && pathname === '/api/browser-test/cookbook') {
    const auth = requireMember(request, response);
    if (!auth) return true;
    const userRecipeState = Object.entries(getUserRecipeState(auth.session.userId)).map(([recipeId, state]) => ({
      recipeId,
      favorite: Boolean(state.favorite),
      lastCookedAt: state.lastCookedAt || null,
    }));
    writeJson(response, 200, {
      recipes: browserTestState.recipes.map((recipe) => serializeRecipe(recipe)),
      userRecipeState,
      weekPlan: getUserWeekPlan(auth.session.userId),
    });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/browser-test/recipes') {
    const auth = requireAdmin(request, response);
    if (!auth) return true;
    const payload = await readJson(request);
    const recipe = normalizeRecipePayload(payload.recipe || {});
    if (!hasRequiredRecipeFields(recipe)) {
      writeJson(response, 400, { error: 'Bitte gib Titel, Zutaten und Zubereitung an.' });
      return true;
    }
    browserTestState.recipes.unshift(recipe);
    writeJson(response, 200, { recipe: serializeRecipe(recipe) });
    return true;
  }

  if (request.method === 'PUT' && pathname.startsWith('/api/browser-test/recipes/')) {
    const auth = requireAdmin(request, response);
    if (!auth) return true;
    const recipeId = decodeURIComponent(pathname.split('/').pop());
    const payload = await readJson(request);
    const nextRecipe = normalizeRecipePayload({
      ...(browserTestState.recipes.find((recipe) => recipe.id === recipeId) || {}),
      ...(payload.recipe || {}),
      id: recipeId,
    });
    if (!hasRequiredRecipeFields(nextRecipe)) {
      writeJson(response, 400, { error: 'Bitte gib Titel, Zutaten und Zubereitung an.' });
      return true;
    }
    browserTestState.recipes = browserTestState.recipes.map((recipe) => (recipe.id === recipeId ? nextRecipe : recipe));
    writeJson(response, 200, { recipe: serializeRecipe(nextRecipe) });
    return true;
  }

  if (request.method === 'DELETE' && pathname.startsWith('/api/browser-test/recipes/')) {
    const auth = requireAdmin(request, response);
    if (!auth) return true;
    const recipeId = decodeURIComponent(pathname.split('/').pop());
    browserTestState.recipes = browserTestState.recipes.filter((recipe) => recipe.id !== recipeId);
    Object.values(browserTestState.userRecipeStateByUserId).forEach((stateByRecipeId) => {
      delete stateByRecipeId[recipeId];
    });
    Object.values(browserTestState.userWeekPlanByUserId).forEach((weekPlan) => {
      Object.keys(weekPlan).forEach((day) => {
        weekPlan[day] = (weekPlan[day] || []).filter((entry) => entry.recipeId !== recipeId);
      });
    });
    writeJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === 'PUT' && pathname.startsWith('/api/browser-test/user-recipe-state/')) {
    const auth = requireMember(request, response);
    if (!auth) return true;
    const recipeId = decodeURIComponent(pathname.split('/').pop());
    const payload = await readJson(request);
    const stateByRecipeId = getUserRecipeState(auth.session.userId);
    stateByRecipeId[recipeId] = {
      favorite: Boolean(payload.favorite),
      lastCookedAt: payload.lastCookedAt || null,
    };
    writeJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === 'DELETE' && pathname.startsWith('/api/browser-test/user-recipe-state/')) {
    const auth = requireMember(request, response);
    if (!auth) return true;
    const recipeId = decodeURIComponent(pathname.split('/').pop());
    delete getUserRecipeState(auth.session.userId)[recipeId];
    writeJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === 'PUT' && pathname === '/api/browser-test/week-plan') {
    const auth = requireMember(request, response);
    if (!auth) return true;
    const payload = await readJson(request);
    browserTestState.userWeekPlanByUserId[auth.session.userId] = payload.plan || createEmptyWeekPlan();
    writeJson(response, 200, { ok: true });
    return true;
  }

  if (request.method === 'POST' && pathname === '/api/browser-test/upload') {
    const auth = requireAdmin(request, response);
    if (!auth) return true;
    const payload = await readJson(request);
    if (!payload.dataUrl) {
      writeJson(response, 400, { error: 'Bilddaten fehlen.' });
      return true;
    }
    const imagePath = `recipes/${Date.now()}-${Math.random().toString(16).slice(2, 10)}-${String(payload.filename || 'bild.jpg').replace(/[^a-zA-Z0-9._-]+/g, '-')}`;
    browserTestState.storage[imagePath] = {
      dataUrl: payload.dataUrl,
    };
    writeJson(response, 200, { imagePath });
    return true;
  }

  return false;
}

function serveStaticFile(requestPath, response) {
  const relativePath = requestPath === '/' ? '/index.html' : requestPath;
  const canServe = ALLOWED_STATIC_PATHS.has(relativePath)
    || ALLOWED_STATIC_PREFIXES.some((prefix) => relativePath.startsWith(prefix));

  if (!canServe) {
    writeJson(response, 404, { error: 'Not found' });
    return;
  }

  const absolutePath = path.resolve(ROOT_DIR, `.${relativePath}`);

  if (!absolutePath.startsWith(ROOT_DIR)) {
    writeJson(response, 403, { error: 'Forbidden' });
    return;
  }

  fs.readFile(absolutePath, (error, buffer) => {
    if (error) {
      writeJson(response, 404, { error: 'Not found' });
      return;
    }

    const extension = path.extname(absolutePath).toLowerCase();
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[extension] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    });
    response.end(buffer);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    const handled = await handleBrowserTestApi(request, response, url.pathname);
    if (handled) return;
  } catch (error) {
    writeJson(response, 500, { error: error.message || 'Serverfehler' });
    return;
  }

  serveStaticFile(url.pathname, response);
});

server.listen(PORT, HOST, () => {
  console.log(`Kochbuch server listening on http://${HOST}:${PORT}`);
});
