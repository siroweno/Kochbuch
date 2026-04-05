import {
  createPlanEntryId,
  DAYS,
  getMealSlotLabel,
  isValidMealSlot,
  normalizePositiveInteger,
} from '../cookbook-schema.js';
import { getPlannerCandidates, renderDayPickerItems } from './planner-view.js';
import { findPlanEntryLocation, movePlanEntryWithinPlan } from './plan-operations.js';

export function createPlannerActions(deps) {
  const { state, dom, repository, plannerController, notifications, focusManager, dataController, updatePlannerShoppingList } = deps;

  function getActiveWeekPlan() {
    return state.plannerDraftWeekPlan || state.weekPlan;
  }

  function getTodayDayKey() {
    const mapping = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return mapping[new Date().getDay()] || 'Mo';
  }

  function resetPlannerDraftState() {
    state.plannerDraftWeekPlan = null;
    state.dragState = null;
    state.activeMoveEntryId = null;
    state.moveEntryDraftDay = null;
    state.moveEntryDraftSlot = state.lastPlannerSlot || 'abend';
  }

  function setPlannerOpen(open) {
    state.plannerOpen = open;
    dom.weekPlanner.style.display = open ? 'block' : 'none';
    dom.weekPlanner.toggleAttribute('hidden', !open);
    dom.togglePlannerBtn.setAttribute('aria-expanded', String(open));
  }

  function focusDayPickerSearch(day) {
    const input = document.getElementById(`picker-search-${day}`);
    if (input) {
      setTimeout(() => input.focus(), 50);
    }
  }

  function toggleDayPicker(day) {
    if (state.activeDayPicker === day) {
      focusManager.setPendingFocusTarget({ type: 'day-picker-trigger', day });
      state.activeDayPicker = null;
    } else {
      state.activeDayPicker = day;
      state.activeDayPickerSlot = state.lastPlannerSlot || 'abend';
      state.activeDayPickerQuery = '';
    }

    plannerController.render();
    if (state.activeDayPicker) {
      focusDayPickerSearch(day);
    }
  }

  function filterDayPicker(day, query) {
    const list = document.getElementById(`picker-list-${day}`);
    const status = document.getElementById(`picker-status-${day}`);
    const normalizedQuery = String(query || '');
    const matches = getPlannerCandidates({
      recipes: state.recipes,
      query: normalizedQuery,
    });
    state.activeDayPickerQuery = normalizedQuery;
    if (!list) return;
    list.innerHTML = renderDayPickerItems({
      day,
      query: normalizedQuery,
      recipes: state.recipes,
      activeDayPickerSlot: state.activeDayPickerSlot,
    });
    if (status) {
      status.textContent = matches.length
        ? `${matches.length} Rezept${matches.length !== 1 ? 'e' : ''} für ${day} verfügbar.`
        : 'Keine passenden Rezepte gefunden.';
    }
  }

  async function persistWeekPlan() {
    const result = await repository.saveWeekPlan(state.weekPlan);
    dataController.applyLoadResult(result, { scope: 'planner' });
  }

  async function addToDay(day, recipeId, options = {}) {
    const recipe = state.recipeLookup.get(String(recipeId)) || state.recipes.find((item) => item.id === String(recipeId));
    if (!recipe) return;

    const previousWeekPlan = JSON.parse(JSON.stringify(state.weekPlan));

    state.weekPlan[day].push({
      planEntryId: createPlanEntryId(),
      recipeId: recipe.id,
      servings: normalizePositiveInteger(options.servings, recipe.baseServings),
      slot: isValidMealSlot(options.slot) ? options.slot : state.activeDayPickerSlot,
    });
    state.lastPlannerSlot = isValidMealSlot(options.slot) ? options.slot : state.activeDayPickerSlot;
    state.activeDayPicker = null;
    state.activeDayPickerQuery = '';
    plannerController.render();
    updatePlannerShoppingList();

    persistWeekPlan().catch(() => {
      state.weekPlan = previousWeekPlan;
      plannerController.render();
      updatePlannerShoppingList();
      notifications.error('Konnte nicht gespeichert werden.');
    });
  }

  function removeFromDay(planEntryId, fallbackDay, fallbackIndex) {
    const location = planEntryId ? findPlanEntryLocation(planEntryId, state.weekPlan) : null;
    const day = location?.day || fallbackDay;
    const index = location?.index ?? fallbackIndex;
    if (!day || !Number.isInteger(index) || !state.weekPlan[day]?.[index]) return;

    const previousWeekPlan = JSON.parse(JSON.stringify(state.weekPlan));
    state.weekPlan[day].splice(index, 1);
    plannerController.render();
    updatePlannerShoppingList();

    persistWeekPlan().catch(() => {
      state.weekPlan = previousWeekPlan;
      plannerController.render();
      updatePlannerShoppingList();
      notifications.error('Konnte nicht gespeichert werden.');
    });
  }

  async function updatePlanEntryServings(planEntryId, fallbackDay, fallbackIndex, servings) {
    const location = planEntryId ? findPlanEntryLocation(planEntryId, state.weekPlan) : null;
    const day = location?.day || fallbackDay;
    const index = location?.index ?? fallbackIndex;
    if (!state.weekPlan[day] || !state.weekPlan[day][index]) return;
    state.weekPlan[day][index].servings = normalizePositiveInteger(servings, state.weekPlan[day][index].servings);
    await persistWeekPlan();
  }

  async function updatePlanEntrySlot(planEntryId, fallbackDay, fallbackIndex, slot) {
    const location = planEntryId ? findPlanEntryLocation(planEntryId, state.weekPlan) : null;
    const day = location?.day || fallbackDay;
    const index = location?.index ?? fallbackIndex;
    if (!state.weekPlan[day] || !state.weekPlan[day][index] || !isValidMealSlot(slot)) return;
    state.weekPlan[day][index].slot = slot;
    state.lastPlannerSlot = slot;
    await persistWeekPlan();
  }

  function toggleMoveEntryComposer(planEntryId) {
    const location = findPlanEntryLocation(planEntryId, getActiveWeekPlan());
    if (!location) return;

    if (state.activeMoveEntryId === planEntryId) {
      state.activeMoveEntryId = null;
      state.moveEntryDraftDay = null;
      state.moveEntryDraftSlot = state.lastPlannerSlot || 'abend';
    } else {
      state.activeMoveEntryId = planEntryId;
      state.moveEntryDraftDay = location.day;
      state.moveEntryDraftSlot = location.entry.slot;
    }

    plannerController.render();
  }

  async function confirmMoveEntry(planEntryId) {
    if (!state.activeMoveEntryId || state.activeMoveEntryId !== planEntryId) return;
    const nextDay = DAYS.includes(state.moveEntryDraftDay) ? state.moveEntryDraftDay : getTodayDayKey();
    const nextSlot = isValidMealSlot(state.moveEntryDraftSlot) ? state.moveEntryDraftSlot : 'abend';
    state.weekPlan = movePlanEntryWithinPlan(state.weekPlan, planEntryId, {
      day: nextDay,
      slot: nextSlot,
    });
    state.lastPlannerSlot = nextSlot;
    state.activeMoveEntryId = null;
    focusManager.setPendingFocusTarget({ type: 'plan-entry', planEntryId, action: 'move-plan-entry' });
    deps.announceUi(`Eintrag nach ${nextDay} · ${getMealSlotLabel(nextSlot)} verschoben.`);
    await persistWeekPlan();
  }

  return {
    getActiveWeekPlan,
    getTodayDayKey,
    resetPlannerDraftState,
    setPlannerOpen,
    focusDayPickerSearch,
    toggleDayPicker,
    filterDayPicker,
    persistWeekPlan,
    addToDay,
    removeFromDay,
    updatePlanEntryServings,
    updatePlanEntrySlot,
    toggleMoveEntryComposer,
    confirmMoveEntry,
  };
}
