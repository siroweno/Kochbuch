import { MEAL_SLOTS } from './constants.js';

export function isValidMealSlot(slot) {
  return MEAL_SLOTS.some((item) => item.id === slot);
}

export function getMealSlotLabel(slot, short = false) {
  const match = MEAL_SLOTS.find((item) => item.id === slot) || MEAL_SLOTS[2];
  return short ? match.short : match.label;
}

export function renderMealSlotOptions(selected, compact = false) {
  return MEAL_SLOTS.map(
    (slot) => `<option value="${slot.id}"${slot.id === selected ? ' selected' : ''}>${compact ? slot.short : slot.label}</option>`,
  ).join('');
}
