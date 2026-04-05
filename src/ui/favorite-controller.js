export function createFavoriteController(deps) {
  const { state, repository, effectsLayer, recipesController, modalRecipeController, notifications, focusManager, dataController, announceUi } = deps;

  const _favoritePending = new Set();

  function toggleFavoriteWithEffect({ recipeId, anchor, surface }) {
    if (_favoritePending.has(String(recipeId))) return;
    const recipe = state.recipeLookup.get(String(recipeId)) || state.recipes.find((item) => item.id === String(recipeId));
    if (!recipe) return;
    _favoritePending.add(String(recipeId));

    const isLike = !recipe.favorite;
    const anchorRect = anchor?.getBoundingClientRect ? anchor.getBoundingClientRect() : null;

    if (surface === 'modal') {
      focusManager.setPendingFocusTarget({ type: 'modal-favorite' });
    } else {
      focusManager.setPendingFocusTarget({ type: 'favorite-grid', recipeId });
    }

    if (isLike) {
      effectsLayer.playFavoriteBurst({
        anchor,
        anchorRect,
        surface,
      });
    } else if (state.motionMode !== 'reduce') {
      effectsLayer.playHeartPop({ anchor, anchorRect });
    }

    // Optimistic update: flip favorite immediately
    recipe.favorite = isLike;
    recipesController.render();
    if (state.currentModalRecipe?.id === String(recipeId)) {
      modalRecipeController.render();
    }
    if (!isLike) {
      announceUi('Aus Favoriten entfernt');
    }

    repository.toggleFavorite(recipeId)
      .then((result) => {
        dataController.applyLoadResult(result, { scope: 'recipes' });
      })
      .catch(() => {
        // Rollback
        recipe.favorite = !isLike;
        recipesController.render();
        if (state.currentModalRecipe?.id === String(recipeId)) {
          modalRecipeController.render();
        }
        notifications.error('Favorit konnte nicht gespeichert werden.');
      })
      .finally(() => {
        _favoritePending.delete(String(recipeId));
      });
  }

  return { toggleFavoriteWithEffect };
}
