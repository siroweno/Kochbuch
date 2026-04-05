export function createDeleteHandlers(deps) {
  const {
    deleteConfirm,
    confirmDelete,
    cancelDelete,
  } = deps;

  return {
    onConfirmDelete: confirmDelete,

    onCancelDelete() {
      cancelDelete();
    },

    onDeleteOverlayClick(event) {
      if (event.target === deleteConfirm) {
        cancelDelete();
      }
    },
  };
}
