import { DAYS } from '../cookbook-schema.js';
import { categorizeIngredient, getCategories, getCategoryById } from '../schema/ingredient-categories.js';
import { escapeHtml } from './view-helpers.js';

const STORAGE_KEY = 'kitab-shopping-checked';

function loadCheckedFromLocalStorage() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch (_error) {
    return new Set();
  }
}

function saveCheckedToLocalStorage(checkedSet) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...checkedSet]));
  } catch (_error) {
    // localStorage full or unavailable
  }
}

// Strip parenthetical notes for aggregation key: "Zwiebel (ca. 60 g)" → "zwiebel"
// But preserve "(optional)" as a flag
function normalizeIngredientName(name) {
  return (name || '').replace(/\s*\([^)]*\)\s*/g, ' ').trim();
}

function isOptionalIngredient(name) {
  return /\(.*optional.*\)/i.test(name || '');
}

function buildAggregatedItems(weekPlan, recipes, recipeLookup) {
  const itemMap = {};
  const allEntries = DAYS.flatMap((day) => weekPlan[day] || []);

  for (const entry of allEntries) {
    const recipe = recipeLookup?.get(String(entry.recipeId))
      || recipes.find((r) => r.id === String(entry.recipeId));
    if (!recipe || !recipe.parsedIngredients?.length) continue;

    const servings = entry.servings || recipe.baseServings;

    for (const ingredient of recipe.parsedIngredients) {
      const baseName = normalizeIngredientName(ingredient.name).toLowerCase();
      const optional = isOptionalIngredient(ingredient.name);

      if (ingredient.quantity === null || ingredient.quantity === undefined) {
        const key = `none:${baseName}`;
        if (!itemMap[key]) {
          itemMap[key] = { key, name: normalizeIngredientName(ingredient.name), quantity: null, unit: null, category: categorizeIngredient(ingredient.name), optional };
        }
        continue;
      }

      const scaled = ingredient.quantity * (servings / recipe.baseServings);
      const key = `${ingredient.unit || 'stück'}:${baseName}`;
      if (!itemMap[key]) {
        itemMap[key] = { key, name: normalizeIngredientName(ingredient.name), quantity: 0, unit: ingredient.unit, category: categorizeIngredient(ingredient.name), optional };
      }
      itemMap[key].quantity += scaled;
      // If any recipe marks it as non-optional, it's not optional
      if (!optional) itemMap[key].optional = false;
    }
  }

  return Object.values(itemMap);
}

function groupByCategory(items) {
  const groups = {};
  for (const cat of getCategories()) {
    groups[cat.id] = [];
  }
  for (const item of items) {
    const catId = item.category || 'other';
    if (!groups[catId]) groups[catId] = [];
    groups[catId].push(item);
  }
  // Return only non-empty categories, in order
  return getCategories()
    .filter((cat) => groups[cat.id].length > 0)
    .map((cat) => ({ ...cat, items: groups[cat.id] }));
}

function formatQuantity(quantity) {
  if (quantity === null || quantity === undefined) return '';
  let q = Math.round(quantity * 10) / 10;
  if (q === Math.floor(q)) q = Math.floor(q);
  return String(q);
}

function formatItemText(item) {
  if (item.quantity === null || item.quantity === undefined) return item.name;
  return `${formatQuantity(item.quantity)}${item.unit ? ` ${item.unit}` : ''} ${item.name}`;
}

export function createShoppingListController({ weekPlan, recipes, recipeLookup, initialChecked = null, onCheckedChange = null }) {
  let categorizedGroups = [];
  let checkedSet = initialChecked ? new Set(initialChecked) : loadCheckedFromLocalStorage();
  let overlayEl = null;
  let bodyEl = null;
  let progressEl = null;

  function build() {
    const items = buildAggregatedItems(weekPlan, recipes, recipeLookup);
    categorizedGroups = groupByCategory(items);
    return categorizedGroups;
  }

  function getTotalCount() {
    return categorizedGroups.reduce((sum, group) => sum + group.items.length, 0);
  }

  function getCheckedCount() {
    let count = 0;
    for (const group of categorizedGroups) {
      for (const item of group.items) {
        if (checkedSet.has(item.key)) count++;
      }
    }
    return count;
  }

  function updateProgress() {
    if (!progressEl) return;
    const total = getTotalCount();
    const checked = getCheckedCount();
    progressEl.textContent = total > 0 ? `${checked} von ${total}` : '';
  }

  function render(container) {
    bodyEl = container;
    if (!categorizedGroups.length) {
      container.innerHTML = '<p class="shopping-empty">Plane Rezepte in die Woche ein, dann erscheint hier deine Einkaufsliste.</p>';
      return;
    }

    container.innerHTML = categorizedGroups.map((group) => {
      const cat = getCategoryById(group.id);
      const itemsHtml = group.items.map((item) => {
        const checked = checkedSet.has(item.key);
        const optionalClass = item.optional ? ' shopping-item-optional' : '';
        return `
          <button type="button" class="shopping-item${checked ? ' checked' : ''}${optionalClass}" data-shopping-key="${escapeHtml(item.key)}" aria-pressed="${String(checked)}">
            <span class="shopping-check" aria-hidden="true">${checked ? '✓' : ''}</span>
            <span class="shopping-item-text">${escapeHtml(formatItemText(item))}${item.optional ? '<span class="shopping-optional-badge">optional</span>' : ''}</span>
          </button>`;
      }).join('');

      return `
        <section class="shopping-category">
          <h3 class="shopping-category-header">${cat.icon} ${escapeHtml(cat.label)}</h3>
          ${itemsHtml}
        </section>`;
    }).join('');

    updateProgress();
  }

  function persistChecked() {
    saveCheckedToLocalStorage(checkedSet);
    onCheckedChange?.([...checkedSet]);
  }

  function toggleItem(key) {
    if (checkedSet.has(key)) {
      checkedSet.delete(key);
    } else {
      checkedSet.add(key);
    }
    persistChecked();

    // Update single item in DOM without full re-render
    if (bodyEl) {
      const el = bodyEl.querySelector(`[data-shopping-key="${CSS.escape(key)}"]`);
      if (el) {
        const isChecked = checkedSet.has(key);
        el.classList.toggle('checked', isChecked);
        el.setAttribute('aria-pressed', String(isChecked));
        const checkMark = el.querySelector('.shopping-check');
        if (checkMark) checkMark.textContent = isChecked ? '✓' : '';
      }
    }
    updateProgress();
  }

  function clearChecked() {
    checkedSet.clear();
    persistChecked();
    if (bodyEl) render(bodyEl);
  }

  function getPlainText() {
    const lines = [];
    for (const group of categorizedGroups) {
      const openItems = group.items.filter((item) => !checkedSet.has(item.key));
      if (!openItems.length) continue;
      const cat = getCategoryById(group.id);
      lines.push(`── ${cat.label} ──`);
      for (const item of openItems) {
        lines.push('☐ ' + formatItemText(item));
      }
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  function setOverlayElements({ overlay, body, progress }) {
    overlayEl = overlay;
    bodyEl = body;
    progressEl = progress;
  }

  function hasItems() {
    return getTotalCount() > 0;
  }

  function getCheckedKeys() {
    return [...checkedSet];
  }

  return {
    build,
    render,
    toggleItem,
    clearChecked,
    getPlainText,
    getCheckedKeys,
    setOverlayElements,
    hasItems,
    updateProgress,
    getTotalCount,
    getCheckedCount,
  };
}
