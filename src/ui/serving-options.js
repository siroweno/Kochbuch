import { SERVING_OPTIONS } from '../cookbook-schema.js';
import { normalizePositiveInteger } from '../cookbook-schema.js';

export function getServingOptionValues(selected) {
  const values = new Set(SERVING_OPTIONS);
  values.add(normalizePositiveInteger(selected, 2));
  return Array.from(values).sort((a, b) => a - b);
}

export function renderServingOptions(selected, formatLabel) {
  return getServingOptionValues(selected)
    .map((value) => `<option value="${value}"${value === Number(selected) ? ' selected' : ''}>${formatLabel(value)}</option>`)
    .join('');
}

export function renderPlannerServingOptions(selected) {
  return renderServingOptions(selected, (value) => `${value} P.`);
}

export function renderModalServingOptions(selected) {
  return renderServingOptions(selected, (value) => String(value));
}
