import { QUANTITY_PATTERN, UNICODE_FRACTIONS, UNIT_ALIASES } from './constants.js';
import { normalizeMultilineText } from './normalize.js';

export function parseIngredient(line) {
  const value = String(line || '').trim();
  if (!value) return { quantity: null, unit: null, name: '' };

  const normalized = value
    .replace(/(\d)([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])/g, '$1 $2')
    .replace(/[¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]/g, (fraction) => UNICODE_FRACTIONS[fraction] || fraction)
    .replace(/\s+/g, ' ')
    .trim();

  const mixedFractionMatch = normalized.match(/^(\d+)\s+(\d+)\/(\d+)(?:\s+(.*)|$)/);
  if (mixedFractionMatch) {
    const [, whole, numerator, denominator, rest = ''] = mixedFractionMatch;
    const quantity = Number(whole) + (Number(numerator) / Number(denominator));
    const remainder = rest.trim();
    const unitMatch = remainder.match(/^([a-zäöü°]+)\b\s*(.*)$/i);
    return {
      quantity,
      unit: unitMatch ? (UNIT_ALIASES[unitMatch[1].toLowerCase()] || unitMatch[1].toLowerCase()) : null,
      name: (unitMatch ? unitMatch[2] : remainder).trim(),
    };
  }

  const fractionMatch = normalized.match(/^(\d+)\/(\d+)(?:\s+(.*)|$)/);
  if (fractionMatch) {
    const [, numerator, denominator, rest = ''] = fractionMatch;
    const quantity = Number(numerator) / Number(denominator);
    const remainder = rest.trim();
    const unitMatch = remainder.match(/^([a-zäöü°]+)\b\s*(.*)$/i);
    return {
      quantity,
      unit: unitMatch ? (UNIT_ALIASES[unitMatch[1].toLowerCase()] || unitMatch[1].toLowerCase()) : null,
      name: (unitMatch ? unitMatch[2] : remainder).trim(),
    };
  }

  const unicodeFractionMatch = normalized.match(/^(\d+)?\s*([¼½¾⅐⅑⅒⅓⅔⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞])(?:\s+(.*)|$)/);
  if (unicodeFractionMatch) {
    const [, whole = '0', fraction, rest = ''] = unicodeFractionMatch;
    const quantity = Number(whole) + Number.parseFloat(UNICODE_FRACTIONS[fraction] || '0');
    const remainder = rest.trim();
    const unitMatch = remainder.match(/^([a-zäöü°]+)\b\s*(.*)$/i);
    return {
      quantity,
      unit: unitMatch ? (UNIT_ALIASES[unitMatch[1].toLowerCase()] || unitMatch[1].toLowerCase()) : null,
      name: (unitMatch ? unitMatch[2] : remainder).trim(),
    };
  }

  const decimalMatch = normalized.match(QUANTITY_PATTERN);
  if (!decimalMatch) return { quantity: null, unit: null, name: value };

  let quantity = Number.parseFloat(decimalMatch[1].replace(',', '.'));
  let unit = decimalMatch[2].toLowerCase().trim();
  const name = normalized.substring(decimalMatch[0].length).trim();

  if (unit) unit = UNIT_ALIASES[unit] || unit;
  if (Number.isNaN(quantity)) quantity = null;

  return { quantity, unit: unit || null, name };
}

export function parseIngredientsText(value) {
  return normalizeMultilineText(value)
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => parseIngredient(line));
}

export function scaleIngredient(ingredient, fromServings, toServings) {
  if (ingredient.quantity === null || ingredient.quantity === undefined) {
    return ingredient.name;
  }

  const base = Number(fromServings) || 1;
  const next = Number(toServings) || base;
  let scaled = Math.round(ingredient.quantity * (next / base) * 10) / 10;
  if (scaled === Math.floor(scaled)) scaled = Math.floor(scaled);
  return `${scaled}${ingredient.unit ? ` ${ingredient.unit}` : ''} ${ingredient.name}`;
}
