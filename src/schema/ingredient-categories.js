const CATEGORIES = [
  { id: 'produce', label: 'Obst & Gemüse', icon: '🥬' },
  { id: 'herbs', label: 'Frische Kräuter', icon: '🌿' },
  { id: 'meat', label: 'Fleisch & Fisch', icon: '🥩' },
  { id: 'dairy', label: 'Milchprodukte & Eier', icon: '🧀' },
  { id: 'bakery', label: 'Brot & Backwaren', icon: '🍞' },
  { id: 'pantry', label: 'Vorrat & Konserven', icon: '🫙' },
  { id: 'spices', label: 'Gewürze & Würzmittel', icon: '🧂' },
  { id: 'frozen', label: 'Tiefkühl', icon: '❄️' },
  { id: 'other', label: 'Sonstiges', icon: '🛒' },
];

const KEYWORD_TO_CATEGORY = {};

const CATEGORY_KEYWORDS = {
  produce: [
    'zwiebel', 'knoblauch', 'paprika', 'tomate', 'kartoffel', 'karotte', 'möhre',
    'zucchini', 'aubergine', 'brokkoli', 'blumenkohl', 'lauch', 'sellerie', 'fenchel',
    'champignon', 'pilz', 'salat', 'gurke', 'avocado', 'zitrone', 'limette', 'orange',
    'apfel', 'birne', 'banane', 'mango', 'ananas', 'beere', 'erdbeere', 'himbeere',
    'süßkartoffel', 'suesskartoffel', 'spinat', 'mangold', 'kürbis', 'kuerbis',
    'rote bete', 'radieschen', 'frühlingszwiebel', 'fruehlingszwiebel', 'schalotte',
    'ingwer', 'chili', 'peperoni', 'mais', 'erbse', 'bohne', 'linse', 'kichererbse',
    'edamame', 'granatapfel', 'rhabarber', 'spargel', 'kohlrabi', 'grünkohl',
    'pak choi', 'wirsing', 'rotkohl', 'weißkohl', 'chinakohl', 'rucola', 'feldsalat',
    'stangensellerie', 'gemüse', 'gemuese', 'obst', 'frucht',
  ],
  herbs: [
    'petersilie', 'basilikum', 'koriander', 'minze', 'thymian', 'rosmarin',
    'schnittlauch', 'dill', 'oregano', 'salbei', 'estragon', 'lorbeer', 'majoran',
    'bärlauch', 'baerlauch', 'kresse', 'liebstöckel', 'liebstoeckel', 'zitronengras',
    'kräuter', 'kraeuter',
  ],
  meat: [
    'guanciale', 'pancetta', 'speck', 'bacon', 'hähnchen', 'haehnchen', 'huhn',
    'hühnchen', 'huehnchen', 'rind', 'schwein', 'lamm', 'kalb', 'hack', 'hackfleisch',
    'wurst', 'schinken', 'salami', 'chorizo', 'lachs', 'thunfisch', 'garnele', 'shrimp',
    'krabbe', 'muschel', 'tintenfisch', 'calamari', 'fisch', 'filet', 'steak', 'braten',
    'fleisch', 'würstchen', 'wuerstchen', 'entenbrust', 'ente', 'pute', 'truthahn',
    'leber', 'niere', 'suppenfleisch', 'kotelett', 'schnitzel', 'gyros', 'döner',
    'pulled pork', 'spareribs', 'rippchen',
  ],
  dairy: [
    'ei', 'eigelb', 'eier', 'eiweiß', 'eiweiss', 'butter', 'milch', 'sahne',
    'schlagsahne', 'joghurt', 'quark', 'käse', 'kaese', 'parmesan', 'pecorino',
    'mozzarella', 'feta', 'ricotta', 'mascarpone', 'crème fraîche', 'creme fraiche',
    'schmand', 'frischkäse', 'frischkaese', 'burrata', 'gouda', 'emmentaler',
    'gruyère', 'gruyere', 'cheddar', 'halloumi', 'sauerrahm', 'buttermilch',
    'kondensmilch', 'kaffeesahne', 'schmelzkäse', 'schmelzkaese',
  ],
  bakery: [
    'brot', 'brötchen', 'broetchen', 'toast', 'hefe', 'backpulver', 'tortilla',
    'fladenbrot', 'ciabatta', 'baguette', 'naan', 'pita', 'pizzateig', 'blätterteig',
    'blaetterteig', 'mürbeteig', 'muerbeteig', 'croissant', 'semmel',
  ],
  pantry: [
    'spaghetti', 'pasta', 'nudel', 'penne', 'fusilli', 'tagliatelle', 'linguine',
    'reis', 'risotto', 'basmati', 'jasmin', 'couscous', 'bulgur', 'quinoa', 'polenta',
    'mehl', 'grieß', 'griess', 'stärke', 'staerke', 'speisestärke', 'speisestaerke',
    'olivenöl', 'olivenoel', 'öl', 'oel', 'sonnenblumenöl', 'rapsöl', 'kokosöl',
    'essig', 'balsamico', 'weißweinessig', 'rotweinessig', 'apfelessig',
    'sojasauce', 'soja', 'tomatenmark', 'kokosmilch', 'dose', 'konserve',
    'passata', 'senf', 'honig', 'ahornsirup', 'zucker', 'rohrzucker', 'puderzucker',
    'erdnussbutter', 'tahini', 'sesamöl', 'sesamoel', 'fischsauce',
    'brühe', 'bruehe', 'bouillon', 'fond',
    'nuss', 'nüsse', 'nuesse', 'mandel', 'erdnuss', 'walnuss', 'haselnuss',
    'cashew', 'pistazie', 'sesam', 'pinienkern', 'sonnenblumenkern', 'kürbiskern',
    'wein', 'weißwein', 'weisswein', 'rotwein', 'marsala', 'sherry', 'mirin', 'sake',
    'tomaten', 'dosentomaten', 'pelati',
    'paniermehl', 'semmelbrösel', 'semmelbroesel', 'haferflocken', 'müsli', 'muesli',
    'schokolade', 'kakao', 'backschokolade',
    'reisnudel', 'glasnudel', 'udon', 'soba', 'ramen',
  ],
  spices: [
    'salz', 'pfeffer', 'kreuzkümmel', 'kreuzküemmel', 'kreuzkuemmel',
    'kurkuma', 'paprikapulver', 'zimt', 'muskat', 'muskatnuss',
    'kümmel', 'kuemmel', 'koriandersamen', 'cayenne', 'chiliflocken', 'chilipulver',
    'currypulver', 'curry', 'garam masala', 'zatar', 'za\'atar', 'sumach', 'ras el hanout',
    'vanille', 'vanillezucker', 'vanilleextrakt',
    'sriracha', 'tabasco', 'worcestershire', 'sambal', 'harissa',
    'nelke', 'sternanis', 'anis', 'wacholder', 'kardamom', 'safran',
    'piment', 'fenchelsamen', 'senfkörner', 'senfkoerner',
    'gewürz', 'gewuerz', 'würze', 'wuerze', 'prise',
  ],
  frozen: [
    'tiefkühl', 'tiefkuehl', 'tk-', 'gefror', 'tiefgefroren',
  ],
};

// Build reverse lookup: keyword → category id
for (const [categoryId, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
  for (const keyword of keywords) {
    KEYWORD_TO_CATEGORY[keyword] = categoryId;
  }
}

export function categorizeIngredient(name) {
  const lower = (name || '').toLowerCase().trim();
  if (!lower) return 'other';

  // Exact match first
  if (KEYWORD_TO_CATEGORY[lower]) return KEYWORD_TO_CATEGORY[lower];

  // Substring match (e.g. "rote Paprika" contains "paprika")
  for (const [keyword, categoryId] of Object.entries(KEYWORD_TO_CATEGORY)) {
    if (lower.includes(keyword)) return categoryId;
  }

  return 'other';
}

export function getCategories() {
  return CATEGORIES;
}

export function getCategoryById(id) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}
