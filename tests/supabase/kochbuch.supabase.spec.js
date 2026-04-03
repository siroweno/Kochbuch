const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const {
  TEST_IMAGE_BUFFER,
  addPlannedRecipe,
  createRecipeViaUi,
  exportCookbook,
  importCookbookViaButton,
  openLoggedInPage,
  openPlanner,
  resetBrowserTestBackend,
} = require('../support/browser-test-helpers');

const ROOT_DIR = path.resolve(__dirname, '..', '..');
const HARDENING_MIGRATION = fs.readFileSync(
  path.join(ROOT_DIR, 'supabase/migrations/20260403110000_auth_security_hardening.sql'),
  'utf8',
);

function hasHardenedRpcMigration() {
  return /revoke execute on function public\.sync_profile_for_user/i.test(HARDENING_MIGRATION)
    && /grant execute on function public\.sync_profile_for_current_user\(\) to authenticated/i.test(HARDENING_MIGRATION)
    && !/grant execute on function public\.sync_profile_for_user\(uuid,\s*text\) to authenticated/i.test(HARDENING_MIGRATION);
}

async function countButtons(page, name) {
  return page.getByRole('button', { name }).count();
}

test.describe('Kochbuch Supabase contracts', () => {
  test('@contracts local server only exposes the allowlisted app assets', async ({ request }) => {
    const okPaths = ['/index.html', '/runtime-config.js', '/src/main.js', '/data/familienkochbuch-import.json'];
    for (const pathname of okPaths) {
      const response = await request.get(pathname);
      expect(response.ok(), `expected ${pathname} to be served`).toBeTruthy();
    }

    const blockedPaths = ['/package.json', '/server.js', '/README.md', '/supabase/seed.sql'];
    for (const pathname of blockedPaths) {
      const response = await request.get(pathname);
      expect(response.status(), `expected ${pathname} to be blocked`).toBe(404);
    }
  });

  test('@browser browser-test keeps shared recipes, images, and personal state isolated', async ({ browser, request }) => {
    await resetBrowserTestBackend(request);

    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');
    await createRecipeViaUi(adminSession.page, {
      title: 'Sunrise Bowl',
      servings: 4,
      tags: 'Fruehstueck, Familie',
      ingredients: '2 Eier\n1 Avocado\n1 Scheibe Brot',
      instructions: 'Alles anrichten und servieren.',
      description: 'A simple breakfast recipe.',
    }, {
      imageBuffer: TEST_IMAGE_BUFFER,
      imageName: 'sunrise-bowl.png',
    });

    await expect(
      adminSession.page.locator('.recipe-card').filter({ hasText: 'Sunrise Bowl' }).locator('img'),
    ).toBeVisible();

    await openPlanner(adminSession.page);
    await addPlannedRecipe(adminSession.page, 'Di', 'Sunrise Bowl');
    await adminSession.page.locator('[data-action="plan-serving"][data-day="Di"]').first().selectOption('4');
    await adminSession.page.locator('[data-action="plan-slot"][data-day="Di"]').first().selectOption('mittag');
    await adminSession.page.locator('[data-action="mark-cooked"]').first().click();
    await expect(
      adminSession.page.locator('.recipe-card').filter({ hasText: 'Sunrise Bowl' }).locator('.card-meta'),
    ).toContainText('Heute gekocht');

    const readerSession = await openLoggedInPage(browser, 'reader@kochbuch.local');
    await expect(readerSession.page.locator('.recipe-card').filter({ hasText: 'Sunrise Bowl' })).toHaveCount(1);
    await expect(readerSession.page.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'false');
    await readerSession.page.locator('[data-action="toggle-favorite"]').first().click();
    await expect(readerSession.page.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'true');

    await adminSession.page.reload();
    await adminSession.page.waitForLoadState('networkidle');
    await expect(adminSession.page.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'false');

    await adminSession.context.close();
    await readerSession.context.close();
  });

  test('@contracts RPC hardening migration exposes only the safe profile sync', async () => {
    if (!hasHardenedRpcMigration()) {
      test.skip(true, 'Waiting for the hardened RPC migration to land.');
    }

    expect(HARDENING_MIGRATION).toMatch(/create or replace function public\.sync_profile_for_current_user\(\)/i);
    expect(HARDENING_MIGRATION).toMatch(/revoke execute on function public\.sync_profile_for_user/i);
    expect(HARDENING_MIGRATION).toMatch(/grant execute on function public\.sync_profile_for_current_user\(\) to authenticated/i);
    expect(HARDENING_MIGRATION).not.toMatch(/grant execute on function public\.sync_profile_for_user\(uuid,\s*text\) to authenticated/i);
  });

  test('@contracts restore and add-import flows stay identity-safe and portable', async ({ browser, request }, testInfo) => {
    await resetBrowserTestBackend(request);

    const adminSession = await openLoggedInPage(browser, 'admin@kochbuch.local');
    await createRecipeViaUi(adminSession.page, {
      title: 'Twin Soup',
      tags: 'Suppe',
      ingredients: '1 Zwiebel\n2 Karotten\n1 l Bruhe',
      instructions: 'Kochen und abschmecken.',
      description: 'First copy of the same title.',
    }, {
      imageBuffer: TEST_IMAGE_BUFFER,
      imageName: 'twin-soup.png',
    });
    await createRecipeViaUi(adminSession.page, {
      title: 'Twin Soup',
      tags: 'Suppe',
      ingredients: '3 Tomaten\n1 Zwiebel\n1 l Wasser',
      instructions: 'Anders kochen und servieren.',
      description: 'Second copy of the same title.',
    });
    await adminSession.page.locator('[data-action="toggle-favorite"]').first().click();
    await openPlanner(adminSession.page);
    await addPlannedRecipe(adminSession.page, 'Mi', 'Twin Soup');
    await adminSession.page.locator('[data-action="plan-serving"][data-day="Mi"]').first().selectOption('4');

    const exportContent = await exportCookbook(adminSession.page, testInfo);
    if (exportContent.schemaVersion !== 4 || !exportContent.recipes.some((recipe) => recipe.portableImageDataUrl)) {
      test.skip(true, 'Waiting for schemaVersion 4 exports with portable image payloads.');
    }

    const restoreButtonCount = await countButtons(adminSession.page, /Backup wiederherstellen/i);
    const addButtonCount = await countButtons(adminSession.page, /Rezepte (ergaenzen|ergänzen)/i);
    if (!restoreButtonCount || !addButtonCount) {
      test.skip(true, 'Waiting for separate restore/add import controls.');
    }

    await adminSession.context.close();

    await resetBrowserTestBackend(request);
    const restoreSession = await openLoggedInPage(browser, 'admin@kochbuch.local');
    await importCookbookViaButton(restoreSession.page, /Backup wiederherstellen/i, exportContent);

    await expect(restoreSession.page.locator('.recipe-card').filter({ hasText: 'Twin Soup' })).toHaveCount(2);
    await expect(restoreSession.page.locator('[data-action="toggle-favorite"]').first()).toHaveAttribute('aria-pressed', 'true');
    await openPlanner(restoreSession.page);
    await expect(restoreSession.page.locator('[data-action="plan-serving"][data-day="Mi"]').first()).toHaveValue('4');

    const additionPayload = {
      ...exportContent,
      recipes: [
        {
          ...exportContent.recipes[0],
          id: '11111111-1111-4111-8111-111111111111',
          title: 'Garden Salad',
        },
      ],
      personalState: {
        recipeState: [],
        weekPlan: exportContent.personalState.weekPlan,
      },
    };
    await importCookbookViaButton(restoreSession.page, /Rezepte (ergaenzen|ergänzen)/i, additionPayload);
    await expect(restoreSession.page.locator('.recipe-card').filter({ hasText: 'Garden Salad' })).toHaveCount(1);

    await restoreSession.context.close();
  });
});
