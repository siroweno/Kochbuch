import { normalizeMultilineText, normalizeTags } from '../cookbook-schema.js';

export function createRecipeFormController({
  elements,
  requiredFields,
  defaultServings = '2',
  onOpenChange = null,
  recipeCategories = [],
}) {
  const {
    recipeForm,
    formContainer,
    toggleFormBtn,
    titleInput,
    servingsInput,
    imagePreview,
    previewImg,
    imageUrlInput,
    imageFileInput,
    prepTimeInput,
    cookTimeInput,
    categorySelect,
    tagsInput,
    descriptionInput,
    ingredientsInput,
    instructionsInput,
    platingInput,
    tipsInput,
    formTitle,
  } = elements;

  const categoryIds = new Set(recipeCategories.map((c) => c.id));

  let pendingImageUpload = null;

  function updateRequiredFieldValidity(input) {
    const message = requiredFields.get(input);
    if (!message) return true;
    const hasContent = normalizeMultilineText(input.value).length > 0;
    input.setCustomValidity(hasContent ? '' : message);
    return hasContent;
  }

  function validateRecipeForm() {
    let firstInvalid = null;
    requiredFields.forEach((_message, input) => {
      const valid = updateRequiredFieldValidity(input);
      if (!valid && !firstInvalid) {
        firstInvalid = input;
      }
    });
    if (firstInvalid) {
      firstInvalid.reportValidity();
      firstInvalid.focus();
      return false;
    }
    return true;
  }

  async function resizeImage(file) {
    const rawDataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(event.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => {
        const maxWidth = 600;
        const maxHeight = 400;
        let width = image.width;
        let height = image.height;
        if (width > maxWidth) {
          height = Math.round(height * (maxWidth / width));
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round(width * (maxHeight / height));
          height = maxHeight;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      image.src = rawDataUrl;
    });
  }

  function resetForm() {
    recipeForm.reset();
    servingsInput.value = defaultServings;
    imagePreview.style.display = 'none';
    formTitle.textContent = 'Neues Rezept';
    pendingImageUpload = null;
    requiredFields.forEach((_message, input) => input.setCustomValidity(''));
  }

  function openRecipeForm() {
    formContainer.classList.add('visible');
    toggleFormBtn.textContent = '✕ Abbrechen';
    onOpenChange?.(true);
    titleInput.focus();
  }

  function closeRecipeForm() {
    formContainer.classList.remove('visible');
    toggleFormBtn.textContent = '+ Neues Rezept';
    onOpenChange?.(false);
    resetForm();
  }

  function buildTagsWithCategory() {
    const selectedCategoryId = categorySelect ? categorySelect.value : '';
    const freeTags = normalizeTags(tagsInput.value);
    if (selectedCategoryId) {
      const match = recipeCategories.find((c) => c.id === selectedCategoryId);
      const categoryLabel = match ? match.label : selectedCategoryId;
      return [categoryLabel, ...freeTags.filter((t) => t !== categoryLabel && t !== selectedCategoryId)];
    }
    return freeTags;
  }

  function prefillRecipeForm(recipe) {
    pendingImageUpload = null;
    titleInput.value = recipe.title;
    servingsInput.value = String(recipe.baseServings);
    prepTimeInput.value = recipe.prepTime || '';
    cookTimeInput.value = recipe.cookTime || '';
    // Split tags into category (first tag if it matches a known category by id or label) and free tags
    const tags = recipe.tags || [];
    const firstTag = tags[0] || '';
    const matchedCategory = recipeCategories.find((c) => c.id === firstTag || c.label === firstTag);
    if (categorySelect && matchedCategory) {
      categorySelect.value = matchedCategory.id;
      tagsInput.value = tags.slice(1).join(', ');
    } else {
      if (categorySelect) categorySelect.value = '';
      tagsInput.value = tags.join(', ');
    }
    imageUrlInput.value = recipe.imageEditorValue || '';
    if (recipe.imageUrl) {
      previewImg.src = recipe.imageUrl;
      imagePreview.style.display = 'block';
    } else {
      imagePreview.style.display = 'none';
    }
    descriptionInput.value = recipe.description || '';
    ingredientsInput.value = recipe.rawIngredients || '';
    instructionsInput.value = recipe.instructions || '';
    platingInput.value = recipe.plating || '';
    tipsInput.value = recipe.tips || '';
    formTitle.textContent = `Bearbeiten: ${recipe.title}`;
    formContainer.classList.add('visible');
    toggleFormBtn.textContent = '✕ Abbrechen';
    onOpenChange?.(true);
    titleInput.focus();
  }

  async function handleImageFileChange(file) {
    if (!file) return null;
    const dataUrl = await resizeImage(file);
    pendingImageUpload = {
      dataUrl,
      filename: file.name || 'bild.jpg',
    };
    previewImg.src = dataUrl;
    imagePreview.style.display = 'block';
    imageUrlInput.value = '';
    imageFileInput.value = '';
    return pendingImageUpload;
  }

  function handleImageUrlInput({ isDataUrl, isExternalImageUrl }) {
    const value = imageUrlInput.value.trim();
    if (value && (isExternalImageUrl(value) || isDataUrl(value))) {
      previewImg.src = value;
      imagePreview.style.display = 'block';
    } else if (!value && !pendingImageUpload) {
      imagePreview.style.display = 'none';
    }
    if (value) {
      pendingImageUpload = null;
    }
  }

  function getPendingImageUpload() {
    return pendingImageUpload;
  }

  function clearPendingImageUpload() {
    pendingImageUpload = null;
  }

  return {
    buildTagsWithCategory,
    clearPendingImageUpload,
    closeRecipeForm,
    getPendingImageUpload,
    handleImageFileChange,
    handleImageUrlInput,
    openRecipeForm,
    prefillRecipeForm,
    resetForm,
    updateRequiredFieldValidity,
    validateRecipeForm,
  };
}
