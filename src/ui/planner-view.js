import {
  DAYS,
  MEAL_SLOTS,
  compareTitles,
  formatLastCooked,
  getCookedTimestamp,
  getMealSlotLabel,
} from '../cookbook-schema.js';
import { escapeAttribute, escapeHtml } from './view-helpers.js';

export function getPlannerCandidates({ recipes, query = '' }) {
  const normalizedQuery = query.trim().toLowerCase();
  return recipes
    .filter((recipe) => {
      if (!normalizedQuery) return true;
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

function getPlanEntryId(day, entry, index) {
  return String(entry?.planEntryId || entry?.id || `${day}-${index}`);
}

function renderDayOptions(selectedDay) {
  return DAYS.map((day) => `<option value="${day}"${day === selectedDay ? ' selected' : ''}>${day}</option>`).join('');
}

function renderDropZone({ day, slot, position, dragState, empty = false }) {
  const isTarget = Boolean(
    dragState?.active
    && dragState?.over?.day === day
    && dragState?.over?.slot === slot
    && Number(dragState?.over?.position) === position,
  );
  return `
    <button
      type="button"
      class="chip-drop-zone${dragState?.active ? ' visible' : ''}${isTarget ? ' is-target' : ''}${empty ? ' chip-drop-zone-empty' : ''}"
      data-drop-zone="true"
      data-drop-day="${day}"
      data-drop-slot="${slot}"
      data-drop-position="${position}"
      tabindex="-1"
      aria-hidden="true"
    >
      ${empty ? 'Hier ablegen' : 'Eintrag hier ablegen'}
    </button>
  `;
}

export function renderDayPickerItems({
  day,
  query = '',
  recipes,
  activeDayPickerSlot,
}) {
  const matches = getPlannerCandidates({ recipes, query });
  if (!matches.length) {
    return `<div class="day-picker-empty" aria-live="polite">${query ? 'Keine Treffer' : 'Keine Rezepte'}</div>`;
  }

  return matches.map((recipe) => {
    const meta = [
      recipe.favorite ? 'Favorit' : '',
      formatLastCooked(recipe, 'short'),
      `${recipe.baseServings} Pers. Standard`,
      `Slot ${getMealSlotLabel(activeDayPickerSlot, true)}`,
    ].filter(Boolean).join(' · ');

    return `
      <button type="button" class="day-picker-item" data-action="add-to-day" data-day="${day}" data-recipe-id="${recipe.id}" aria-label="${escapeAttribute(recipe.title)} einplanen. ${escapeAttribute(meta)}">
        <span class="day-picker-item-title">${escapeHtml(recipe.title)}</span>
        <span class="day-picker-item-meta">${escapeHtml(meta)}</span>
      </button>
    `;
  }).join('');
}

export function renderWeekPlanner({
  daysGrid,
  weekPlan,
  recipes,
  recipeById = null,
  activeDayPicker,
  activeDayPickerSlot,
  activeDayPickerQuery = '',
  activeMoveEntryId = null,
  moveEntryDraftDay = null,
  moveEntryDraftSlot = 'abend',
  dragState = null,
  renderServingOptions,
  renderMealSlotOptions,
}) {
  daysGrid.innerHTML = DAYS.map((day) => {
    const entries = (weekPlan[day] || [])
      .map((entry, index) => ({
        entry,
        index,
        recipe: recipeById?.get(String(entry.recipeId)) || recipes.find((recipe) => recipe.id === String(entry.recipeId)),
      }))
      .filter((item) => item.recipe);
    const pickerOpen = activeDayPicker === day;
    const pickerStatusId = `picker-status-${day}`;
    const pickerListId = `picker-list-${day}`;
    const pickerResults = pickerOpen ? getPlannerCandidates({ recipes, query: activeDayPickerQuery }) : [];

    const slotSections = MEAL_SLOTS.map((slot) => {
      const slotEntries = entries.filter((item) => item.entry.slot === slot.id);
      const chips = slotEntries.map(({ entry, index, recipe }, slotIndex) => {
        const planEntryId = getPlanEntryId(day, entry, index);
        const movePanel = activeMoveEntryId === planEntryId ? `
          <div class="chip-move-panel" data-plan-entry-id="${escapeAttribute(planEntryId)}">
            <label class="sr-only" for="move-entry-day-${planEntryId}">Tag für ${escapeHtml(recipe.title)}</label>
            <select id="move-entry-day-${planEntryId}" data-action="move-entry-day" data-plan-entry-id="${escapeAttribute(planEntryId)}" aria-label="Tag für ${escapeAttribute(recipe.title)}">
              ${renderDayOptions(moveEntryDraftDay || day)}
            </select>
            <label class="sr-only" for="move-entry-slot-${planEntryId}">Slot für ${escapeHtml(recipe.title)}</label>
            <select id="move-entry-slot-${planEntryId}" data-action="move-entry-slot" data-plan-entry-id="${escapeAttribute(planEntryId)}" aria-label="Slot für ${escapeAttribute(recipe.title)}">
              ${renderMealSlotOptions(moveEntryDraftSlot || entry.slot)}
            </select>
            <button type="button" class="chip-move-confirm" data-action="confirm-move-entry" data-plan-entry-id="${escapeAttribute(planEntryId)}">Speichern</button>
            <button type="button" class="chip-move-cancel" data-action="cancel-move-entry" data-plan-entry-id="${escapeAttribute(planEntryId)}">Abbrechen</button>
          </div>
        ` : '';

        return `
        ${renderDropZone({ day, slot: slot.id, position: slotIndex, dragState })}
        <div class="day-recipe-chip" data-plan-entry-id="${escapeAttribute(planEntryId)}" data-day="${day}" data-index="${index}">
          <button type="button" class="chip-drag-handle" data-action="start-plan-drag" data-plan-entry-id="${escapeAttribute(planEntryId)}" data-day="${day}" data-index="${index}" aria-label="${escapeAttribute(recipe.title)} verschieben" title="Zum Verschieben greifen">⋮⋮</button>
          <div class="chip-main">
            <button type="button" class="chip-name" data-action="open-recipe" data-recipe-id="${recipe.id}" data-modal-servings="${entry.servings}" title="${escapeAttribute(recipe.title)}">${escapeHtml(recipe.title)}</button>
            <div class="chip-controls">
              <div class="chip-field">
                <span>Slot</span>
                <label class="sr-only" for="chip-slot-${day}-${index}">Mahlzeiten-Slot für ${escapeHtml(recipe.title)}</label>
                <select id="chip-slot-${day}-${index}" class="chip-slot-select" data-action="plan-slot" data-day="${day}" data-index="${index}" data-plan-entry-id="${escapeAttribute(planEntryId)}" aria-label="Mahlzeiten-Slot für ${escapeAttribute(recipe.title)}">
                  ${renderMealSlotOptions(entry.slot, true)}
                </select>
              </div>
              <div class="chip-field">
                <span>Port.</span>
                <label class="sr-only" for="chip-servings-${day}-${index}">Portionen für ${escapeHtml(recipe.title)}</label>
                <select id="chip-servings-${day}-${index}" class="chip-servings-select" data-action="plan-serving" data-day="${day}" data-index="${index}" data-plan-entry-id="${escapeAttribute(planEntryId)}" aria-label="Portionen für ${escapeAttribute(recipe.title)}">
                  ${renderServingOptions(entry.servings)}
                </select>
              </div>
            </div>
          </div>
          <div class="chip-actions">
            <button type="button" class="chip-cooked${formatLastCooked(recipe, 'short') ? ' active' : ''}" data-action="mark-cooked" data-recipe-id="${recipe.id}" data-plan-entry-id="${escapeAttribute(planEntryId)}" title="${escapeAttribute(formatLastCooked(recipe, 'long') || 'Heute gekocht markieren')}" aria-label="${escapeAttribute(recipe.title)} als gekocht markieren">✓</button>
            <button type="button" class="chip-move" data-action="move-plan-entry" data-day="${day}" data-index="${index}" data-plan-entry-id="${escapeAttribute(planEntryId)}" title="Verschieben" aria-label="${escapeAttribute(recipe.title)} verschieben">Verschieben…</button>
            <button type="button" class="chip-remove" data-action="remove-plan-entry" data-day="${day}" data-index="${index}" data-plan-entry-id="${escapeAttribute(planEntryId)}" title="Entfernen" aria-label="${escapeAttribute(recipe.title)} aus ${day} entfernen">×</button>
          </div>
        </div>
        ${movePanel}
      `;
      }).join('');

      return `<div class="day-slot-section" data-slot-section="${slot.id}" data-slot-entry-count="${slotEntries.length}">
        <div class="day-slot-label">${slot.label}</div>
        ${slotEntries.length
          ? `${chips}${renderDropZone({ day, slot: slot.id, position: slotEntries.length, dragState })}`
          : `${renderDropZone({ day, slot: slot.id, position: 0, dragState, empty: true })}<div class="day-slot-empty">Noch frei</div>`}
      </div>`;
    }).join('');

    const pickerSearch = pickerOpen ? `
      <div class="day-picker-toolbar">
        <label for="picker-slot-${day}">Eintragen als</label>
        <select class="day-picker-slot" id="picker-slot-${day}" data-day-picker-slot="${day}">
          ${renderMealSlotOptions(activeDayPickerSlot)}
        </select>
      </div>
      <label class="sr-only" for="picker-search-${day}">Rezepte für ${day} suchen</label>
      <input class="day-picker-search" type="text" value="${escapeAttribute(activeDayPickerQuery)}" placeholder="Suchen …" id="picker-search-${day}" data-day-picker-search="${day}" aria-describedby="${pickerStatusId} ${pickerListId}">
    ` : '';

    return `
      <div class="day-column" data-day-column="${day}">
        <div class="day-name">${day}</div>
        ${slotSections || '<div class="day-empty">Noch nichts geplant</div>'}
        <div class="day-add-wrapper">
          <button type="button" class="day-add-btn" data-action="toggle-day-picker" data-day="${day}" aria-expanded="${String(pickerOpen)}" aria-controls="picker-${day}">+ Rezept</button>
          <div class="day-picker ${pickerOpen ? 'open' : ''}" id="picker-${day}" ${pickerOpen ? 'aria-live="polite"' : ''}>
            <div class="day-picker-status sr-only" id="${pickerStatusId}" aria-live="polite" aria-atomic="true">${pickerOpen ? `${pickerResults.length} Ergebnis${pickerResults.length === 1 ? '' : 'se'} verfügbar.` : ''}</div>
            ${pickerSearch}
            <div class="day-picker-list" id="${pickerListId}" aria-label="Suchergebnisse für ${day}">${pickerOpen ? renderDayPickerItems({ day, query: activeDayPickerQuery, recipes, activeDayPickerSlot }) : ''}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

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
