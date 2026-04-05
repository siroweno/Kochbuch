export const DAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const SERVING_OPTIONS = [1, 2, 3, 4, 5, 6, 8, 10, 12];
export const EXPORT_SCHEMA_VERSION = 4;
export const LEGACY_EXPORT_SCHEMA_VERSION = 2;

export const RECIPE_CATEGORIES = [
  { id: 'hauptgericht', label: 'Hauptgericht', icon: '\u{1F37D}' },
  { id: 'vorspeise', label: 'Vorspeise', icon: '\u{1F957}' },
  { id: 'nachspeise', label: 'Nachspeise', icon: '\u{1F370}' },
  { id: 'fruehstueck', label: 'Frühstück', icon: '\u2600' },
  { id: 'snack', label: 'Snack', icon: '\u{1F968}' },
  { id: 'getraenk', label: 'Getränk', icon: '\u{1F375}' },
  { id: 'beilage', label: 'Beilage', icon: '\u{1F96C}' },
  { id: 'sauce', label: 'Sauce & Dip', icon: '\u{1FAD9}' },
];

export const MEAL_SLOTS = [
  { id: 'fruehstueck', label: 'Frühstück', short: 'Früh' },
  { id: 'mittag', label: 'Mittag', short: 'Mittag' },
  { id: 'abend', label: 'Abend', short: 'Abend' },
  { id: 'snack', label: 'Snack', short: 'Snack' },
];

export const QUANTITY_PATTERN = /^([\d.,]+)\s*([a-zäöü°\/]*)/i;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const UNICODE_FRACTIONS = {
  '\u00BC': '1/4',
  '\u00BD': '1/2',
  '\u00BE': '3/4',
  '\u2150': '1/7',
  '\u2151': '1/9',
  '\u2152': '1/10',
  '\u2153': '1/3',
  '\u2154': '2/3',
  '\u2155': '1/5',
  '\u2156': '2/5',
  '\u2157': '3/5',
  '\u2158': '4/5',
  '\u2159': '1/6',
  '\u215A': '5/6',
  '\u215B': '1/8',
  '\u215C': '3/8',
  '\u215D': '5/8',
  '\u215E': '7/8',
};

export const UNIT_ALIASES = {
  g: 'g',
  gramm: 'g',
  kg: 'kg',
  kilo: 'kg',
  ml: 'ml',
  milliliter: 'ml',
  l: 'l',
  liter: 'l',
  el: 'el',
  'eßlöffel': 'el',
  esslöffel: 'el',
  tl: 'tl',
  teelöffel: 'tl',
  stück: 'stück',
  st: 'stück',
  stk: 'stück',
  piece: 'stück',
  prise: 'prise',
  pck: 'pck',
  packung: 'pck',
  dose: 'dose',
  tasse: 'tasse',
  schale: 'schale',
  becher: 'becher',
  blatt: 'blatt',
  zweig: 'zweig',
  zehe: 'zehe',
  splitter: 'splitter',
};
