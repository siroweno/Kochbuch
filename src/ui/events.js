export function bindAppEvents({
  elements,
  requiredFields,
  authService,
  handlers,
}) {
  const {
    googleLoginBtn,
    browserTestLoginForm,
    signOutBtn,
    toggleFormBtn,
    uploadImageBtn,
    imageFileInput,
    imageUrlInput,
    recipeForm,
    togglePlannerBtn,
    clearPlanBtn,
    shoppingSearchInput,
    exportShoppingBtn,
    exportBtn,
    restoreImportBtn,
    recipeImportBtn,
    restoreImportFile,
    recipeImportFile,
    migrateLocalBtn,
    searchInput,
    sortSelect,
    toggleFavoritesBtn,
    clearTagFilterBtn,
    modalCloseBtn,
    modalFavoriteBtn,
    modalCookedBtn,
    modalEditBtn,
    modalServingsSelect,
    confirmDeleteBtn,
    cancelDeleteBtn,
    deleteConfirm,
    recipeModal,
  } = elements;

  googleLoginBtn.addEventListener('click', handlers.onGoogleLogin);
  browserTestLoginForm.addEventListener('submit', handlers.onBrowserTestLoginSubmit);
  signOutBtn.addEventListener('click', handlers.onSignOut);
  toggleFormBtn.addEventListener('click', handlers.onToggleRecipeForm);
  uploadImageBtn.addEventListener('click', handlers.onUploadImageClick);
  imageFileInput.addEventListener('change', handlers.onImageFileChange);
  imageUrlInput.addEventListener('input', handlers.onImageUrlInput);
  recipeForm.addEventListener('submit', handlers.onRecipeSubmit);
  togglePlannerBtn.addEventListener('click', handlers.onTogglePlanner);
  clearPlanBtn.addEventListener('click', handlers.onClearPlan);
  shoppingSearchInput.addEventListener('input', handlers.onShoppingSearch);
  exportShoppingBtn.addEventListener('click', handlers.onExportShopping);
  exportBtn.addEventListener('click', handlers.onExportCookbook);
  restoreImportBtn.addEventListener('click', handlers.onOpenRestoreImport);
  recipeImportBtn.addEventListener('click', handlers.onOpenRecipeImport);
  restoreImportFile.addEventListener('change', handlers.onRestoreImportChange);
  recipeImportFile.addEventListener('change', handlers.onRecipeImportChange);
  migrateLocalBtn.addEventListener('click', handlers.onMigrateLocal);
  searchInput.addEventListener('input', handlers.onSearchInput);
  sortSelect.addEventListener('change', handlers.onSortChange);
  toggleFavoritesBtn.addEventListener('click', handlers.onToggleFavoritesFilter);
  clearTagFilterBtn.addEventListener('click', handlers.onClearTagFilter);
  modalCloseBtn.addEventListener('click', handlers.onCloseModal);
  modalFavoriteBtn.addEventListener('click', handlers.onToggleModalFavorite);
  modalCookedBtn.addEventListener('click', handlers.onModalCooked);
  modalEditBtn.addEventListener('click', handlers.onEditModal);
  modalServingsSelect.addEventListener('change', handlers.onModalServingsChange);
  confirmDeleteBtn.addEventListener('click', handlers.onConfirmDelete);
  cancelDeleteBtn.addEventListener('click', handlers.onCancelDelete);
  deleteConfirm.addEventListener('click', handlers.onDeleteOverlayClick);
  recipeModal.addEventListener('click', handlers.onModalOverlayClick);

  requiredFields.forEach((_message, input) => {
    input.addEventListener('input', () => handlers.onRequiredFieldInput(input));
    input.addEventListener('blur', () => handlers.onRequiredFieldBlur(input));
  });

  document.addEventListener('input', handlers.onDocumentInput);
  document.addEventListener('change', handlers.onDocumentChange);
  document.addEventListener('click', handlers.onDocumentClick);
  document.addEventListener('keydown', handlers.onDocumentKeydown);
  window.addEventListener('focus', handlers.onWindowFocus);
  authService.onAuthStateChange(handlers.onAuthStateChange);
}
