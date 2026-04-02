const fs = require('fs');
const { test, expect } = require('@playwright/test');

const APP_PATH = '/index.html?backend=browser-test';
const RESET_ENDPOINT = '/api/browser-test/reset';

async function resetBrowserTestBackend(request, seed) {
  const response = await request.post(
    RESET_ENDPOINT,
    seed ? { data: { seed } } : undefined,
  );
  expect(response.ok(), 'browser-test backend reset failed').toBeTruthy();
}

async function loginViaUi(page, email, { expectSignedIn = true } = {}) {
  await page.goto(APP_PATH);
  await page.locator('#loginEmail').fill(email);
  await page.getByRole('button', { name: 'Magic Link senden' }).click();
  await expect(page.locator('#authBarName')).toHaveText(email);
  if (expectSignedIn) {
    await expect(page.locator('#appShell')).not.toHaveClass(/app-shell-hidden/);
    await expect(page.locator('#collectionSummary')).toBeVisible();
  } else {
    await expect(page.locator('#accessPanel')).toBeVisible();
  }
}

async function openLoggedInPage(browser, email) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await loginViaUi(page, email);
  return { context, page };
}

async function createRecipeViaUi(page, recipe) {
  await page.getByRole('button', { name: /\+ Neues Rezept/ }).click();
  await page.getByLabel('Rezeptname *').fill(recipe.title);
  await page.getByLabel('Tags (kommagetrennt)').fill(recipe.tags || '');
  await page.getByLabel('Zutaten *').fill(recipe.ingredients);
  await page.getByLabel('Zubereitung *').fill(recipe.instructions);

  if (recipe.description) {
    await page.getByLabel('Beschreibung (optional)').fill(recipe.description);
  }

  await page.getByRole('button', { name: 'Rezept speichern' }).click();
  await expect(page.locator('.recipe-card').filter({ hasText: recipe.title })).toHaveCount(1);
}

async function openPlanner(page) {
  await page.getByRole('button', { name: 'Wochenplaner & Einkaufsliste' }).click();
  await expect(page.locator('#weekPlanner')).toBeVisible();
}

async function addPlannedRecipe(page, day, recipeTitle) {
  await page.locator(`[data-action="toggle-day-picker"][data-day="${day}"]`).click();
  await expect(page.locator(`[data-day-picker-slot="${day}"]`)).toBeVisible();
  await page.locator(`[data-day-picker-slot="${day}"]`).selectOption('fruehstueck');
  await page.locator(`[data-action="add-to-day"][data-day="${day}"]`)
    .filter({ hasText: recipeTitle })
    .click();
}

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

async function exportCookbook(page, testInfo) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Exportieren$/ }).click();
  const download = await downloadPromise;
  const exportPath = testInfo.outputPath(`kochbuch-export-${Date.now()}.json`);
  await download.saveAs(exportPath);
  return JSON.parse(fs.readFileSync(exportPath, 'utf8'));
}

async function importCookbook(page, payload) {
  const dialogPromise = page.waitForEvent('dialog');
  await page.locator('#importBtn').click();
  await page.locator('#importFile').setInputFiles({
    name: 'kochbuch-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf8'),
  });
  const dialog = await dialogPromise;
  expect(dialog.message()).toMatch(/importiert/i);
  await dialog.accept();
}

test.describe('Privates Familien-Kochbuch', () => {
  test.beforeEach(async ({ request }) => {
    await resetBrowserTestBackend(request);
  });

  test('trennt Admin-, Reader- und Unknown-Login sauber', async ({ browser }) => {
    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');
    await expect(adminSession.page.locator('#toggleFormBtn')).toBeVisible();
    await expect(adminSession.page.locator('#importBtn')).toBeVisible();
    await expect(adminSession.page.locator('#exportBtn')).toBeVisible();
    await adminSession.context.close();

    const readerSession = await openLoggedInPage(browser, 'reader@kochbuch.local');
    await expect(readerSession.page.locator('#toggleFormBtn')).toBeHidden();
    await expect(readerSession.page.locator('#importBtn')).toBeHidden();
    await expect(readerSession.page.locator('#exportBtn')).toBeHidden();
    await readerSession.context.close();

    const unknownContext = await browser.newContext();
    const unknownPage = await unknownContext.newPage();
    await loginViaUi(unknownPage, 'unknown@kochbuch.local', { expectSignedIn: false });
    await expect(unknownPage.getByText(/Kein Zugriff/i)).toBeVisible();
    await expect(unknownPage.locator('#appShell')).toHaveClass(/app-shell-hidden/);
    await unknownContext.close();
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

  test('Legacy localStorage wird migriert und als schemaVersion 3 exportiert', async ({ browser, request }, testInfo) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedLegacyLocalStorage(page);
    await loginViaUi(page, 'admin@kochbuch.local');

    const migrateButton = page.getByRole('button', { name: /Lokale Daten migrieren/i });
    await expect(migrateButton).toBeVisible();
    const migrationDialogPromise = page.waitForEvent('dialog');
    await migrateButton.click();
    const migrationDialog = await migrationDialogPromise;
    expect(migrationDialog.message()).toMatch(/importiert/i);
    await migrationDialog.accept();

    await expect(page.locator('.recipe-card').filter({ hasText: 'Legacy Suppe' })).toHaveCount(1);
    await expect(page.locator('.recipe-card').filter({ hasText: 'Legacy Suppe' }).locator('img')).toBeVisible();
    await expect(page.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'true');

    await openPlanner(page);
    await expect(page.locator('[data-action="plan-serving"][data-day="Mo"]').first()).toHaveValue('4');
    await expect(page.locator('[data-action="plan-slot"][data-day="Mo"]').first()).toHaveValue('abend');

    const exportContent = await exportCookbook(page, testInfo);
    expect(exportContent.schemaVersion).toBe(3);
    expect(Array.isArray(exportContent.recipes)).toBe(true);
    expect(exportContent.recipes.some((recipe) => recipe.title === 'Legacy Suppe')).toBe(true);
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
    ]);

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

  test('Admin kann schemaVersion 3 export wieder importieren', async ({ browser, request }, testInfo) => {
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
    expect(exportContent.schemaVersion).toBe(3);
    await createContext.close();

    await resetBrowserTestBackend(request);

    const importContext = await browser.newContext();
    const importPage = await importContext.newPage();
    await loginViaUi(importPage, 'admin@kochbuch.local');
    await importCookbook(importPage, exportContent);

    await expect(importPage.locator('.recipe-card').filter({ hasText: 'Import Pasta' })).toHaveCount(1);
    await expect(importPage.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'true');

    await openPlanner(importPage);
    await expect(importPage.locator('[data-action="plan-serving"][data-day="Mi"]').first()).toHaveValue('3');
    await expect(importPage.locator('[data-action="plan-slot"][data-day="Mi"]').first()).toHaveValue('abend');

    await importContext.close();
  });
});
