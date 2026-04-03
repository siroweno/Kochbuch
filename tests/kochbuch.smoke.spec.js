const { test, expect } = require('@playwright/test');
const {
  addPlannedRecipe,
  createRecipeViaUi,
  expectNotification,
  dragPlannedRecipeToSlot,
  exportCookbook,
  importCookbook,
  loginViaUi,
  openLoggedInPage,
  openPlanner,
  resetBrowserTestBackend,
} = require('./support/browser-test-helpers.js');

async function seedLegacyLocalStorage(page) {
  await page.addInitScript(() => {
    localStorage.setItem('cookbook_recipes', JSON.stringify([
      {
        id: 101,
        title: 'Legacy Suppe',
        ingredients: '300 ml Brühe\n1 Karotte\n200 g Kartoffeln',
        instructions: 'Alles kochen lassen',
        tags: ['Suppe', 'Altbestand'],
        createdAt: '01.04.2026',
        favorite: true,
        lastCookedAt: '2026-04-01T10:00:00.000Z',
        imageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7X8J0AAAAASUVORK5CYII=',
      },
    ]));
    localStorage.setItem('cookbook_weekplan', JSON.stringify({
      Mo: [{ recipeId: 101, servings: 4, slot: 'abend' }],
      Di: [],
      Mi: [],
      Do: [],
      Fr: [],
      Sa: [],
      So: [],
    }));
  });
}

async function expectBuiltAssetsServed(request) {
  const indexResponse = await request.get('/index.html');
  expect(indexResponse.ok(), 'expected /index.html to be served').toBeTruthy();
  const html = await indexResponse.text();

  const assetPaths = Array.from(html.matchAll(/(?:href|src)="\.?\/?(assets\/[^"]+)"/g))
    .map((match) => `/${match[1]}`);
  expect(assetPaths.length, 'expected built asset references in index.html').toBeGreaterThan(0);

  for (const pathname of ['/runtime-config.js', ...assetPaths, '/data/familienkochbuch-import.json']) {
    const response = await request.get(pathname);
    expect(response.ok(), `expected ${pathname} to be served`).toBeTruthy();
  }
}

test.describe('Privates Familien-Kochbuch', () => {
  test.beforeEach(async ({ request }) => {
    await resetBrowserTestBackend(request);
  });

  test('lokaler Testserver liefert nur erlaubte App-Assets aus', async ({ request }) => {
    await expectBuiltAssetsServed(request);

    const blocked = ['/package.json', '/server.js', '/README.md', '/supabase/seed.sql'];
    for (const pathname of blocked) {
      const response = await request.get(pathname);
      expect(response.status(), `expected ${pathname} to be blocked`).toBe(404);
    }
  });

  test('ordnet Admin und beliebige Reader-Logins automatisch zu', async ({ browser }) => {
    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');
    await expect(adminSession.page.locator('#toggleFormBtn')).toBeVisible();
    await expect(adminSession.page.locator('#restoreImportBtn')).toBeVisible();
    await expect(adminSession.page.locator('#recipeImportBtn')).toBeVisible();
    await expect(adminSession.page.locator('#exportBtn')).toBeVisible();
    await adminSession.context.close();

    const readerSession = await openLoggedInPage(browser, 'reader@kochbuch.local');
    await expect(readerSession.page.locator('#toggleFormBtn')).toBeHidden();
    await expect(readerSession.page.locator('#restoreImportBtn')).toBeHidden();
    await expect(readerSession.page.locator('#recipeImportBtn')).toBeHidden();
    await expect(readerSession.page.locator('#exportBtn')).toBeHidden();
    await readerSession.context.close();

    const anyReaderContext = await browser.newContext();
    const anyReaderPage = await anyReaderContext.newPage();
    await loginViaUi(anyReaderPage, 'anyone@example.com');
    await expect(anyReaderPage.locator('#toggleFormBtn')).toBeHidden();
    await expect(anyReaderPage.locator('#restoreImportBtn')).toBeHidden();
    await expect(anyReaderPage.locator('#recipeImportBtn')).toBeHidden();
    await expect(anyReaderPage.locator('#exportBtn')).toBeHidden();
    await anyReaderContext.close();
  });

  test('Admin kann Shared Recipe CRUD ausfuehren', async ({ browser }) => {
    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');

    await createRecipeViaUi(adminSession.page, {
      title: 'Familien Lasagne',
      tags: 'Pasta, Ofen, Familie',
      ingredients: '500 g Lasagneblätter\n400 g Rinderhack\n250 ml Béchamel',
      instructions: 'Schichten und backen',
      description: 'Ein gemeinsames Rezept fuer alle.',
    });

    await adminSession.page.locator('.recipe-card').first().locator('[data-action="open-recipe"]').click();
    await adminSession.page.getByRole('button', { name: 'Bearbeiten' }).click();
    await adminSession.page.getByLabel('Rezeptname *').fill('Familien Lasagne Deluxe');
    await adminSession.page.getByRole('button', { name: 'Rezept speichern' }).click();
    await expect(adminSession.page.locator('.recipe-card').filter({ hasText: 'Familien Lasagne Deluxe' })).toHaveCount(1);

    await adminSession.page.locator('.recipe-card').filter({ hasText: 'Familien Lasagne Deluxe' }).locator('[data-action="delete-recipe"]').click();
    await adminSession.page.locator('#confirmDeleteBtn').click();
    await expect(adminSession.page.locator('.recipe-card')).toHaveCount(0);

    await adminSession.context.close();
  });

  test('gemeinsame Rezepte bleiben global, persönliche Zustände aber pro Nutzer getrennt', async ({ browser }) => {
    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');

    await createRecipeViaUi(adminSession.page, {
      title: 'Omas Pasta',
      tags: 'Pasta, Familie',
      ingredients: '200 g Pasta\n2 Eier\n50 g Parmesan',
      instructions: 'Kochen, mischen, servieren',
    });

    const readerSession = await openLoggedInPage(browser, 'reader@kochbuch.local');
    await expect(readerSession.page.locator('.recipe-card').filter({ hasText: 'Omas Pasta' })).toHaveCount(1);
    await expect(readerSession.page.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'false');

    await readerSession.page.locator('[data-action="toggle-favorite"]').first().click();
    await openPlanner(readerSession.page);
    await addPlannedRecipe(readerSession.page, 'Di', 'Omas Pasta');
    await readerSession.page.locator('[data-action="plan-serving"][data-day="Di"]').first().selectOption('2');
    await readerSession.page.locator('[data-action="plan-slot"][data-day="Di"]').first().selectOption('mittag');
    await readerSession.page.locator('[data-action="mark-cooked"]').first().click();
    await expect(readerSession.page.locator('.recipe-card').filter({ hasText: 'Omas Pasta' }).locator('.card-meta')).toContainText('Heute gekocht');
    await expect(readerSession.page.locator('[data-action="plan-serving"][data-day="Di"]').first()).toHaveValue('2');
    await expect(readerSession.page.locator('[data-action="plan-slot"][data-day="Di"]').first()).toHaveValue('mittag');
    await readerSession.context.close();

    await adminSession.page.reload();
    await adminSession.page.waitForLoadState('networkidle');
    await expect(adminSession.page.locator('.recipe-card').filter({ hasText: 'Omas Pasta' })).toHaveCount(1);
    await expect(adminSession.page.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'false');
    await expect(adminSession.page.locator('.recipe-card').filter({ hasText: 'Omas Pasta' })).not.toContainText('Heute gekocht');
    await openPlanner(adminSession.page);
    await expect(adminSession.page.locator('[data-action="plan-serving"][data-day="Di"]')).toHaveCount(0);
    await adminSession.context.close();
  });

  test('Legacy localStorage wird migriert und als schemaVersion 4 exportiert', async ({ browser, request }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedLegacyLocalStorage(page);
    await loginViaUi(page, 'admin@kochbuch.local');

    const migrateButton = page.getByRole('button', { name: /Lokale Daten migrieren/i });
    await expect(migrateButton).toBeVisible();
    await migrateButton.click();
    await expectNotification(page, /(importiert|wiederhergestellt)/i);

    await expect(page.locator('.recipe-card').filter({ hasText: 'Legacy Suppe' })).toHaveCount(1);
    await expect(page.locator('.recipe-card').filter({ hasText: 'Legacy Suppe' }).locator('img')).toBeVisible();
    await expect(page.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'true');

    await openPlanner(page);
    await expect(page.locator('[data-action="plan-serving"][data-day="Mo"]').first()).toHaveValue('4');
    await expect(page.locator('[data-action="plan-slot"][data-day="Mo"]').first()).toHaveValue('abend');

    const exportContent = await exportCookbook(page, testInfo);
    expect(exportContent.schemaVersion).toBe(4);
    expect(Array.isArray(exportContent.recipes)).toBe(true);
    const exportedRecipe = exportContent.recipes.find((recipe) => recipe.title === 'Legacy Suppe');
    expect(Boolean(exportedRecipe)).toBe(true);
    expect(exportedRecipe.portableImageDataUrl).toMatch(/^data:/);
    expect(Array.isArray(exportContent.personalState.recipeState)).toBe(true);
    expect(exportContent.personalState.weekPlan.Mo[0].servings).toBe(4);
    expect(exportContent.personalState.weekPlan.Mo[0].slot).toBe('abend');

    await context.close();
  });

  test('Admin kann Legacy-JSON mit numerischen Rezept-IDs importieren', async ({ browser }, testInfo) => {
    const importContext = await browser.newContext();
    const importPage = await importContext.newPage();
    await loginViaUi(importPage, 'admin@kochbuch.local');

    await importCookbook(importPage, [
      {
        id: 1775135603783,
        title: 'Toskanische Suppe',
        ingredients: '1 Zwiebel\n2 Karotten\n400 g Bohnen',
        instructions: 'Alles zusammen kochen und abschmecken.',
        tags: ['Suppe', 'Familie'],
        createdAt: '02.04.2026',
      },
      {
        id: 1775133491637,
        title: 'Lauwarmer Linsensalat „Green & Creamy“',
        ingredients: '250 g Linsen\n1 Gurke\nJoghurt',
        instructions: 'Linsen kochen, mischen und lauwarm servieren.',
        tags: ['Salat'],
        createdAt: '02.04.2026',
      },
    ], { mode: 'additive' });

    await expect(importPage.locator('.recipe-card').filter({ hasText: 'Toskanische Suppe' })).toHaveCount(1);
    await expect(importPage.locator('.recipe-card').filter({ hasText: 'Lauwarmer Linsensalat „Green & Creamy“' })).toHaveCount(1);

    const exportedContent = await exportCookbook(importPage, testInfo);
    const importedRecipeIds = exportedContent.recipes
      .filter((recipe) => ['Toskanische Suppe', 'Lauwarmer Linsensalat „Green & Creamy“'].includes(recipe.title))
      .map((recipe) => recipe.id);
    expect(importedRecipeIds).toHaveLength(2);
    importedRecipeIds.forEach((id) => {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    await importContext.close();
  });

  test('Admin kann schemaVersion 4 export wieder importieren', async ({ browser, request }, testInfo) => {
    const createContext = await browser.newContext();
    const createPage = await createContext.newPage();
    await loginViaUi(createPage, 'admin@kochbuch.local');

    await createRecipeViaUi(createPage, {
      title: 'Import Pasta',
      tags: 'Import, Test',
      ingredients: '200 g Pasta\n1 Zwiebel\n2 EL Olivenoel',
      instructions: 'Kochen und vermengen',
    });

    await createPage.locator('[data-action="toggle-favorite"]').first().click();
    await openPlanner(createPage);
    await addPlannedRecipe(createPage, 'Mi', 'Import Pasta');
    await createPage.locator('[data-action="plan-serving"][data-day="Mi"]').first().selectOption('3');
    await createPage.locator('[data-action="plan-slot"][data-day="Mi"]').first().selectOption('abend');

    const exportContent = await exportCookbook(createPage, testInfo);
    expect(exportContent.schemaVersion).toBe(4);
    await createContext.close();

    await resetBrowserTestBackend(request);

    const importContext = await browser.newContext();
    const importPage = await importContext.newPage();
    await loginViaUi(importPage, 'admin@kochbuch.local');
    await importCookbook(importPage, exportContent, { mode: 'restore' });

    await expect(importPage.locator('.recipe-card').filter({ hasText: 'Import Pasta' })).toHaveCount(1);
    await expect(importPage.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'true');

    await openPlanner(importPage);
    await expect(importPage.locator('[data-action="plan-serving"][data-day="Mi"]').first()).toHaveValue('3');
    await expect(importPage.locator('[data-action="plan-slot"][data-day="Mi"]').first()).toHaveValue('abend');

    await importContext.close();
  });

  test('Modal kann Rezepte direkt in die Woche einplanen', async ({ browser }) => {
    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');

    await createRecipeViaUi(adminSession.page, {
      title: 'Modal Auflauf',
      tags: 'Ofen, Familie',
      ingredients: '500 g Kartoffeln\n200 ml Sahne\n1 EL Butter',
      instructions: 'Schichten und goldbraun backen',
    });

    await adminSession.page.locator('.recipe-card').filter({ hasText: 'Modal Auflauf' }).locator('[data-action="open-recipe"]').click();
    await adminSession.page.locator('#modalServings').selectOption('4');
    await adminSession.page.locator('#modalPlannerToggle').click();
    await adminSession.page.locator('#modalPlannerDay').selectOption('Fr');
    await adminSession.page.locator('#modalPlannerSlot').selectOption('mittag');
    await adminSession.page.locator('#modalPlannerServings').fill('4');
    await adminSession.page.locator('#modalPlannerSaveBtn').click();

    await expect(adminSession.page.locator('#modalPlannerFeedback')).toContainText('Fr · Mittag · 4 P.');

    await adminSession.page.locator('#modalCloseBtn').click();
    await openPlanner(adminSession.page);
    await expect(adminSession.page.locator('[data-action="plan-serving"][data-day="Fr"]').first()).toHaveValue('4');
    await expect(adminSession.page.locator('[data-action="plan-slot"][data-day="Fr"]').first()).toHaveValue('mittag');

    await adminSession.context.close();
  });

  test('Planner-Einträge lassen sich über den Verschieben-Pfad neu einsortieren', async ({ browser }) => {
    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');

    await createRecipeViaUi(adminSession.page, {
      title: 'Verschiebe Curry',
      tags: 'Curry, Schnell',
      ingredients: '1 Zwiebel\n400 g Kichererbsen\n200 ml Kokosmilch',
      instructions: 'Anbraten, köcheln, servieren',
    });

    await openPlanner(adminSession.page);
    await addPlannedRecipe(adminSession.page, 'Di', 'Verschiebe Curry');
    const planEntry = adminSession.page.locator('.day-recipe-chip').first();
    const initialPlanEntryId = await planEntry.getAttribute('data-plan-entry-id');
    await planEntry.locator('[data-action="move-plan-entry"]').click();
    await adminSession.page.locator(`[data-action="move-entry-day"][data-plan-entry-id="${initialPlanEntryId}"]`).selectOption('Fr');
    await adminSession.page.locator(`[data-action="move-entry-slot"][data-plan-entry-id="${initialPlanEntryId}"]`).selectOption('abend');
    await adminSession.page.locator(`[data-action="confirm-move-entry"][data-plan-entry-id="${initialPlanEntryId}"]`).click();

    await expect(adminSession.page.locator('[data-action="plan-serving"][data-day="Di"]')).toHaveCount(0);
    await expect(adminSession.page.locator(`.day-recipe-chip[data-plan-entry-id="${initialPlanEntryId}"]`)).toHaveCount(1);
    await expect(adminSession.page.locator('[data-action="plan-serving"][data-day="Fr"]').first()).toHaveValue('2');
    await expect(adminSession.page.locator('[data-action="plan-slot"][data-day="Fr"]').first()).toHaveValue('abend');

    await adminSession.context.close();
  });

  test('Planner-Einträge lassen sich per Drag-and-drop verschieben und bleiben stabil', async ({ browser }) => {
    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');
    await adminSession.page.setViewportSize({ width: 1440, height: 1200 });

    await createRecipeViaUi(adminSession.page, {
      title: 'Drag Pasta',
      tags: 'Pasta, Alltag',
      ingredients: '200 g Pasta\n1 Zwiebel\n2 EL Öl',
      instructions: 'Kochen, schwenken, servieren',
    });

    await openPlanner(adminSession.page);
    await addPlannedRecipe(adminSession.page, 'Di', 'Drag Pasta');
    await adminSession.page.locator('[data-action="plan-slot"][data-day="Di"]').first().selectOption('abend');

    const sourceChip = adminSession.page.locator('[data-day-column="Di"] .day-recipe-chip').first();
    const planEntryId = await sourceChip.getAttribute('data-plan-entry-id');
    expect(planEntryId).toBeTruthy();

    await dragPlannedRecipeToSlot(adminSession.page, {
      sourcePlanEntryId: planEntryId,
      sourceDay: 'Di',
      targetDay: 'Mi',
      targetSlot: 'abend',
      targetPosition: 0,
    });

    await expect(adminSession.page.locator('[data-day-column="Di"] .day-recipe-chip')).toHaveCount(0);
    await expect(adminSession.page.locator(`.day-recipe-chip[data-plan-entry-id="${planEntryId}"]`)).toHaveCount(1);
    await expect(adminSession.page.locator(`.day-recipe-chip[data-plan-entry-id="${planEntryId}"]`)).toHaveAttribute('data-day', 'Mi');
    await expect(adminSession.page.locator('[data-action="plan-slot"][data-day="Mi"]').first()).toHaveValue('abend');

    await adminSession.page.reload();
    await adminSession.page.waitForLoadState('networkidle');
    await expect(adminSession.page.locator('#authBarName')).toHaveText('admin@kochbuch.local');
    await openPlanner(adminSession.page);
    await expect(adminSession.page.locator(`.day-recipe-chip[data-plan-entry-id="${planEntryId}"]`)).toHaveCount(1);
    await expect(adminSession.page.locator(`.day-recipe-chip[data-plan-entry-id="${planEntryId}"]`)).toHaveAttribute('data-day', 'Mi');

    await adminSession.context.close();
  });

});
