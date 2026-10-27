/* Einstiegspunkt: Router, Grundgerüst, Service Worker. */
import { initAuth } from './auth.js';
import { startSync, stopSync, state, onChange } from './store.js';
import { applyTheme } from './theme.js';
import { takePrefill } from './pending.js';
import { $, $$, toast } from './util.js';

import * as listView from './views/list.js';
import * as detailView from './views/detail.js';
import * as editView from './views/edit.js';
import * as importView from './views/import.js';
import * as shoppingView from './views/shopping.js';
import * as settingsView from './views/settings.js';

const ROUTES = [
  { re: /^\/?$|^\/rezepte$/, view: listView, title: 'Rezepte', tab: 'rezepte' },
  { re: /^\/rezept\/(.+)$/, view: detailView, title: 'Rezept', tab: 'rezepte', back: true, param: 'id' },
  { re: /^\/neu$/, view: editView, title: 'Rezept erstellen', tab: 'neu', back: true },
  { re: /^\/bearbeiten\/(.+)$/, view: editView, title: 'Rezept bearbeiten', tab: 'rezepte', back: true, param: 'id' },
  { re: /^\/import$/, view: importView, title: 'KI-Import', tab: 'import' },
  { re: /^\/einkauf$/, view: shoppingView, title: 'Einkaufsliste', tab: 'einkauf' },
  { re: /^\/einstellungen$/, view: settingsView, title: 'Einstellungen', tab: '', back: true }
];

let cleanup = null;
let signedIn = false;

function currentPath() {
  return decodeURI(location.hash.replace(/^#/, '')) || '/';
}

function route() {
  if (!signedIn) return;
  const path = currentPath();
  const match = ROUTES.map((r) => ({ r, m: path.match(r.re) })).find((x) => x.m);
  const { r, m } = match || { r: ROUTES[0], m: [] };

  const params = {};
  if (r.param && m[1]) params[r.param] = decodeURIComponent(m[1]);
  if (r.view === editView && !params.id) params.prefill = takePrefill();

  if (cleanup) { try { cleanup(); } catch (err) { console.error(err); } }
  const root = $('#view');
  root.innerHTML = '';
  window.scrollTo(0, 0);

  $('#topbar-title').textContent = r.title;
  $('#btn-back').hidden = !r.back;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === r.tab));

  cleanup = r.view.render(root, params) || null;

  // Titel in der Kopfzeile beim Detail durch den Rezeptnamen ersetzen
  if (r.view === detailView) {
    const recipe = state.recipes.find((x) => x.id === params.id);
    if (recipe) $('#topbar-title').textContent = recipe.title;
  }
}

function initShell() {
  $('#btn-back').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else location.hash = '#/rezepte';
  });

  $('#btn-settings').addEventListener('click', () => { location.hash = '#/einstellungen'; });

  $('#btn-random').addEventListener('click', () => {
    if (!state.recipes.length) return toast('Noch keine Rezepte da.');
    const pick = state.recipes[Math.floor(Math.random() * state.recipes.length)];
    location.hash = `#/rezept/${encodeURIComponent(pick.id)}`;
    toast(`Vorschlag: ${pick.title}`);
  });

  onChange(() => {
    const open = (state.shopping.items || []).filter((i) => !i.done).length;
    const badge = $('#cart-badge');
    badge.textContent = String(open);
    badge.classList.toggle('hidden', open === 0);
  });

  window.addEventListener('hashchange', route);
  window.addEventListener('online', () => toast('Wieder online – wird synchronisiert.'));
  window.addEventListener('offline', () => toast('Offline – Änderungen werden später gespeichert.'));
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('SW:', err));
  });
}

applyTheme();
initShell();
registerServiceWorker();

initAuth((user) => {
  signedIn = Boolean(user);
  if (user) {
    startSync(user);
    if (!location.hash) location.hash = '#/rezepte';
    route();
  } else {
    stopSync();
    if (cleanup) { cleanup(); cleanup = null; }
    $('#view').innerHTML = '';
  }
});
