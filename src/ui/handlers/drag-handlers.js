export function createDragHandlers(deps) {
  const {
    state,
    startPlanDrag,
    cancelPendingDrag,
    updateDragTarget,
    finishPlanDrag,
    getDropTargetFromElement,
  } = deps;

  return {
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
  };
}
