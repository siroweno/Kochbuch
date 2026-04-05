export function createImportExportHandlers(deps) {
  const {
    repository,
    restoreImportFile,
    recipeImportFile,
    waitForAppReady,
    refreshAppData,
    downloadJson,
    handleImport,
    notifications,
  } = deps;

  return {
    async onExportCookbook() {
      await waitForAppReady();
      const payload = await repository.exportCookbook();
      downloadJson(`kochbuch_${new Date().toISOString().split('T')[0]}.json`, payload);
    },

    onOpenRestoreImport() {
      restoreImportFile.click();
    },

    onOpenRecipeImport() {
      recipeImportFile.click();
    },

    async onRestoreImportChange() {
      await handleImport('restore', restoreImportFile);
    },

    async onRecipeImportChange() {
      await handleImport('additive', recipeImportFile);
    },

    async onMigrateLocal() {
      try {
        await waitForAppReady();
        const summary = await repository.migrateLegacyLocalData();
        notifications.success(summary.migrated ? deps.buildImportMessage(summary) : 'Keine lokalen Daten für die Migration gefunden.');
        await refreshAppData({ silent: true });
      } catch (error) {
        notifications.error(`Migration fehlgeschlagen: ${error.message}`);
      }
    },
  };
}
