export function createFocusManager({ state, dom }) {
  const { modalFavoriteBtn, modalPlannerToggle, modalPlannerFeedback, daysGrid, modalEditBtn, weekPlanner } = dom;

  function escapeSelectorValue(value) {
    const stringValue = String(value ?? '');
    return globalThis.CSS?.escape ? globalThis.CSS.escape(stringValue) : stringValue.replace(/"/g, '\\"');
  }

  function setPendingFocusTarget(target) {
    state.pendingFocusTarget = target || null;
  }

  function getPendingFocusElement(target = state.pendingFocusTarget) {
    if (!target) return null;

    if (target.selector) {
      return document.querySelector(target.selector);
    }

    if (target.type === 'favorite-grid' && target.recipeId) {
      return document.querySelector(`[data-action="toggle-favorite"][data-recipe-id="${escapeSelectorValue(target.recipeId)}"]`);
    }

    if (target.type === 'modal-favorite') {
      return modalFavoriteBtn;
    }

    if (target.type === 'modal-planner-toggle') {
      return modalPlannerToggle;
    }

    if (target.type === 'modal-planner-feedback') {
      return modalPlannerFeedback;
    }

    if (target.type === 'day-picker-trigger' && target.day) {
      return document.querySelector(`[data-action="toggle-day-picker"][data-day="${escapeSelectorValue(target.day)}"]`);
    }

    if (target.type === 'plan-entry' && target.planEntryId) {
      const baseSelector = `[data-plan-entry-id="${escapeSelectorValue(target.planEntryId)}"]`;
      if (target.action) {
        return document.querySelector(`${baseSelector}[data-action="${escapeSelectorValue(target.action)}"]`);
      }
      return document.querySelector(baseSelector);
    }

    return null;
  }

  function restorePendingFocusTarget() {
    if (!state.pendingFocusTarget) return;
    const target = state.pendingFocusTarget;

    window.requestAnimationFrame(() => {
      const element = getPendingFocusElement(target);
      if (element && typeof element.focus === 'function') {
        element.focus();
        state.pendingFocusTarget = null;
      }
    });
  }

  return { setPendingFocusTarget, getPendingFocusElement, restorePendingFocusTarget, escapeSelectorValue };
}
