export function createAppEventHandlers(deps) {
  const {
    authService,
    repository,
    state,
    formController,
    googleLoginBtn,
    browserTestEmail,
    formContainer,
    imageFileInput,
    shoppingList,
    restoreImportFile,
    recipeImportFile,
    modalFavoriteBtn,
    modalPlannerDay,
    deleteConfirm,
    recipeModal,
    renderAuthShell,
    waitForAppReady,
    refreshAppData,
    closeRecipeForm,
    openRecipeForm,
    handleRecipeSubmit,
    setPlannerOpen,
    renderPlanner,
    updatePlannerShoppingList,
    createEmptyWeekPlan,
    resetPlannerDraftState,
    renderRecipes,
    downloadJson,
    handleImport,
    notifications,
    toggleFavoritesFilter,
    clearTagFilter,
    closeRecipeModal,
    toggleFavoriteWithEffect,
    setPendingFocusTarget,
    announceUi,
    renderRecipeModal,
    editRecipeModal,
    syncModalPlanningUi,
    restorePendingFocusTarget,
    saveModalPlannerEntry,
    normalizePositiveInteger,
    isValidMealSlot,
    confirmDelete,
    cancelDelete,
    filterDayPicker,
    updatePlanEntryServings,
    updatePlanEntrySlot,
    setTagFilter,
    openRecipeModal,
    askDelete,
    addToDay,
    removeFromDay,
    toggleMoveEntryComposer,
    confirmMoveEntry,
    modalController,
    deleteDialogController,
    handleDayPickerKeyboard,
    startPlanDrag,
    cancelPendingDrag,
    updateDragTarget,
    finishPlanDrag,
    getDropTargetFromElement,
    isDataUrl,
    isExternalImageUrl,
  } = deps;

  return {
    async onGoogleLogin() {
      try {
        googleLoginBtn.disabled = true;
        await authService.signInWithGoogle();
        renderAuthShell(authService.getSnapshot());
      } catch (error) {
        googleLoginBtn.disabled = false;
        deps.loginMessage.textContent = error.message || 'Google-Login fehlgeschlagen.';
      }
    },

    async onBrowserTestLoginSubmit(event) {
      event.preventDefault();
      try {
        await authService.signInForBrowserTest(browserTestEmail.value);
        const snapshot = authService.getSnapshot();
        renderAuthShell(snapshot);
        if (snapshot.accessState === 'signed_in') {
          await waitForAppReady();
          await refreshAppData({ silent: true });
        }
      } catch (error) {
        deps.loginMessage.textContent = error.message || 'Test-Login fehlgeschlagen.';
      }
    },

    async onSignOut() {
      await authService.signOut();
      renderAuthShell(authService.getSnapshot());
      browserTestEmail.value = '';
      googleLoginBtn.disabled = false;
      state.recipes = [];
      state.weekPlan = createEmptyWeekPlan();
      state.activeDayPicker = null;
      state.activeDayPickerQuery = '';
      state.favoriteFilterActive = false;
      state.activeTagFilter = null;
      state.pendingFocusTarget = null;
      state.modalPlanningFeedback = '';
      resetPlannerDraftState();
      setPlannerOpen(false);
      renderRecipes();
    },

    onToggleRecipeForm() {
      if (formContainer.classList.contains('visible')) {
        closeRecipeForm();
      } else {
        openRecipeForm();
      }
    },

    onUploadImageClick() {
      imageFileInput.click();
    },

    async onImageFileChange(event) {
      const file = event.target.files[0];
      if (!file) return;
      await formController.handleImageFileChange(file);
    },

    onImageUrlInput() {
      formController.handleImageUrlInput({ isDataUrl, isExternalImageUrl });
    },

    onRecipeSubmit: handleRecipeSubmit,

    onTogglePlanner() {
      setPlannerOpen(!state.plannerOpen);
      if (state.plannerOpen) {
        renderPlanner();
        updatePlannerShoppingList();
      } else {
        state.activeDayPicker = null;
        state.activeDayPickerQuery = '';
        resetPlannerDraftState();
      }
    },

    async onClearPlan() {
      if (!deps.DAYS.some((day) => (state.weekPlan[day] || []).length > 0)) return;
      state.weekPlan = createEmptyWeekPlan();
      resetPlannerDraftState();
      await deps.persistWeekPlan();
    },

    onShoppingSearch(event) {
      const query = event.target.value.toLowerCase();
      if (!query) {
        shoppingList.textContent = state.fullShoppingList;
        return;
      }
      const filtered = state.fullShoppingList.split('\n').filter((line) => line.toLowerCase().includes(query)).join('\n');
      shoppingList.textContent = filtered || '(Keine Treffer)';
    },

    onExportShopping() {
      const text = shoppingList.textContent;
      if (!text.trim()) return;
      const blob = new Blob([text], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `einkaufsliste_${new Date().toISOString().split('T')[0]}.txt`;
      anchor.click();
      URL.revokeObjectURL(url);
    },

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

    onSearchInput() {
      renderRecipes();
    },

    onSortChange() {
      renderRecipes();
    },

    onToggleFavoritesFilter() {
      toggleFavoritesFilter();
    },

    onClearTagFilter() {
      clearTagFilter();
    },

    onCloseModal() {
      closeRecipeModal();
    },

    async onToggleModalFavorite() {
      if (!state.currentModalRecipe) return;
      await toggleFavoriteWithEffect({
        recipeId: state.currentModalRecipe.id,
        anchor: modalFavoriteBtn,
        surface: 'modal',
      });
    },

    async onModalCooked() {
      if (!state.currentModalRecipe) return;
      setPendingFocusTarget({ selector: '#modalCookedBtn' });
      await repository.markRecipeCooked(state.currentModalRecipe.id);
      announceUi('Heute gekocht markiert');
      await refreshAppData({ silent: true });
      renderRecipeModal();
    },

    onEditModal() {
      editRecipeModal();
    },

    onModalServingsChange() {
      deps.updateModalServings();
    },

    onToggleModalPlanner() {
      state.modalPlanningOpen = !state.modalPlanningOpen;
      if (state.modalPlanningOpen) {
        state.modalPlanningFeedback = '';
      }
      syncModalPlanningUi();
      if (state.modalPlanningOpen) {
        modalPlannerDay?.focus();
      } else {
        setPendingFocusTarget({ type: 'modal-planner-toggle' });
        restorePendingFocusTarget();
      }
    },

    async onSaveModalPlanner() {
      await saveModalPlannerEntry();
    },

    onCancelModalPlanner() {
      state.modalPlanningOpen = false;
      syncModalPlanningUi();
      setPendingFocusTarget({ type: 'modal-planner-toggle' });
      restorePendingFocusTarget();
    },

    onModalPlannerDayChange(event) {
      state.modalPlanningDay = event.target.value;
    },

    onModalPlannerSlotChange(event) {
      state.modalPlanningSlot = isValidMealSlot(event.target.value) ? event.target.value : 'abend';
    },

    onModalPlannerServingsChange(event) {
      event.target.value = String(normalizePositiveInteger(event.target.value, state.currentModalServings || 2));
    },

    onConfirmDelete: confirmDelete,

    onCancelDelete() {
      cancelDelete();
    },

    onDeleteOverlayClick(event) {
      if (event.target === deleteConfirm) {
        cancelDelete();
      }
    },

    onRequiredFieldInput(input) {
      formController.updateRequiredFieldValidity(input);
    },

    onRequiredFieldBlur(input) {
      formController.updateRequiredFieldValidity(input);
    },

    onDocumentInput(event) {
      if (event.target.matches('[data-day-picker-search]')) {
        filterDayPicker(event.target.dataset.dayPickerSearch, event.target.value);
      }
    },

    async onDocumentChange(event) {
      if (event.target.matches('[data-day-picker-slot]')) {
        state.activeDayPickerSlot = isValidMealSlot(event.target.value) ? event.target.value : 'abend';
        const day = event.target.dataset.dayPickerSlot;
        const query = document.getElementById(`picker-search-${day}`)?.value || '';
        filterDayPicker(day, query);
        return;
      }

      if (event.target.matches('[data-action="plan-serving"]')) {
        await updatePlanEntryServings(
          event.target.dataset.planEntryId,
          event.target.dataset.day,
          Number.parseInt(event.target.dataset.index, 10),
          Number.parseInt(event.target.value, 10),
        );
        return;
      }

      if (event.target.matches('[data-action="plan-slot"]')) {
        await updatePlanEntrySlot(
          event.target.dataset.planEntryId,
          event.target.dataset.day,
          Number.parseInt(event.target.dataset.index, 10),
          event.target.value,
        );
        return;
      }

      if (event.target.matches('[data-action="move-entry-day"]')) {
        state.moveEntryDraftDay = event.target.value;
        return;
      }

      if (event.target.matches('[data-action="move-entry-slot"]')) {
        state.moveEntryDraftSlot = isValidMealSlot(event.target.value) ? event.target.value : 'abend';
      }
    },

    async onDocumentClick(event) {
      const actionTarget = event.target.closest('[data-action]');

      if (actionTarget) {
        const { action } = actionTarget.dataset;

        if (action === 'filter-tag') {
          setTagFilter(decodeURIComponent(actionTarget.dataset.tag));
          return;
        }

        if (action === 'open-recipe') {
          openRecipeModal(actionTarget.dataset.recipeId, {
            servings: Number.parseInt(actionTarget.dataset.modalServings, 10),
            trigger: actionTarget,
          });
          return;
        }

        if (action === 'toggle-favorite') {
          await toggleFavoriteWithEffect({
            recipeId: actionTarget.dataset.recipeId,
            anchor: actionTarget,
            surface: actionTarget.dataset.favoriteSurface || 'grid',
          });
          return;
        }

        if (action === 'mark-cooked') {
          if (actionTarget.dataset.planEntryId) {
            setPendingFocusTarget({ type: 'plan-entry', planEntryId: actionTarget.dataset.planEntryId, action: 'mark-cooked' });
          }
          await repository.markRecipeCooked(actionTarget.dataset.recipeId);
          announceUi('Heute gekocht markiert');
          await refreshAppData({ silent: true });
          return;
        }

        if (action === 'delete-recipe') {
          askDelete(actionTarget.dataset.recipeId, actionTarget);
          return;
        }

        if (action === 'toggle-day-picker') {
          deps.toggleDayPicker(actionTarget.dataset.day);
          return;
        }

        if (action === 'add-to-day') {
          setPendingFocusTarget({ type: 'day-picker-trigger', day: actionTarget.dataset.day });
          await addToDay(actionTarget.dataset.day, actionTarget.dataset.recipeId);
          return;
        }

        if (action === 'remove-plan-entry') {
          setPendingFocusTarget({ type: 'day-picker-trigger', day: actionTarget.dataset.day });
          await removeFromDay(
            actionTarget.dataset.planEntryId,
            actionTarget.dataset.day,
            Number.parseInt(actionTarget.dataset.index, 10),
          );
          return;
        }

        if (action === 'move-plan-entry') {
          toggleMoveEntryComposer(actionTarget.dataset.planEntryId);
          return;
        }

        if (action === 'confirm-move-entry') {
          await confirmMoveEntry(actionTarget.dataset.planEntryId);
          return;
        }

        if (action === 'cancel-move-entry') {
          state.activeMoveEntryId = null;
          renderPlanner();
          return;
        }

        if (action === 'open-form') {
          openRecipeForm();
          return;
        }

        if (action === 'open-import') {
          if (state.latestAppData.capabilities?.canAdmin) {
            recipeImportFile.click();
          }
          return;
        }
      }

      if (state.activeDayPicker && !event.target.closest('.day-add-wrapper')) {
        setPendingFocusTarget({ type: 'day-picker-trigger', day: state.activeDayPicker });
        state.activeDayPicker = null;
        state.activeDayPickerQuery = '';
        renderPlanner();
      }
    },

    onDocumentKeydown(event) {
      if (deleteDialogController.handleKeydown(event)) return;
      if (modalController.handleKeydown(event)) return;
      if (handleDayPickerKeyboard(event)) return;

      if (event.key !== 'Escape') return;

      if (state.activeMoveEntryId) {
        state.activeMoveEntryId = null;
        renderPlanner();
        return;
      }

      if (deleteDialogController.isOpen()) {
        cancelDelete();
        return;
      }

      if (modalController.isOpen()) {
        closeRecipeModal();
        return;
      }

      if (state.activeDayPicker) {
        setPendingFocusTarget({ type: 'day-picker-trigger', day: state.activeDayPicker });
        state.activeDayPicker = null;
        state.activeDayPickerQuery = '';
        renderPlanner();
      }
    },

    onDocumentPointerDown(event) {
      const dragHandle = event.target.closest('[data-action="start-plan-drag"]');
      if (!dragHandle) return;
      event.preventDefault();
      const startPayload = {
        planEntryId: dragHandle.dataset.planEntryId,
        day: dragHandle.dataset.day,
        index: Number.parseInt(dragHandle.dataset.index, 10),
        pointerId: event.pointerId,
        pointerType: event.pointerType || 'mouse',
        clientX: event.clientX,
        clientY: event.clientY,
      };

      if ((event.pointerType || 'mouse') === 'touch') {
        state.dragState = {
          ...startPayload,
          active: false,
          originX: event.clientX,
          originY: event.clientY,
          holdTimer: window.setTimeout(() => {
            startPlanDrag(startPayload);
          }, 280),
        };
        return;
      }

      startPlanDrag(startPayload);
    },

    onDocumentPointerMove(event) {
      if (!state.dragState) return;

      if (!state.dragState.active) {
        const deltaX = Math.abs(event.clientX - state.dragState.originX);
        const deltaY = Math.abs(event.clientY - state.dragState.originY);
        if (deltaX > 8 || deltaY > 8) {
          cancelPendingDrag();
        }
        return;
      }

      updateDragTarget(event.clientX, event.clientY);
    },

    async onDocumentPointerUp(event) {
      if (!state.dragState) return;
      await finishPlanDrag(event.clientX, event.clientY);
    },

    onDocumentPointerCancel() {
      cancelPendingDrag();
    },

    onDocumentPointerOver(event) {
      if (!state.dragState?.active) return;
      const over = getDropTargetFromElement(event.target);
      if (!over) return;
      state.dragState.over = over;
      deps.highlightDropTarget(state.dragState.planEntryId, over);
    },

    onDocumentMouseMove(event) {
      if (!state.dragState?.active) return;
      updateDragTarget(event.clientX, event.clientY);
    },

    onDocumentMouseOver(event) {
      if (!state.dragState?.active) return;
      const over = getDropTargetFromElement(event.target);
      if (!over) return;
      state.dragState.over = over;
      deps.highlightDropTarget(state.dragState.planEntryId, over);
    },

    async onDocumentMouseUp(event) {
      if (!state.dragState) return;
      await finishPlanDrag(event.clientX, event.clientY);
    },

    onModalOverlayClick(event) {
      if (event.target === recipeModal) {
        closeRecipeModal();
      }
    },

    async onWindowFocus() {
      if (authService.getSnapshot().accessState === 'signed_in') {
        await refreshAppData({ silent: true });
      }
    },

    async onAuthStateChange(snapshot) {
      renderAuthShell(snapshot);
      if (snapshot.accessState === 'signed_in') {
        await refreshAppData({ silent: true });
      }
    },
  };
}
