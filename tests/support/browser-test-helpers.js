const { expect } = require('@playwright/test');

const APP_PATH = '/index.html?backend=browser-test';
const RESET_ENDPOINT = '/api/browser-test/reset';
const TEST_IMAGE_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7X8J0AAAAASUVORK5CYII=',
  'base64',
);

async function resetBrowserTestBackend(request, seed) {
  const response = await request.post(
    RESET_ENDPOINT,
    seed ? { data: { seed } } : undefined,
  );
  expect(response.ok(), 'browser-test backend reset failed').toBeTruthy();
}

async function loginViaUi(page, email, { expectSignedIn = true } = {}) {
  await page.goto(APP_PATH);
  await page.locator('#browserTestEmail').fill(email);
  await page.getByRole('button', { name: 'Test-Login' }).click();
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

async function createRecipeViaUi(page, recipe, { imageBuffer = null, imageName = 'recipe.png' } = {}) {
  const matchingCards = page.locator('.recipe-card').filter({ hasText: recipe.title });
  const previousCount = await matchingCards.count();
  await page.getByRole('button', { name: /\+ Neues Rezept/ }).click();
  await page.getByLabel('Rezeptname *').fill(recipe.title);
  await page.getByLabel('Tags (kommagetrennt)').fill(recipe.tags || '');
  await page.getByLabel('Zutaten *').fill(recipe.ingredients);
  await page.getByLabel('Zubereitung *').fill(recipe.instructions);

  if (recipe.description) {
    await page.getByLabel('Beschreibung (optional)').fill(recipe.description);
  }

  if (recipe.servings !== undefined && recipe.servings !== null) {
    const servingsControl = page.locator('#servings');
    const tagName = await servingsControl.evaluate((element) => element.tagName.toLowerCase());
    const desiredValue = String(recipe.servings);

    if (tagName === 'select') {
      const matchingOptionCount = await servingsControl.locator(`option[value="${desiredValue}"]`).count();
      if (matchingOptionCount > 0) {
        await servingsControl.selectOption(desiredValue);
      } else {
        await servingsControl.evaluate((element, value) => {
          const option = document.createElement('option');
          option.value = String(value);
          option.textContent = String(value);
          element.appendChild(option);
          element.value = String(value);
          element.dispatchEvent(new Event('change', { bubbles: true }));
        }, desiredValue);
      }
    } else {
      await servingsControl.fill(desiredValue);
    }
  }

  if (imageBuffer) {
    await page.locator('#imageFile').setInputFiles({
      name: imageName,
      mimeType: 'image/png',
      buffer: imageBuffer,
    });
  }

  await page.getByRole('button', { name: 'Rezept speichern' }).click();
  await expect(matchingCards).toHaveCount(previousCount + 1);
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
    .first()
    .click();
}

async function dragPlannedRecipeToSlot(page, {
  sourcePlanEntryId,
  sourceDay,
  targetDay,
  targetSlot = 'abend',
  targetPosition = 0,
}) {
  const dragHandle = sourcePlanEntryId
    ? page.locator(`.day-recipe-chip[data-plan-entry-id="${sourcePlanEntryId}"] [data-action="start-plan-drag"]`).first()
    : page.locator(`[data-day-column="${sourceDay}"] [data-action="start-plan-drag"]`).first();
  await expect(dragHandle).toBeVisible();

  const handleBox = await dragHandle.boundingBox();
  expect(handleBox, 'expected planner drag handle bounding box').toBeTruthy();

  const targetSlotSection = page.locator(
    `[data-day-column="${targetDay}"] [data-slot-section="${targetSlot}"]`,
  ).first();
  await targetSlotSection.scrollIntoViewIfNeeded();

  await page.mouse.move(handleBox.x + (handleBox.width / 2), handleBox.y + (handleBox.height / 2));
  await page.mouse.down();
  const dropZone = page.locator(
    `[data-drop-day="${targetDay}"][data-drop-slot="${targetSlot}"][data-drop-position="${targetPosition}"]`,
  ).first();
  await expect(page.locator('#weekPlanner')).toHaveClass(/planner-drag-active/);
  await expect(dropZone).toBeVisible();
  await expect(dropZone).toHaveClass(/visible/);

  const dropBox = await dropZone.boundingBox();
  expect(dropBox, 'expected planner drop zone bounding box').toBeTruthy();

  await page.mouse.move(dropBox.x + (dropBox.width / 2), dropBox.y + (dropBox.height / 2), { steps: 12 });
  await expect(dropZone).toHaveClass(/is-target/);
  await page.mouse.up();
}

async function exportCookbook(page, testInfo) {
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /^Exportieren$/ }).click();
  const download = await downloadPromise;
  const exportPath = testInfo.outputPath(`kochbuch-export-${Date.now()}.json`);
  await download.saveAs(exportPath);
  return JSON.parse(require('fs').readFileSync(exportPath, 'utf8'));
}

function getImportSelectors(mode = 'restore') {
  if (mode === 'additive') {
    return {
      button: '#recipeImportBtn',
      input: '#recipeImportFile',
    };
  }

  return {
    button: '#restoreImportBtn',
    input: '#restoreImportFile',
  };
}

async function importCookbook(page, payload, { mode = 'restore' } = {}) {
  const selectors = getImportSelectors(mode);
  const dialogPromise = page.waitForEvent('dialog');
  await page.locator(selectors.button).click();
  await page.locator(selectors.input).setInputFiles({
    name: 'kochbuch-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf8'),
  });
  const dialog = await dialogPromise;
  expect(dialog.message()).toMatch(/(importiert|wiederhergestellt|ergänzt)/i);
  await dialog.accept();
}

async function importCookbookViaButton(page, buttonName, payload, { mode = null } = {}) {
  const selectors = getImportSelectors(mode || (/ergänzen|ergaenzen/i.test(String(buttonName)) ? 'additive' : 'restore'));
  const actionButton = page.getByRole('button', { name: buttonName });
  if (await actionButton.count()) {
    await actionButton.click();
  } else {
    await page.locator(selectors.button).click();
  }

  const dialogPromise = page.waitForEvent('dialog');
  await page.locator(selectors.input).setInputFiles({
    name: 'kochbuch-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload), 'utf8'),
  });
  const dialog = await dialogPromise;
  expect(dialog.message()).toMatch(/(importiert|wiederhergestellt|ergänzt)/i);
  await dialog.accept();
}

module.exports = {
  APP_PATH,
  TEST_IMAGE_BUFFER,
  addPlannedRecipe,
  createRecipeViaUi,
  exportCookbook,
  importCookbook,
  loginViaUi,
  openLoggedInPage,
  openPlanner,
  resetBrowserTestBackend,
  importCookbookViaButton,
  dragPlannedRecipeToSlot,
};
