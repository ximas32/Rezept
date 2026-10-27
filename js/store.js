/* Datenzugriff auf Firestore + In-Memory-Cache für die Suche.
   Alle Rezepte werden einmal abonniert (onSnapshot) und danach lokal
   gefiltert – das ist für ein privates Kochbuch schnell und spart Lesezugriffe. */
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, updateDoc,
  serverTimestamp, writeBatch, getDoc
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { db } from './firebase.js';
import { buildSearchTerms, toExportObject } from './schema.js';
import { norm } from './util.js';

const RECIPES = 'recipes';
const SHOPPING_DOC = ['shopping', 'shared'];

export const state = {
  recipes: [],
  loaded: false,
  shopping: { items: [] },
  user: null
};

const listeners = new Set();
let unsubRecipes = null;
let unsubShopping = null;

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(state); } catch (err) { console.error(err); }
  });
}

export function startSync(user) {
  state.user = user;
  stopSync();
  if (!user || !db) return;

  unsubRecipes = onSnapshot(
    collection(db, RECIPES),
    (snap) => {
      state.recipes = snap.docs
        .map((d) => ({ ...d.data(), id: d.id }))
        .sort((a, b) => (a.title || '').localeCompare(b.title || '', 'de'));
      state.loaded = true;
      emit();
    },
    (err) => {
      console.error('Firestore-Fehler:', err);
      state.loaded = true;
      state.error = err.code === 'permission-denied'
        ? 'Keine Berechtigung. Steht deine E-Mail in den Firestore-Regeln?'
        : err.message;
      emit();
    }
  );

  unsubShopping = onSnapshot(
    doc(db, ...SHOPPING_DOC),
    (snap) => {
      state.shopping = snap.exists() ? { items: [], ...snap.data() } : { items: [] };
      emit();
    },
    () => {}
  );
}

export function stopSync() {
  if (unsubRecipes) unsubRecipes();
  if (unsubShopping) unsubShopping();
  unsubRecipes = unsubShopping = null;
  state.recipes = [];
  state.loaded = false;
  state.shopping = { items: [] };
}

export function getRecipe(id) {
  return state.recipes.find((r) => r.id === id) || null;
}

export async function fetchRecipe(id) {
  const local = getRecipe(id);
  if (local) return local;
  const snap = await getDoc(doc(db, RECIPES, id));
  return snap.exists() ? { ...snap.data(), id: snap.id } : null;
}

export async function saveRecipe(recipe) {
  const data = {
    ...toExportObject(recipe),
    searchTerms: buildSearchTerms(recipe),
    updatedAt: serverTimestamp(),
    updatedBy: state.user?.email || '',
    createdAt: recipe.createdAt || serverTimestamp(),
    createdBy: recipe.createdBy || state.user?.email || ''
  };
  delete data.id;
  await setDoc(doc(db, RECIPES, recipe.id), data, { merge: false });
  return recipe.id;
}

export async function saveMany(recipes) {
  const batch = writeBatch(db);
  for (const recipe of recipes) {
    const data = {
      ...toExportObject(recipe),
      searchTerms: buildSearchTerms(recipe),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: state.user?.email || ''
    };
    delete data.id;
    batch.set(doc(db, RECIPES, recipe.id), data);
  }
  await batch.commit();
}

export async function deleteRecipe(id) {
  await deleteDoc(doc(db, RECIPES, id));
}

export async function patchRecipe(id, patch) {
  await updateDoc(doc(db, RECIPES, id), { ...patch, updatedAt: serverTimestamp() });
}

/* ---------------- Einkaufsliste ---------------- */

export async function saveShopping(items) {
  await setDoc(doc(db, ...SHOPPING_DOC), {
    items,
    updatedAt: serverTimestamp(),
    updatedBy: state.user?.email || ''
  });
}

/* ---------------- Suche & Filter ---------------- */

/**
 * @param {object} opts
 * @param {string} opts.text        Freitext (Titel, Zutaten, Tags)
 * @param {string} opts.category    Kategorie-ID oder '' für alle
 * @param {string[]} opts.ingredients  Zutatenliste – Rezept muss alle enthalten
 * @param {boolean} opts.onlyFavorites
 * @param {number} opts.maxMinutes  0 = egal
 * @param {string} opts.sort        'title' | 'new' | 'rating' | 'time'
 */
export function searchRecipes(opts = {}) {
  const {
    text = '', category = '', ingredients = [],
    onlyFavorites = false, maxMinutes = 0, sort = 'title'
  } = opts;

  const words = norm(text).split(' ').filter(Boolean);
  const wanted = ingredients.map(norm).filter(Boolean);

  let list = state.recipes.filter((recipe) => {
    if (category && recipe.category !== category) return false;
    if (onlyFavorites && !recipe.favorite) return false;
    const total = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
    if (maxMinutes && total > maxMinutes) return false;

    const haystack = (recipe.searchTerms && recipe.searchTerms.length)
      ? recipe.searchTerms.join(' ')
      : norm(`${recipe.title} ${(recipe.ingredients || []).map((i) => i.name).join(' ')} ${(recipe.tags || []).join(' ')}`);

    if (words.length && !words.every((w) => haystack.includes(w))) return false;
    if (wanted.length && !wanted.every((w) => haystack.includes(w))) return false;
    return true;
  });

  const sorters = {
    title: (a, b) => (a.title || '').localeCompare(b.title || '', 'de'),
    new: (a, b) => (toMillis(b.createdAt) - toMillis(a.createdAt)) || (a.title || '').localeCompare(b.title || '', 'de'),
    rating: (a, b) => (b.rating || 0) - (a.rating || 0) || (a.title || '').localeCompare(b.title || '', 'de'),
    time: (a, b) => ((a.prepMinutes || 0) + (a.cookMinutes || 0)) - ((b.prepMinutes || 0) + (b.cookMinutes || 0))
  };
  list = list.slice().sort(sorters[sort] || sorters.title);
  return list;
}

function toMillis(value) {
  if (!value) return 0;
  if (value.toMillis) return value.toMillis();
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

/** Alle in Rezepten vorkommenden Zutatennamen, für Autovervollständigung. */
export function allIngredientNames() {
  const map = new Map();
  for (const recipe of state.recipes) {
    for (const ing of recipe.ingredients || []) {
      const key = norm(ing.name);
      if (key && !map.has(key)) map.set(key, ing.name.trim());
    }
  }
  return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'de'));
}

export function allTags() {
  const set = new Set();
  state.recipes.forEach((r) => (r.tags || []).forEach((t) => set.add(t)));
  return Array.from(set).sort((a, b) => a.localeCompare(b, 'de'));
}
