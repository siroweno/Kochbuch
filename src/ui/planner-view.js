import {
  DAYS,
  MEAL_SLOTS,
  compareTitles,
  formatLastCooked,
  getCookedTimestamp,
  getMealSlotLabel,
  getPlannerStats,
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

export function renderPlannerSummary({ plannerSummary, weekPlan, recipes }) {
  const stats = getPlannerStats(weekPlan, recipes);
  plannerSummary.innerHTML = `
    <div class="summary-card">
      <strong>Geplante Mahlzeiten</strong>
      <div class="summary-card-value">${stats.entries}</div>
      <p>${stats.entries ? `${stats.uniqueRecipes} verschiedene Rezepte sind diese Woche im Umlauf.` : 'Noch leer: oeffne einen Tag und trage ein Rezept direkt in einen Slot ein.'}</p>
    </div>
    <div class="summary-card">
      <strong>Belegte Tage</strong>
      <div class="summary-card-value">${stats.plannedDays}</div>
      <p>${stats.plannedDays ? 'Portionen und Slots bleiben pro Eintrag gespeichert.' : 'Ideal fuer wiederkehrende Wochenmuster oder spontane Planung.'}</p>
    </div>
    <div class="summary-card">
      <strong>Favoriten im Plan</strong>
      <div class="summary-card-value">${stats.favoriteEntries}</div>
      <p>${stats.favoriteEntries ? 'Favoriten stehen im Picker zuerst und landen dadurch schneller im Alltag.' : 'Herzrezepte helfen besonders, wenn es schnell gehen soll.'}</p>
    </div>
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
    return `<div class="day-picker-item" aria-disabled="true" style="color:#a0826d;font-style:italic;">${query ? 'Keine Treffer' : 'Keine Rezepte'}</div>`;
  }

  return matches.map((recipe) => `
    <button type="button" class="day-picker-item" data-action="add-to-day" data-day="${day}" data-recipe-id="${recipe.id}" role="option">
      ${escapeHtml(recipe.title)}
      <span class="day-picker-item-meta">${[
        recipe.favorite ? 'Favorit' : '',
        formatLastCooked(recipe, 'short'),
        `${recipe.baseServings} Pers. Standard`,
        `Slot ${getMealSlotLabel(activeDayPickerSlot, true)}`,
      ].filter(Boolean).join(' · ')}</span>
    </button>
  `).join('');
}

export function renderWeekPlanner({
  daysGrid,
  plannerSummary,
  weekPlan,
  recipes,
  activeDayPicker,
  activeDayPickerSlot,
  renderServingOptions,
  renderMealSlotOptions,
}) {
  renderPlannerSummary({ plannerSummary, weekPlan, recipes });
  daysGrid.innerHTML = DAYS.map((day) => {
    const entries = (weekPlan[day] || [])
      .map((entry, index) => ({ entry, index, recipe: recipes.find((recipe) => recipe.id === String(entry.recipeId)) }))
      .filter((item) => item.recipe);

    const slotSections = MEAL_SLOTS.map((slot) => {
      const slotEntries = entries.filter((item) => item.entry.slot === slot.id);
      if (!slotEntries.length) return '';

      const chips = slotEntries.map(({ entry, index, recipe }) => `
        <div class="day-recipe-chip">
          <div class="chip-main">
            <button type="button" class="chip-name" data-action="open-recipe" data-recipe-id="${recipe.id}" data-modal-servings="${entry.servings}" title="${escapeAttribute(recipe.title)}">${escapeHtml(recipe.title)}</button>
            <div class="chip-controls">
              <div class="chip-field">
                <span>Slot</span>
                <label class="sr-only" for="chip-slot-${day}-${index}">Mahlzeiten-Slot für ${escapeHtml(recipe.title)}</label>
                <select id="chip-slot-${day}-${index}" class="chip-slot-select" data-action="plan-slot" data-day="${day}" data-index="${index}" aria-label="Mahlzeiten-Slot für ${escapeAttribute(recipe.title)}">
                  ${renderMealSlotOptions(entry.slot, true)}
                </select>
              </div>
              <div class="chip-field">
                <span>Port.</span>
                <label class="sr-only" for="chip-servings-${day}-${index}">Portionen für ${escapeHtml(recipe.title)}</label>
                <select id="chip-servings-${day}-${index}" class="chip-servings-select" data-action="plan-serving" data-day="${day}" data-index="${index}" aria-label="Portionen für ${escapeAttribute(recipe.title)}">
                  ${renderServingOptions(entry.servings)}
                </select>
              </div>
            </div>
          </div>
          <div class="chip-actions">
            <button type="button" class="chip-cooked${formatLastCooked(recipe, 'short') ? ' active' : ''}" data-action="mark-cooked" data-recipe-id="${recipe.id}" title="${escapeAttribute(formatLastCooked(recipe, 'long') || 'Heute gekocht markieren')}" aria-label="${escapeAttribute(recipe.title)} als gekocht markieren">✓</button>
            <button type="button" class="chip-remove" data-action="remove-plan-entry" data-day="${day}" data-index="${index}" title="Entfernen" aria-label="${escapeAttribute(recipe.title)} aus ${day} entfernen">×</button>
          </div>
        </div>
      `).join('');

      return `<div class="day-slot-section">
        <div class="day-slot-label">${slot.label}</div>
        ${chips}
      </div>`;
    }).join('');

    const pickerOpen = activeDayPicker === day;
    const pickerSearch = pickerOpen ? `
      <div class="day-picker-toolbar">
        <label for="picker-slot-${day}">Eintragen als</label>
        <select class="day-picker-slot" id="picker-slot-${day}" data-day-picker-slot="${day}">
          ${renderMealSlotOptions(activeDayPickerSlot)}
        </select>
      </div>
      <input class="day-picker-search" type="text" placeholder="Suchen …" id="picker-search-${day}" data-day-picker-search="${day}" role="combobox" aria-expanded="true" aria-controls="picker-list-${day}" aria-autocomplete="list">
    ` : '';

    return `
      <div class="day-column" data-day-column="${day}">
        <div class="day-name">${day}</div>
        ${slotSections || '<div class="day-empty">Noch nichts geplant</div>'}
        <div class="day-add-wrapper">
          <button type="button" class="day-add-btn" data-action="toggle-day-picker" data-day="${day}" aria-expanded="${String(pickerOpen)}" aria-controls="picker-${day}">+ Rezept</button>
          <div class="day-picker ${pickerOpen ? 'open' : ''}" id="picker-${day}" ${pickerOpen ? 'role="dialog" aria-modal="false"' : ''}>
            ${pickerSearch}
            <div id="picker-list-${day}" role="listbox">${pickerOpen ? renderDayPickerItems({ day, recipes, activeDayPickerSlot }) : ''}</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

export function buildShoppingListText({ weekPlan, recipes }) {
  const ingredientMap = {};
  const allEntries = DAYS.flatMap((day) => weekPlan[day] || []);

  allEntries.forEach((entry) => {
    const recipe = recipes.find((item) => item.id === String(entry.recipeId));
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
