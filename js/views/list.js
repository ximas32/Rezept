/* Übersicht aller Rezepte mit Suche nach Zutaten, Kategorie, Zeit usw. */
import { CATEGORIES } from '../config.js';
import { state, onChange, searchRecipes, allIngredientNames } from '../store.js';
import { categoryEmoji, categoryLabel } from '../schema.js';
import { perPortion } from '../nutrition.js';
import { $, $$, esc, debounce, fmtDuration, norm } from '../util.js';

/* Filter bleiben erhalten, wenn man ein Rezept öffnet und zurückgeht. */
const filter = {
  text: '',
  category: '',
  ingredients: [],
  onlyFavorites: false,
  maxMinutes: 0,
  sort: 'title',
  showFilters: false
};

export function render(root) {
  root.innerHTML = `
    <div class="searchbar">
      <input type="search" id="q" placeholder="Rezept, Zutat oder Tag suchen …"
             value="${esc(filter.text)}" enterkeyhint="search" autocomplete="off">
      <button class="clear" id="q-clear" title="Leeren" ${filter.text ? '' : 'hidden'}>✕</button>
    </div>

    <div class="chips" id="cat-chips"></div>

    <div style="display:flex;gap:.5rem;align-items:center;margin-bottom:.7rem;flex-wrap:wrap">
      <button class="btn btn-sm btn-ghost" id="toggle-filters">⚙️ Filter</button>
      <button class="btn btn-sm btn-ghost" id="toggle-ing">🥕 Zutatensuche</button>
      <span class="muted" id="count" style="margin-left:auto"></span>
    </div>

    <div id="ing-search" class="card card-tight ${filter.ingredients.length ? '' : 'hidden'}">
      <label for="ing-input">Was habt ihr da? (mehrere Zutaten möglich)</label>
      <div style="display:flex;gap:.4rem">
        <input type="text" id="ing-input" list="ing-datalist" placeholder="z. B. Basilikum" autocomplete="off">
        <button class="btn btn-sm" id="ing-add">+</button>
      </div>
      <datalist id="ing-datalist"></datalist>
      <div class="chips" id="ing-chips" style="margin-top:.6rem;margin-bottom:0"></div>
    </div>

    <div id="filters" class="card card-tight ${filter.showFilters ? '' : 'hidden'}">
      <div class="row">
        <label>Sortierung
          <select id="f-sort">
            <option value="title">Alphabetisch</option>
            <option value="new">Neueste zuerst</option>
            <option value="rating">Beste Bewertung</option>
            <option value="time">Schnellste zuerst</option>
          </select>
        </label>
        <label>Max. Dauer
          <select id="f-time">
            <option value="0">egal</option>
            <option value="20">bis 20 Min</option>
            <option value="30">bis 30 Min</option>
            <option value="45">bis 45 Min</option>
            <option value="60">bis 60 Min</option>
          </select>
        </label>
      </div>
      <label style="display:flex;align-items:center;gap:.5rem;margin-top:.4rem">
        <input type="checkbox" id="f-fav" style="width:auto" ${filter.onlyFavorites ? 'checked' : ''}>
        Nur Favoriten ⭐
      </label>
    </div>

    <div id="results"></div>
  `;

  // Kategorie-Chips
  const chips = $('#cat-chips', root);
  chips.innerHTML = [{ id: '', label: 'Alle', emoji: '🍽️' }, ...CATEGORIES]
    .map((c) => `<button class="chip ${filter.category === c.id ? 'active' : ''}" data-cat="${esc(c.id)}">${c.emoji} ${esc(c.label)}</button>`)
    .join('');
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-cat]');
    if (!btn) return;
    filter.category = btn.dataset.cat;
    $$('.chip', chips).forEach((c) => c.classList.toggle('active', c.dataset.cat === filter.category));
    update();
  });

  $('#f-sort', root).value = filter.sort;
  $('#f-time', root).value = String(filter.maxMinutes);

  const q = $('#q', root);
  q.addEventListener('input', debounce(() => {
    filter.text = q.value;
    $('#q-clear', root).hidden = !filter.text;
    update();
  }, 180));
  $('#q-clear', root).addEventListener('click', () => {
    q.value = '';
    filter.text = '';
    $('#q-clear', root).hidden = true;
    update();
    q.focus();
  });

  $('#toggle-filters', root).addEventListener('click', () => {
    filter.showFilters = !filter.showFilters;
    $('#filters', root).classList.toggle('hidden', !filter.showFilters);
  });
  $('#toggle-ing', root).addEventListener('click', () => {
    $('#ing-search', root).classList.toggle('hidden');
    if (!$('#ing-search', root).classList.contains('hidden')) $('#ing-input', root).focus();
  });

  $('#f-sort', root).addEventListener('change', (e) => { filter.sort = e.target.value; update(); });
  $('#f-time', root).addEventListener('change', (e) => { filter.maxMinutes = Number(e.target.value); update(); });
  $('#f-fav', root).addEventListener('change', (e) => { filter.onlyFavorites = e.target.checked; update(); });

  const addIngredient = () => {
    const input = $('#ing-input', root);
    const value = input.value.trim();
    if (!value) return;
    if (!filter.ingredients.some((i) => norm(i) === norm(value))) filter.ingredients.push(value);
    input.value = '';
    renderIngChips();
    update();
  };
  $('#ing-add', root).addEventListener('click', addIngredient);
  $('#ing-input', root).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addIngredient(); }
  });
  $('#ing-chips', root).addEventListener('click', (e) => {
    const btn = e.target.closest('[data-rm]');
    if (!btn) return;
    filter.ingredients.splice(Number(btn.dataset.rm), 1);
    renderIngChips();
    update();
  });

  function renderIngChips() {
    $('#ing-chips', root).innerHTML = filter.ingredients
      .map((name, i) => `<button class="chip active" data-rm="${i}">${esc(name)} ✕</button>`)
      .join('');
  }

  function renderDatalist() {
    $('#ing-datalist', root).innerHTML = allIngredientNames()
      .map((n) => `<option value="${esc(n)}">`).join('');
  }

  function update() {
    const list = searchRecipes(filter);
    const box = $('#results', root);
    $('#count', root).textContent = state.loaded
      ? `${list.length} von ${state.recipes.length}`
      : '';

    if (!state.loaded) {
      box.innerHTML = '<div class="empty"><span class="spinner"></span><p>Rezepte werden geladen …</p></div>';
      return;
    }
    if (state.error) {
      box.innerHTML = `<div class="empty"><span class="big">⚠️</span>${esc(state.error)}</div>`;
      return;
    }
    if (!state.recipes.length) {
      box.innerHTML = `<div class="empty">
        <span class="big">📖</span>
        <p>Noch keine Rezepte.</p>
        <p><a class="btn btn-primary" href="#/neu">Erstes Rezept erstellen</a></p>
        <p class="muted">Oder per <a href="#/import">KI-Import</a> ein Rezept von einem Foto übernehmen.</p>
      </div>`;
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="empty"><span class="big">🔍</span><p>Nichts gefunden. Andere Suche oder Filter probieren.</p></div>';
      return;
    }

    box.innerHTML = `<div class="recipe-list">${list.map(card).join('')}</div>`;
  }

  function card(recipe) {
    const time = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
    const meta = [
      `${categoryEmoji(recipe.category)} ${categoryLabel(recipe.category)}`,
      time ? `⏱ ${fmtDuration(time)}` : '',
      recipe.servings ? `🍽 ${recipe.servings}` : '',
      recipe.rating ? '⭐'.repeat(recipe.rating) : ''
    ].filter(Boolean);
    const perServing = perPortion(recipe).kcal;
    const kcal = perServing ? `🔥 ${Math.round(perServing)} kcal / Portion` : '';
    return `
      <a class="recipe-card" href="#/rezept/${encodeURIComponent(recipe.id)}">
        <div class="recipe-thumb">${recipe.image
          ? `<img src="${esc(recipe.image)}" alt="" loading="lazy">`
          : categoryEmoji(recipe.category)}</div>
        <div class="recipe-body">
          <p class="recipe-title">${recipe.favorite ? '⭐ ' : ''}${esc(recipe.title)}</p>
          <div class="recipe-meta">${meta.map(esc).join(' · ')}</div>
          ${kcal ? `<div class="recipe-meta">${kcal}</div>` : ''}
        </div>
      </a>`;
  }

  renderIngChips();
  renderDatalist();
  update();

  const off = onChange(() => { renderDatalist(); update(); });
  return () => off();
}
