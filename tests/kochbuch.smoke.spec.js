const fs = require('fs');
const { test, expect } = require('@playwright/test');

test.describe('Kochbuch Smoke Test', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kochbuch.html');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('deckt Kernfluesse der Seite ab', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Dein Kochbuch beginnt hier' })).toBeVisible();
    await page.getByRole('button', { name: 'Erstes Rezept anlegen' }).click();

    await page.getByLabel('Rezeptname *').fill('Nur Titel');
    await page.getByRole('button', { name: 'Rezept speichern' }).click();
    await expect(page.locator('.recipe-card')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Dein Kochbuch beginnt hier' })).toBeVisible();

    await page.getByLabel('Rezeptname *').fill('Omas Pasta');
    await page.getByLabel('Tags (kommagetrennt)').fill("Oma's, Pasta");
    await page.getByLabel('Zutaten *').fill('200 g Pasta');
    await page.getByLabel('Zubereitung *').fill('Kochen und servieren');
    await page.getByLabel('Profitipps').fill('Mit etwas Pastawasser cremig ziehen.');
    await page.getByRole('button', { name: 'Rezept speichern' }).click();

    const rezeptKarte = page.locator('.recipe-card').first();
    await expect(rezeptKarte).toBeVisible();

    const apostrophTag = rezeptKarte.getByRole('button', { name: "Oma's" });
    await apostrophTag.click();
    await expect(page.locator('#tagFilterPill')).toHaveClass(/visible/);

    await page.locator('#clearTagFilterBtn').click();
    await rezeptKarte.locator('[data-action="open-recipe"]').click();

    await page.setViewportSize({ width: 900, height: 900 });
    await expect(page.getByRole('heading', { name: 'Profitipps' })).toBeVisible();

    await page.locator('#modalServings').selectOption('4');
    await page.keyboard.press('Escape');
    await expect(page.locator('#recipeModal')).not.toHaveClass(/visible/);

    await page.getByRole('button', { name: 'Wochenplaner & Einkaufsliste' }).click();
    await page.locator('[data-action="toggle-day-picker"][data-day="Mo"]').click();
    await page.locator('[data-day-picker-slot="Mo"]').selectOption('fruehstueck');
    await page.locator('[data-action="add-to-day"][data-day="Mo"]').first().click();

    const planSelect = page.locator('[data-action="plan-serving"][data-day="Mo"]').first();
    await expect(planSelect).toHaveValue('2');
    await expect(page.locator('[data-action="plan-slot"][data-day="Mo"]').first()).toHaveValue('fruehstueck');
    await planSelect.selectOption('4');
    await expect(page.locator('#shoppingList')).toContainText('400 g Pasta');
    await page.locator('[data-action="mark-cooked"]').first().click();
    await expect(rezeptKarte.getByText('Heute gekocht')).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'Wochenplaner & Einkaufsliste' }).click();
    await expect(page.locator('[data-action="plan-serving"][data-day="Mo"]').first()).toHaveValue('4');
    await expect(page.locator('[data-action="plan-slot"][data-day="Mo"]').first()).toHaveValue('fruehstueck');

    const favoritenButton = page.locator('[data-action="toggle-favorite"]').first();
    await favoritenButton.click();
    await page.getByRole('button', { name: 'Nur Favoriten' }).click();
    await expect(page.locator('.recipe-card')).toHaveCount(1);

    await page.locator('[data-action="toggle-day-picker"][data-day="Di"]').click();
    await expect(page.locator('[data-action="add-to-day"][data-day="Di"]').first().locator('.day-picker-item-meta')).toContainText('Heute gekocht');
  });

  test('import und export bleiben robust bei Migration und ID-Kollisionen', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('cookbook_recipes', JSON.stringify([
        {
          id: 101,
          title: 'Bereits da',
          ingredients: '200 g Reis',
          instructions: 'Kochen',
          tags: ['Basis'],
          createdAt: '01.04.2026',
        },
      ]));
      localStorage.setItem('cookbook_weekplan', JSON.stringify({
        Mo: [],
        Di: [],
        Mi: [],
        Do: [],
        Fr: [],
        Sa: [],
        So: [],
      }));
    });
    await page.reload();

    const existingId = await page.evaluate(() => JSON.parse(localStorage.getItem('cookbook_recipes'))[0].id);
    const importPayload = {
      app: 'mein-kochbuch',
      schemaVersion: 2,
      exportedAt: '2026-04-02T12:00:00.000Z',
      recipes: [
        {
          id: existingId,
          title: 'Import Suppe',
          ingredients: ['300 ml Brühe', '1 Karotte'],
          steps: 'Alles kochen lassen',
          tags: 'Suppe, Schnell',
          lastCookedAt: '2026-04-01T10:00:00.000Z',
          notes: 'Mit Zitronensaft abschmecken',
        },
        {
          id: 9999,
          title: 'Bereits da',
          ingredients: '1 Tasse Reis',
          instructions: 'Kochen',
        },
      ],
      weekPlan: {
        Mi: [{ recipeId: existingId, servings: 4, slot: 'mittag' }],
        Do: [{ recipeId: 9999, servings: 2, slot: 'abend' }],
      },
    };

    const dialogPromise = page.waitForEvent('dialog');
    await page.locator('#importFile').setInputFiles({
      name: 'kochbuch-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importPayload), 'utf8'),
    });
    const dialog = await dialogPromise;
    expect(dialog.message()).toContain('1 Rezept importiert');
    expect(dialog.message()).toContain('1 Duplikat');
    expect(dialog.message()).toContain('Wochenplan: 2 Eintrage übernommen');
    await dialog.accept();

    await expect(page.locator('.recipe-card')).toHaveCount(2);
    await expect(page.locator('.recipe-card').filter({ hasText: 'Import Suppe' })).toHaveCount(1);

    await page.getByRole('button', { name: 'Wochenplaner & Einkaufsliste' }).click();
    await expect(page.locator('[data-action="plan-slot"][data-day="Mi"]').first()).toHaveValue('mittag');
    await expect(page.locator('[data-action="plan-serving"][data-day="Mi"]').first()).toHaveValue('4');
    await expect(page.locator('[data-day-column="Mi"]')).toContainText('Import Suppe');
    await expect(page.locator('[data-day-column="Do"]')).toContainText('Bereits da');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('#exportBtn').click();
    const download = await downloadPromise;
    const exportContent = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));

    expect(exportContent.schemaVersion).toBe(2);
    expect(exportContent.app).toBe('mein-kochbuch');
    expect(Array.isArray(exportContent.recipes)).toBe(true);
    expect(exportContent.recipes.some(recipe => recipe.title === 'Import Suppe')).toBe(true);
    expect(exportContent.weekPlan.Mi[0].slot).toBe('mittag');
    expect(exportContent.weekPlan.Mi[0].servings).toBe(4);
  });
});
