export function isValidDateString(value) {
  return Boolean(value) && !Number.isNaN(new Date(value).getTime());
}

function parseGermanDate(value) {
  const match = String(value || '').trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function toIsoTimestamp(value, fallback = new Date()) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  if (isValidDateString(value)) {
    return new Date(value).toISOString();
  }

  const germanDate = parseGermanDate(value);
  if (germanDate) {
    return germanDate.toISOString();
  }

  return fallback.toISOString();
}

export function formatDateLabel(value) {
  if (!value) return '';
  const timestamp = isValidDateString(value) ? new Date(value) : parseGermanDate(value);
  if (!timestamp) return '';
  return timestamp.toLocaleDateString('de-DE');
}

export function isSameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}
