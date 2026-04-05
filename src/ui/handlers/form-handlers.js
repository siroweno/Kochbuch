export function createFormHandlers(deps) {
  const {
    formController,
    formContainer,
    imageFileInput,
    closeRecipeForm,
    openRecipeForm,
    handleRecipeSubmit,
    isDataUrl,
    isExternalImageUrl,
  } = deps;

  return {
    onToggleRecipeForm() {
      if (formContainer.classList.contains('visible')) {
        closeRecipeForm();
      } else {
        openRecipeForm();
        const { toolbarToggle, toolbarPanel, toolbarOverlay } = deps.toolbar;
        if (toolbarPanel) toolbarPanel.classList.remove('open');
        if (toolbarOverlay) toolbarOverlay.classList.remove('visible');
        if (toolbarToggle) toolbarToggle.setAttribute('aria-expanded', 'false');
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

    onRequiredFieldInput(input) {
      formController.updateRequiredFieldValidity(input);
    },

    onRequiredFieldBlur(input) {
      formController.updateRequiredFieldValidity(input);
    },
  };
}
