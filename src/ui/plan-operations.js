import { DAYS, isValidMealSlot, createEmptyWeekPlan } from '../cookbook-schema.js';

export function cloneWeekPlan(plan) {
  return JSON.parse(JSON.stringify(plan || createEmptyWeekPlan()));
}

export function findPlanEntryLocation(planEntryId, plan) {
  for (const day of DAYS) {
    const index = (plan[day] || []).findIndex((entry) => String(entry.planEntryId || '') === String(planEntryId));
    if (index !== -1) {
      return {
        day,
        index,
        entry: plan[day][index],
      };
    }
  }
  return null;
}

export function replaceDayEntries(plan, day, entries) {
  plan[day] = entries;
  return plan;
}

export function recomposeDayEntries(entriesBySlot) {
  return ['fruehstueck', 'mittag', 'abend', 'snack']
    .flatMap((slot) => entriesBySlot.get(slot) || []);
}

export function movePlanEntryWithinPlan(plan, planEntryId, { day: targetDay, slot: targetSlot, position = null }) {
  const nextPlan = cloneWeekPlan(plan);
  const source = findPlanEntryLocation(planEntryId, nextPlan);
  if (!source || !isValidMealSlot(targetSlot) || !DAYS.includes(targetDay)) {
    return nextPlan;
  }

  const movingEntry = { ...source.entry, slot: targetSlot };
  const sourceSlotEntries = (nextPlan[source.day] || []).filter((entry) => entry.slot === source.entry.slot);
  const sourceSlotIndex = sourceSlotEntries.findIndex((entry) => String(entry.planEntryId || '') === String(planEntryId));
  const sourceEntriesBySlot = new Map();
  const targetEntriesBySlot = source.day === targetDay ? sourceEntriesBySlot : new Map();

  ['fruehstueck', 'mittag', 'abend', 'snack'].forEach((slot) => {
    sourceEntriesBySlot.set(slot, (nextPlan[source.day] || []).filter((entry) => entry.slot === slot && entry.planEntryId !== planEntryId));
    if (source.day !== targetDay) {
      targetEntriesBySlot.set(slot, (nextPlan[targetDay] || []).filter((entry) => entry.slot === slot));
    }
  });

  const targetSlotEntries = [...(targetEntriesBySlot.get(targetSlot) || [])];
  let insertAt = Number.isInteger(position)
    ? Math.max(0, Math.min(position, targetSlotEntries.length))
    : targetSlotEntries.length;
  if (source.day === targetDay && source.entry.slot === targetSlot && sourceSlotIndex !== -1 && insertAt > sourceSlotIndex) {
    insertAt -= 1;
  }
  targetSlotEntries.splice(insertAt, 0, movingEntry);
  targetEntriesBySlot.set(targetSlot, targetSlotEntries);

  replaceDayEntries(nextPlan, source.day, recomposeDayEntries(sourceEntriesBySlot));
  replaceDayEntries(
    nextPlan,
    targetDay,
    source.day === targetDay
      ? recomposeDayEntries(targetEntriesBySlot)
      : recomposeDayEntries(targetEntriesBySlot),
  );

  return nextPlan;
}
