export function createDocumentHandlers(deps) {
  const {
    state,
    repository,
    recipeImportFile,
    applyLoadResult,
    refreshAppData,
    renderPlanner,
    closeRecipeModal,
    toggleFavoriteWithEffect,
    setPendingFocusTarget,
    announceUi,
    openRecipeForm,
    openRecipeModal,
    askDelete,
    addToDay,
    removeFromDay,
    toggleMoveEntryComposer,
    confirmMoveEntry,
    setTagFilter,
    filterDayPicker,
    updatePlanEntryServings,
    updatePlanEntrySlot,
    isValidMealSlot,
    normalizePositiveInteger,
    deleteDialogController,
    modalController,
    handleDayPickerKeyboard,
    cancelDelete,
  } = deps;

  return {
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
          const result = await repository.markRecipeCooked(actionTarget.dataset.recipeId);
          announceUi('Heute gekocht markiert');
          if (typeof applyLoadResult === 'function') {
            applyLoadResult(result, { scope: 'recipes' });
          } else {
            await refreshAppData({ silent: true });
          }
          return;
        }

        if (action === 'delete-recipe') {
          askDelete(actionTarget.dataset.recipeId, actionTarget);
          return;
        }

        if (action === 'select-planner-day') {
          const day = actionTarget.closest('[data-day]')?.dataset.day;
          if (day) {
            state.activePlannerDay = state.activePlannerDay === day ? null : day;
            // Close any open day-picker when switching days
            state.activeDayPicker = null;
            state.activeDayPickerQuery = '';
            renderPlanner();
          }
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

        if (action === 'edit-plan-servings') {
          const btn = actionTarget;
          const currentServings = Number.parseInt(btn.dataset.servings, 10) || 2;
          const input = document.createElement('input');
          input.type = 'number';
          input.min = '1';
          input.step = '1';
          input.inputMode = 'numeric';
          input.value = String(currentServings);
          input.className = 'planner-servings-input';
          input.setAttribute('aria-label', 'Portionen');

          const commit = async () => {
            const newServings = normalizePositiveInteger(input.value, currentServings);
            input.replaceWith(btn);
            if (newServings !== currentServings) {
              btn.textContent = `${newServings}P`;
              btn.dataset.servings = String(newServings);
              btn.setAttribute('aria-label', `Portionen anpassen: ${newServings}`);
              btn.classList.add('servings-updated');
              setTimeout(() => btn.classList.remove('servings-updated'), 600);
              await updatePlanEntryServings(
                btn.dataset.planEntryId,
                btn.dataset.day,
                Number.parseInt(btn.dataset.index, 10),
                newServings,
              );
            }
          };

          const cancel = () => {
            input.replaceWith(btn);
          };

          input.addEventListener('blur', commit, { once: true });
          input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              input.blur();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              input.removeEventListener('blur', commit);
              cancel();
            }
          });

          btn.replaceWith(input);
          input.focus();
          input.select();
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
      if (deps.clearPlanDialogController.handleKeydown?.(event)) return;
      if (modalController.handleKeydown(event)) return;
      if (handleDayPickerKeyboard(event)) return;

      if (event.key !== 'Escape') return;

      if (deps.clearPlanDialogController.isOpen?.()) {
        deps.clearPlanDialogController.close();
        return;
      }

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
  };
}
