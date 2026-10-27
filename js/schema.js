/* Datenmodell eines Rezepts + Normalisierung.
   Alles, was von aussen kommt (KI-Import, JSON-Datei), läuft durch
   normalizeRecipe() – danach hat jedes Rezept garantiert dieselbe Form. */
import { CATEGORIES, DIFFICULTIES } from './config.js';
import { norm, parseAmount, uid } from './util.js';

export const SCHEMA_VERSION = 1;

const CATEGORY_IDS = CATEGORIES.map((c) => c.id);

/* Synonyme, die eine KI oder eine Website liefern könnte */
const CATEGORY_ALIASES = {
  nachspeise: 'dessert', nachtisch: 'dessert', suessspeise: 'dessert', dessert: 'dessert',
  kuchen: 'backen', gebaeck: 'backen', brot: 'backen', backware: 'backen', backen: 'backen',
  hauptgericht: 'hauptspeise', hauptspeise: 'hauptspeise', main: 'hauptspeise', mittagessen: 'hauptspeise',
  abendessen: 'hauptspeise', hauptgang: 'hauptspeise',
  vorspeise: 'vorspeise', starter: 'vorspeise', apero: 'vorspeise', salat: 'vorspeise', suppe: 'vorspeise',
  beilage: 'beilage', side: 'beilage',
  fruehstueck: 'fruehstueck', breakfast: 'fruehstueck', zmorge: 'fruehstueck', brunch: 'fruehstueck',
  snack: 'snack', zwischenmahlzeit: 'snack', zvieri: 'snack',
  getraenk: 'getraenk', drink: 'getraenk', cocktail: 'getraenk', smoothie: 'getraenk',
  sauce: 'sauce', sosse: 'sauce', dip: 'sauce', dressing: 'sauce', pesto: 'sauce',
  sonstiges: 'sonstiges', other: 'sonstiges'
};

export function mapCategory(value) {
  const key = norm(value).replace(/\s+/g, '');
  if (CATEGORY_IDS.includes(key)) return key;
  if (CATEGORY_ALIASES[key]) return CATEGORY_ALIASES[key];
  for (const [alias, id] of Object.entries(CATEGORY_ALIASES)) {
    if (key.includes(alias)) return id;
  }
  return 'hauptspeise';
}

export function categoryLabel(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat ? cat.label : 'Sonstiges';
}

export function categoryEmoji(id) {
  const cat = CATEGORIES.find((c) => c.id === id);
  return cat ? cat.emoji : '🍽️';
}

export function emptyRecipe() {
  return {
    id: uid(),
    schemaVersion: SCHEMA_VERSION,
    title: '',
    category: 'hauptspeise',
    tags: [],
    servings: 2,
    prepMinutes: 0,
    cookMinutes: 0,
    difficulty: 'einfach',
    source: '',
    description: '',
    notes: '',
    image: '',
    ingredients: [],
    steps: [],
    nutrition: { basis: 'portion', kcal: null, protein: null, carbs: null, fat: null, fiber: null },
    favorite: false,
    rating: 0,
    searchTerms: [],
    createdAt: null,
    updatedAt: null,
    createdBy: ''
  };
}

function num(value, fallback = null) {
  const n = parseAmount(value);
  return n === null ? fallback : n;
}

function str(value) {
  return typeof value === 'string' ? value.trim() : (value === null || value === undefined ? '' : String(value).trim());
}

function normalizeIngredient(raw) {
  if (typeof raw === 'string') {
    // Freitext "200 g Mehl" bestmöglich zerlegen
    const m = raw.trim().match(/^([\d.,/\s¼½¾⅓⅔⅛–-]+)?\s*([a-zA-ZäöüÄÖÜ.]+\.?)?\s+(.*)$/);
    if (m && num(m[1]) !== null) {
      return { amount: num(m[1]), unit: str(m[2]), name: str(m[3]), note: '', group: '' };
    }
    return { amount: null, unit: '', name: raw.trim(), note: '', group: '' };
  }
  const o = raw || {};
  return {
    amount: num(o.amount ?? o.menge ?? o.quantity, null),
    unit: str(o.unit ?? o.einheit).slice(0, 16),
    name: str(o.name ?? o.zutat ?? o.ingredient).slice(0, 120),
    note: str(o.note ?? o.notiz ?? o.hinweis).slice(0, 160),
    group: str(o.group ?? o.gruppe ?? o.section).slice(0, 60)
  };
}

function normalizeStep(raw) {
  if (typeof raw === 'string') return raw.trim();
  const o = raw || {};
  return str(o.text ?? o.step ?? o.schritt ?? o.description);
}

function normalizeNutrition(raw) {
  const o = raw || {};
  const basisRaw = norm(o.basis ?? o.per ?? o.bezug ?? 'portion');
  const basis = basisRaw.includes('gesamt') || basisRaw.includes('total') || basisRaw.includes('rezept')
    ? 'total' : 'portion';
  const pick = (...keys) => {
    for (const k of keys) {
      if (o[k] !== undefined && o[k] !== null && o[k] !== '') {
        const n = num(o[k]);
        if (n !== null) return Math.round(n * 10) / 10;
      }
    }
    return null;
  };
  return {
    basis,
    kcal: pick('kcal', 'calories', 'kalorien', 'energie'),
    protein: pick('protein', 'proteins', 'eiweiss', 'eiweiß'),
    carbs: pick('carbs', 'carbohydrates', 'kohlenhydrate', 'kh'),
    fat: pick('fat', 'fett'),
    fiber: pick('fiber', 'fibre', 'ballaststoffe')
  };
}

export function buildSearchTerms(recipe) {
  const parts = [
    recipe.title,
    recipe.category,
    categoryLabel(recipe.category),
    recipe.description,
    ...(recipe.tags || []),
    ...(recipe.ingredients || []).map((i) => `${i.name} ${i.note}`)
  ];
  const tokens = new Set();
  for (const part of parts) {
    for (const token of norm(part).split(' ')) {
      if (token.length > 1) tokens.add(token);
    }
  }
  return Array.from(tokens).slice(0, 220);
}

/** Beliebiges Objekt -> gültiges Rezept. Gibt Warnungen zurück. */
export function normalizeRecipe(raw, { keepId = false } = {}) {
  const warnings = [];
  const o = raw && typeof raw === 'object' ? raw : {};
  const base = emptyRecipe();

  const recipe = {
    ...base,
    id: keepId && str(o.id) ? str(o.id) : base.id,
    title: str(o.title ?? o.name ?? o.titel).slice(0, 140),
    category: mapCategory(o.category ?? o.kategorie),
    tags: Array.isArray(o.tags ?? o.schlagwoerter)
      ? (o.tags ?? o.schlagwoerter).map(str).filter(Boolean).slice(0, 15)
      : str(o.tags).split(',').map((t) => t.trim()).filter(Boolean).slice(0, 15),
    servings: Math.max(1, Math.round(num(o.servings ?? o.portionen ?? o.yield, 2) || 2)),
    prepMinutes: Math.max(0, Math.round(num(o.prepMinutes ?? o.vorbereitungszeit ?? o.prepTime, 0) || 0)),
    cookMinutes: Math.max(0, Math.round(num(o.cookMinutes ?? o.kochzeit ?? o.cookTime, 0) || 0)),
    difficulty: DIFFICULTIES.includes(norm(o.difficulty ?? o.schwierigkeit)) ? norm(o.difficulty ?? o.schwierigkeit) : 'einfach',
    source: str(o.source ?? o.quelle ?? o.url).slice(0, 400),
    description: str(o.description ?? o.beschreibung ?? o.kurzbeschreibung).slice(0, 600),
    notes: str(o.notes ?? o.notizen ?? o.tipps ?? o.tips).slice(0, 2000),
    image: typeof o.image === 'string' && o.image.startsWith('data:image') ? o.image : '',
    ingredients: (Array.isArray(o.ingredients ?? o.zutaten) ? (o.ingredients ?? o.zutaten) : [])
      .map(normalizeIngredient).filter((i) => i.name).slice(0, 120),
    steps: (Array.isArray(o.steps ?? o.schritte ?? o.zubereitung) ? (o.steps ?? o.schritte ?? o.zubereitung) : [])
      .map(normalizeStep).filter(Boolean).slice(0, 80),
    nutrition: normalizeNutrition(o.nutrition ?? o.naehrwerte ?? o.makros),
    favorite: Boolean(o.favorite ?? o.favorit),
    rating: Math.min(5, Math.max(0, Math.round(num(o.rating ?? o.bewertung, 0) || 0)))
  };

  if (!recipe.title) warnings.push('Kein Titel gefunden.');
  if (!recipe.ingredients.length) warnings.push('Keine Zutaten gefunden.');
  if (!recipe.steps.length) warnings.push('Keine Zubereitungsschritte gefunden.');
  if (!recipe.nutrition.kcal) warnings.push('Keine Nährwerte angegeben (kannst du später ergänzen).');

  recipe.searchTerms = buildSearchTerms(recipe);
  return { recipe, warnings };
}

export function validateRecipe(recipe) {
  const errors = [];
  if (!recipe.title || recipe.title.trim().length < 2) errors.push('Bitte einen Titel eingeben.');
  if (!recipe.ingredients.some((i) => i.name.trim())) errors.push('Mindestens eine Zutat eingeben.');
  if (!recipe.steps.some((s) => s.trim())) errors.push('Mindestens einen Zubereitungsschritt eingeben.');
  return errors;
}

/** Felder, die beim Export in eine Datei mit sollen. */
export function toExportObject(recipe) {
  const { searchTerms, createdAt, updatedAt, createdBy, ...rest } = recipe;
  return rest;
}

/** Nimmt JSON-Text und holt daraus eine Liste von Rohrezepten.
    Verkraftet: Objekt, Array, {recipes:[...]} und ```json-Codeblöcke. */
export function parseRecipeJson(text) {
  let cleaned = String(text || '').trim();
  const fence = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) cleaned = fence[1].trim();
  const start = cleaned.search(/[[{]/);
  if (start > 0) cleaned = cleaned.slice(start);
  const lastCurly = cleaned.lastIndexOf('}');
  const lastSquare = cleaned.lastIndexOf(']');
  const end = Math.max(lastCurly, lastSquare);
  if (end > -1) cleaned = cleaned.slice(0, end + 1);

  const data = JSON.parse(cleaned);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.recipes)) return data.recipes;
  if (Array.isArray(data.rezepte)) return data.rezepte;
  return [data];
}
