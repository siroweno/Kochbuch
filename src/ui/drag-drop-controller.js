import { DAYS, getMealSlotLabel, isValidMealSlot } from '../cookbook-schema.js';
import { cloneWeekPlan, movePlanEntryWithinPlan } from './plan-operations.js';

export function createDragDropController(deps) {
  const { state, dom, plannerController, focusManager, plannerActions } = deps;

  // Cache of currently highlighted elements to avoid full-document querySelectorAll on every pointer move
  let highlightedEls = [];

  function clearDragPreviewClasses() {
    for (const el of highlightedEls) {
      el.classList.remove('is-target', 'is-dragging');
    }
    highlightedEls = [];
  }

  function setDropZonesVisible(visible) {
    dom.weekPlanner.classList.toggle('planner-drag-active', visible);
    document.querySelectorAll('.chip-drop-zone').forEach((element) => {
      element.classList.toggle('visible', visible);
    });
  }

  function highlightDropTarget(planEntryId, over) {
    clearDragPreviewClasses();
    if (planEntryId) {
      document.querySelectorAll(`.day-recipe-chip[data-plan-entry-id="${focusManager.escapeSelectorValue(planEntryId)}"]`).forEach((element) => {
        element.classList.add('is-dragging');
        highlightedEls.push(element);
      });
    }
    if (!over) return;
    const selector = `.chip-drop-zone[data-drop-day="${focusManager.escapeSelectorValue(over.day)}"][data-drop-slot="${focusManager.escapeSelectorValue(over.slot)}"][data-drop-position="${focusManager.escapeSelectorValue(over.position)}"]`;
    document.querySelectorAll(selector).forEach((element) => {
      element.classList.add('is-target');
      highlightedEls.push(element);
    });
  }

  function removeGhost() {
    const ghost = state.dragState?.ghost;
    if (!ghost) return;

    const targetZone = document.querySelector('.chip-drop-zone.is-target');
    if (targetZone) {
      // Ghost gleitet zur Drop-Zone
      const rect = targetZone.getBoundingClientRect();
      ghost.style.transition = 'all 0.25s cubic-bezier(0.23, 1, 0.32, 1)';
      ghost.style.left = `${rect.left + rect.width / 2 - ghost.offsetWidth / 2}px`;
      ghost.style.top = `${rect.top}px`;
      ghost.style.transform = 'scale(0.6) rotate(0deg)';
      ghost.style.opacity = '0.4';
    } else {
      ghost.style.transition = 'all 0.2s ease';
      ghost.style.opacity = '0';
      ghost.style.transform = 'rotate(6deg) scale(0.8)';
    }
    setTimeout(() => ghost.remove(), 300);
    state.dragState.ghost = null;
  }

  function cancelPendingDrag() {
    if (state.dragState?.holdTimer) {
      window.clearTimeout(state.dragState.holdTimer);
    }
    removeGhost();
    clearDragPreviewClasses();
    setDropZonesVisible(false);
    state.dragState = null;
    state.plannerDraftWeekPlan = null;
  }

  function startPlanDrag({ planEntryId, day, index, pointerId, pointerType, clientX, clientY }) {
    state.dragState = {
      planEntryId,
      day,
      index,
      pointerId,
      pointerType,
      active: true,
      holdTimer: null,
      originX: clientX,
      originY: clientY,
      over: null,
    };
    state.plannerDraftWeekPlan = cloneWeekPlan(state.weekPlan);
    setDropZonesVisible(true);
    highlightDropTarget(planEntryId, null);
    // Ghost erstellen
    const chipEl = document.querySelector(`[data-action="start-plan-drag"][data-plan-entry-id="${planEntryId}"]`)?.closest('.day-recipe-chip');
    if (chipEl) {
      const rect = chipEl.getBoundingClientRect();
      const ghost = chipEl.cloneNode(true);
      ghost.classList.add('drag-ghost');
      ghost.removeAttribute('data-action');
      ghost.style.cssText = `
        position: fixed;
        left: ${rect.left}px;
        top: ${rect.top}px;
        width: ${rect.width}px;
        pointer-events: none;
        z-index: 1000;
      `;
      document.body.appendChild(ghost);
      state.dragState.ghost = ghost;
      state.dragState.ghostOffsetX = clientX - rect.left;
      state.dragState.ghostOffsetY = clientY - rect.top;
    }
  }

  function updateDragTarget(clientX, clientY) {
    if (!state.dragState?.active) return;
    // Ghost dem Cursor folgen lassen
    const ghost = state.dragState?.ghost;
    if (ghost) {
      ghost.style.left = `${clientX - state.dragState.ghostOffsetX}px`;
      ghost.style.top = `${clientY - state.dragState.ghostOffsetY}px`;
    }

    const over = getDropTargetAtPoint(clientX, clientY);
    if (!over) {
      state.dragState.over = null;
      highlightDropTarget(state.dragState.planEntryId, null);
      return;
    }

    state.dragState.over = over;
    highlightDropTarget(state.dragState.planEntryId, state.dragState.over);

    const edgeThreshold = 72;
    if (clientY < edgeThreshold) {
      window.scrollBy({ top: -18, behavior: 'auto' });
    } else if (window.innerHeight - clientY < edgeThreshold) {
      window.scrollBy({ top: 18, behavior: 'auto' });
    }
  }

  function getDropTargetFromElement(element) {
    const dropZone = element?.closest?.('[data-drop-zone]');
    if (dropZone) {
      return {
        day: dropZone.dataset.dropDay,
        slot: dropZone.dataset.dropSlot,
        position: Number.parseInt(dropZone.dataset.dropPosition, 10),
      };
    }

    const slotSection = element?.closest?.('[data-slot-section]');
    const dayColumn = element?.closest?.('[data-day-column]');
    if (!slotSection || !dayColumn) return null;

    return {
      day: dayColumn.dataset.dayColumn,
      slot: slotSection.dataset.slotSection,
      position: Number.parseInt(slotSection.dataset.slotEntryCount || '0', 10),
    };
  }

  function getDropTargetAtPoint(clientX, clientY) {
    const pointElement = document.elementFromPoint(clientX, clientY);
    const directTarget = getDropTargetFromElement(pointElement);
    if (directTarget) return directTarget;

    const dayColumn = pointElement?.closest?.('[data-day-column]');
    if (!dayColumn) return null;

    const slotSections = Array.from(dayColumn.querySelectorAll('[data-slot-section]'));
    const matchingSection = slotSections.find((section) => {
      const rect = section.getBoundingClientRect();
      return clientY >= rect.top && clientY <= rect.bottom;
    }) || slotSections
      .map((section) => ({ section, rect: section.getBoundingClientRect() }))
      .sort((a, b) => {
        const distanceA = Math.min(Math.abs(clientY - a.rect.top), Math.abs(clientY - a.rect.bottom));
        const distanceB = Math.min(Math.abs(clientY - b.rect.top), Math.abs(clientY - b.rect.bottom));
        return distanceA - distanceB;
      })[0]?.section;

    if (!matchingSection) return null;

    return {
      day: dayColumn.dataset.dayColumn,
      slot: matchingSection.dataset.slotSection,
      position: Number.parseInt(matchingSection.dataset.slotEntryCount || '0', 10),
    };
  }

  async function finishPlanDrag(clientX = null, clientY = null) {
    if (!state.dragState?.active) {
      cancelPendingDrag();
      return;
    }

    const { planEntryId } = state.dragState;
    const over = state.dragState.over || (
      typeof clientX === 'number' && typeof clientY === 'number'
        ? getDropTargetAtPoint(clientX, clientY)
        : null
    );
    clearDragPreviewClasses();
    setDropZonesVisible(false);

    if (over && DAYS.includes(over.day) && isValidMealSlot(over.slot)) {
      state.weekPlan = movePlanEntryWithinPlan(state.weekPlan, planEntryId, over);
      state.lastPlannerSlot = over.slot;
      focusManager.setPendingFocusTarget({ type: 'plan-entry', planEntryId, action: 'start-plan-drag' });
      deps.announceUi(`Eintrag nach ${over.day} · ${getMealSlotLabel(over.slot)} verschoben.`);
      removeGhost();
      state.dragState = null;
      state.plannerDraftWeekPlan = null;
      await plannerActions.persistWeekPlan();
      return;
    }

    removeGhost();
    state.dragState = null;
    state.plannerDraftWeekPlan = null;
    plannerController.render();
  }

  return {
    clearDragPreviewClasses,
    setDropZonesVisible,
    highlightDropTarget,
    removeGhost,
    cancelPendingDrag,
    startPlanDrag,
    updateDragTarget,
    getDropTargetFromElement,
    getDropTargetAtPoint,
    finishPlanDrag,
  };
}
