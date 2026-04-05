export function normalizeTagForSearch(tag) {
  return tag.toLowerCase()
    .replace(/ue/g, '\u00FC').replace(/ae/g, '\u00E4').replace(/oe/g, '\u00F6')
    .replace(/\u00FC/g, 'u').replace(/\u00E4/g, 'a').replace(/\u00F6/g, 'o')
    .replace(/ss/g, 's')
    .trim();
}

export function normalizeMultilineText(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.replace(/\s+$/g, ''))
    .join('\n')
    .trim();
}

export function normalizeIngredientsSource(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === 'string') return item.trim();
        if (!item || typeof item !== 'object') return '';
        return [item.quantity, item.unit, item.name].filter(Boolean).join(' ').trim();
      })
      .filter(Boolean)
      .join('\n');
  }

  return String(value || '');
}

export function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value
      .map((tag) => String(tag || '').trim())
      .filter(Boolean);
  }

  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function normalizePositiveInteger(value, fallback = 2) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}
