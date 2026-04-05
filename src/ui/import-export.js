export function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildImportMessage(summary) {
  const modeLabel = summary.importMode === 'additive' ? 'ergänzt' : 'wiederhergestellt';
  let message = `${summary.importedRecipes} Rezept${summary.importedRecipes !== 1 ? 'e' : ''} ${modeLabel}.`;
  if (summary.duplicateRecipes > 0) {
    message += ` ${summary.duplicateRecipes} vorhandene Rezept${summary.duplicateRecipes !== 1 ? 'e' : ''} aktualisiert.`;
  }
  if (summary.invalidRecipes > 0) {
    message += ` ${summary.invalidRecipes} ungueltig${summary.invalidRecipes !== 1 ? 'e' : ''} Eintrag${summary.invalidRecipes !== 1 ? 'e' : ''} ignoriert.`;
  }
  if (summary.importMode === 'restore') {
    if (summary.importedStateEntries > 0) {
      message += ` Persönlicher Zustand: ${summary.importedStateEntries} Eintrag${summary.importedStateEntries !== 1 ? 'e' : ''} übernommen.`;
    }
    if (summary.removedStateEntries > 0) {
      message += ` ${summary.removedStateEntries} alte Zustands-Eintrag${summary.removedStateEntries !== 1 ? 'e' : ''} ersetzt.`;
    }
    if (summary.importedPlannerEntries > 0) {
      message += ` Wochenplan: ${summary.importedPlannerEntries} Eintrag${summary.importedPlannerEntries !== 1 ? 'e' : ''} übernommen.`;
    } else {
      message += ' Wochenplan wurde leer oder bereinigt wiederhergestellt.';
    }
  }
  return message;
}

export function createImportExportController(deps) {
  const { state, repository, formController, notifications, dataController, closeRecipeForm } = deps;

  async function handleImport(mode, input) {
    const file = input.files[0];
    if (!file) return;

    try {
      await dataController.waitForAppReady();
      const payload = JSON.parse(await file.text());
      const summary = mode === 'restore'
        ? await repository.restoreCookbookPayload(payload)
        : await repository.importCookbookRecipesPayload(payload);
      notifications.success(buildImportMessage(summary));
      await dataController.refreshAppData({ silent: true });
    } catch (error) {
      notifications.error(`Fehler beim Importieren: ${error.message}`);
    } finally {
      input.value = '';
    }
  }

  async function handleRecipeSubmit(event) {
    event.preventDefault();
    if (!formController.validateRecipeForm()) return;
    await dataController.waitForAppReady();

    const existing = state.editingRecipeId ? state.recipes.find((recipe) => recipe.id === state.editingRecipeId) : null;
    const rawIngredients = deps.normalizeMultilineText(deps.ingredientsInput.value);
    const imageValue = deps.imageUrlInput.value.trim();
    let image = {
      mode: 'keep',
      previousImagePath: existing?.imagePath || null,
      previousExternalImageUrl: existing?.externalImageUrl || null,
    };

    const pendingImageUpload = formController.getPendingImageUpload();
    if (pendingImageUpload?.dataUrl) {
      image = {
        mode: 'upload',
        uploadDataUrl: pendingImageUpload.dataUrl,
        filename: pendingImageUpload.filename,
        previousImagePath: existing?.imagePath || null,
      };
    } else if (imageValue && deps.isExternalImageUrl(imageValue)) {
      image = {
        mode: 'external',
        externalUrl: imageValue,
        previousImagePath: existing?.imagePath || null,
      };
    } else if (!imageValue && !pendingImageUpload && (existing?.imagePath || existing?.externalImageUrl)) {
      image = {
        mode: 'remove',
        previousImagePath: existing?.imagePath || null,
        previousExternalImageUrl: existing?.externalImageUrl || null,
      };
    }

    const result = await repository.saveRecipe({
      id: existing?.id,
      title: deps.titleInput.value.trim(),
      baseServings: deps.normalizePositiveInteger(deps.servingsInput.value, existing?.baseServings || 2),
      prepTime: Number.parseInt(deps.prepTimeInput.value, 10) || 0,
      cookTime: Number.parseInt(deps.cookTimeInput.value, 10) || 0,
      tags: formController.buildTagsWithCategory(),
      description: deps.descriptionInput.value.trim(),
      rawIngredients,
      parsedIngredients: deps.parseIngredientsText(rawIngredients),
      instructions: deps.normalizeMultilineText(deps.instructionsInput.value),
      plating: deps.normalizeMultilineText(deps.platingInput.value),
      tips: deps.normalizeMultilineText(deps.tipsInput.value),
      image,
    });

    state.editingRecipeId = null;
    closeRecipeForm();
    dataController.applyLoadResult(result);
  }

  return { handleImport, handleRecipeSubmit };
}
