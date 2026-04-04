import {
  DAYS,
  MEAL_SLOTS,
  compareTitles,
  formatLastCooked,
  getCookedTimestamp,
  getMealSlotLabel,
} from '../cookbook-schema.js';
import { escapeAttribute, escapeHtml } from './view-helpers.js';

// ── Shared helpers (unchanged, used by main.js) ──

export function getPlannerCandidates({ recipes, query = '' }) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [];
  return recipes
    .filter((recipe) => {
      return recipe.title.toLowerCase().includes(normalizedQuery)
        || (recipe.tags || []).some((tag) => tag.toLowerCase().includes(normalizedQuery));
    })
    .sort((a, b) => {
      const favoriteCompare = Number(b.favorite) - Number(a.favorite);
      if (favoriteCompare !== 0) return favoriteCompare;
      const cookedCompare = getCookedTimestamp(b) - getCookedTimestamp(a);
      if (cookedCompare !== 0) return cookedCompare;
      return compareTitles(a, b);
    });
}

export function renderDayPickerItems({
  day,
  query = '',
  recipes,
  activeDayPickerSlot,
}) {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    return `<div class="planner-day-picker-empty" aria-live="polite">Suchbegriff eingeben\u2026</div>`;
  }

  const matches = getPlannerCandidates({ recipes, query });
  if (!matches.length) {
    return `<div class="planner-day-picker-empty" aria-live="polite">Keine Treffer</div>`;
  }

  return matches.map((recipe) => {
    const meta = [
      recipe.favorite ? 'Favorit' : '',
      formatLastCooked(recipe, 'short'),
      `${recipe.baseServings} Pers. Standard`,
      `Slot ${getMealSlotLabel(activeDayPickerSlot, true)}`,
    ].filter(Boolean).join(' · ');

    return `
      <button type="button" class="planner-day-picker-item" data-action="add-to-day" data-day="${day}" data-recipe-id="${recipe.id}" aria-label="${escapeAttribute(recipe.title)} einplanen. ${escapeAttribute(meta)}">
        <span class="planner-day-picker-item-title">${escapeHtml(recipe.title)}</span>
        <span class="planner-day-picker-item-meta">${escapeHtml(meta)}</span>
      </button>
    `;
  }).join('');
}

// ── Compact planner: Day tabs + detail panel ──

const SLOT_ICONS = {
  fruehstueck: '\u2600',
  mittag: '\u25D0',
  abend: '\u263D',
  snack: '\u2726',
};

const DAY_FULL_NAMES = {
  Mo: 'Montag',
  Di: 'Dienstag',
  Mi: 'Mittwoch',
  Do: 'Donnerstag',
  Fr: 'Freitag',
  Sa: 'Samstag',
  So: 'Sonntag',
};

function groupEntriesBySlot(entries) {
  const grouped = {};
  for (const slot of MEAL_SLOTS) {
    grouped[slot.id] = [];
  }
  for (const entry of entries) {
    const slotId = entry.slot || 'mittag';
    if (!grouped[slotId]) grouped[slotId] = [];
    grouped[slotId].push(entry);
  }
  return grouped;
}

function renderSlotRow(day, slot, entry) {
  if (!entry) {
    return `
      <div class="planner-slot-row planner-slot-empty" data-drop-zone data-drop-day="${day}" data-drop-slot="${slot.id}" data-drop-position="0">
        <span class="planner-slot-icon">${SLOT_ICONS[slot.id] || '\u00B7'}</span>
        <span class="planner-slot-name">${escapeHtml(slot.label)}</span>
        <span class="planner-slot-placeholder">leer</span>
      </div>`;
  }
  const planEntryId = escapeAttribute(String(entry.planEntryId || entry.id || ''));
  const servings = entry.servings || 2;
  return `
    <div class="planner-slot-row day-recipe-chip" data-plan-entry-id="${planEntryId}" data-drop-zone data-drop-day="${day}" data-drop-slot="${slot.id}" data-drop-position="${entry._index ?? 0}">
      <button class="planner-drag-handle" data-action="start-plan-drag" data-plan-entry-id="${planEntryId}" data-day="${day}" data-index="${entry._index ?? 0}" aria-label="Verschieben" style="touch-action:none;">\u2261</button>
      <span class="planner-slot-icon">${SLOT_ICONS[slot.id] || '\u00B7'}</span>
      <span class="planner-slot-name">${escapeHtml(slot.label)}</span>
      <button class="planner-entry-title" data-action="open-recipe" data-recipe-id="${escapeAttribute(entry.recipeId)}">${escapeHtml(entry.recipeTitle || 'Rezept')}</button>
      <button class="planner-entry-servings" data-action="edit-plan-servings" data-plan-entry-id="${planEntryId}" data-day="${day}" data-index="${entry._index ?? 0}" data-servings="${servings}" aria-label="Portionen anpassen: ${servings}">${servings}P</button>
      <button class="planner-entry-remove" data-action="remove-plan-entry" data-plan-entry-id="${planEntryId}" data-day="${day}" data-index="${entry._index ?? 0}" aria-label="Entfernen">\u00D7</button>
    </div>`;
}

function renderDayDetail(day, weekPlan, recipes, activeDayPicker, activeDayPickerSlot, activeDayPickerQuery, renderMealSlotOptions) {
  const entries = weekPlan[day] || [];
  const grouped = groupEntriesBySlot(entries);
  const isPickerOpen = activeDayPicker === day;

  const slotRows = MEAL_SLOTS.map((slot) => {
    const slotEntries = grouped[slot.id] || [];
    const rows = slotEntries.length === 0
      ? renderSlotRow(day, slot, null)
      : slotEntries.map((entry) => renderSlotRow(day, slot, entry)).join('');
    return `<div class="planner-slot-section" data-slot-section="${slot.id}" data-slot-entry-count="${slotEntries.length}">${rows}</div>`;
  }).join('');

  let pickerHTML = '';
  if (isPickerOpen) {
    const pickerResults = getPlannerCandidates({ recipes, query: activeDayPickerQuery });
    const pickerStatusId = `picker-status-${day}`;
    const pickerListId = `picker-list-${day}`;

    pickerHTML = `
      <div class="planner-day-picker-panel" id="picker-${day}" aria-live="polite">
        <div class="planner-day-picker-status sr-only" id="${pickerStatusId}" aria-live="polite" aria-atomic="true">
          ${pickerResults.length} Ergebnis${pickerResults.length === 1 ? '' : 'se'} verfügbar.
        </div>
        <div class="planner-day-picker-toolbar">
          <label for="picker-slot-${day}">Eintragen als</label>
          <select class="planner-day-picker-slot" id="picker-slot-${day}" data-day-picker-slot="${day}">
            ${renderMealSlotOptions(activeDayPickerSlot)}
          </select>
        </div>
        <label class="sr-only" for="picker-search-${day}">Rezepte für ${day} suchen</label>
        <input class="planner-day-picker-search" type="text" value="${escapeAttribute(activeDayPickerQuery || '')}" placeholder="Rezept suchen \u2026" id="picker-search-${day}" data-day-picker-search="${day}" aria-describedby="${pickerStatusId} ${pickerListId}">
        <div class="planner-day-picker-list" id="${pickerListId}" aria-label="Suchergebnisse für ${day}">
          ${renderDayPickerItems({ day, query: activeDayPickerQuery, recipes, activeDayPickerSlot })}
        </div>
      </div>`;
  }

  return `
    <div class="planner-day-detail" data-day="${day}" data-day-column="${day}">
      <div class="planner-day-detail-header">
        <h3>${DAY_FULL_NAMES[day] || day}</h3>
        <div class="day-add-wrapper">
          <button type="button" class="${isPickerOpen ? 'day-add-btn day-add-btn-ghost' : 'day-add-btn'}" data-action="toggle-day-picker" data-day="${day}" aria-expanded="${String(isPickerOpen)}" aria-controls="picker-${day}">
            ${isPickerOpen ? 'Schliessen' : '+ Rezept'}
          </button>
          ${pickerHTML}
        </div>
      </div>
      ${slotRows}
    </div>`;
}

export function renderWeekPlanner({
  daysGrid,
  weekPlan,
  recipes,
  recipeById = null,
  activePlannerDay = null,
  activeDayPicker,
  activeDayPickerSlot,
  activeDayPickerQuery = '',
  renderMealSlotOptions,
}) {
  // 1. Day tabs bar
  const dayTabs = DAYS.map((day) => {
    const entries = weekPlan[day] || [];
    const isActive = activePlannerDay === day;
    return `
      <button class="planner-day-tab${isActive ? ' active' : ''}"
              data-action="select-planner-day" data-day="${day}"
              type="button">
        <span class="planner-day-name">${day}</span>
        <span class="planner-day-count">${entries.length || '\u2014'}</span>
      </button>`;
  }).join('');

  // 2. Detail panel for active day
  let detailPanel = '';
  if (activePlannerDay) {
    // Resolve recipe titles for entries, preserving original index
    const resolvedPlan = {};
    for (const day of DAYS) {
      resolvedPlan[day] = (weekPlan[day] || []).map((entry, index) => {
        const recipe = recipeById?.get(String(entry.recipeId)) || recipes.find((r) => r.id === String(entry.recipeId));
        return {
          ...entry,
          _index: index,
          recipeTitle: recipe?.title || entry.recipeTitle || 'Unbekannt',
        };
      });
    }
    detailPanel = renderDayDetail(
      activePlannerDay,
      resolvedPlan,
      recipes,
      activeDayPicker,
      activeDayPickerSlot,
      activeDayPickerQuery,
      renderMealSlotOptions,
    );
  }

  daysGrid.innerHTML = `
    <div class="planner-day-tabs">${dayTabs}</div>
    ${detailPanel}
  `;
}

// ── Shopping list (unchanged) ──

export function buildShoppingListText({ weekPlan, recipes, recipeById = null }) {
  const ingredientMap = {};
  const allEntries = DAYS.flatMap((day) => weekPlan[day] || []);

  allEntries.forEach((entry) => {
    const recipe = recipeById?.get(String(entry.recipeId)) || recipes.find((item) => item.id === String(entry.recipeId));
    if (!recipe || !recipe.parsedIngredients?.length) return;
    const servings = entry.servings || recipe.baseServings;

    recipe.parsedIngredients.forEach((ingredient) => {
      if (ingredient.quantity === null || ingredient.quantity === undefined) {
        const key = ingredient.name.toLowerCase();
        if (!ingredientMap[key]) ingredientMap[key] = { name: ingredient.name, quantity: null, unit: null };
        return;
      }

      const scaled = ingredient.quantity * (servings / recipe.baseServings);
      const key = `${ingredient.unit || 'stück'}:${ingredient.name.toLowerCase()}`;
      if (!ingredientMap[key]) ingredientMap[key] = { name: ingredient.name, quantity: 0, unit: ingredient.unit };
      ingredientMap[key].quantity += scaled;
    });
  });

  let text = '';
  Object.values(ingredientMap).forEach((item) => {
    if (item.quantity === null || item.quantity === undefined) {
      text += `${item.name}\n`;
      return;
    }
    let quantity = Math.round(item.quantity * 10) / 10;
    if (quantity === Math.floor(quantity)) quantity = Math.floor(quantity);
    text += `${quantity}${item.unit ? ` ${item.unit}` : ''} ${item.name}\n`;
  });

  return text;
}
