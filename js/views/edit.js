/* Rezept erstellen und bearbeiten. */
import { CATEGORIES, DIFFICULTIES, UNITS } from '../config.js';
import { getRecipe, saveRecipe, state, onChange, allIngredientNames } from '../store.js';
import { emptyRecipe, validateRecipe, normalizeRecipe } from '../schema.js';
import { fileToDataUrl, dataUrlBytes, formatBytes } from '../image.js';
import { $, $$, esc, parseAmount, fmtAmount, toast } from '../util.js';

export function render(root, params) {
  const isNew = !params.id;

  if (!isNew && !state.loaded) {
    root.innerHTML = '<div class="empty"><span class="spinner"></span><p>Lädt …</p></div>';
    const off = onChange(() => { if (state.loaded) { off(); render(root, params); } });
    return () => off();
  }

  const existing = isNew ? null : getRecipe(params.id);
  if (!isNew && !existing) {
    root.innerHTML = '<div class="empty"><span class="big">🤔</span><p>Rezept nicht gefunden.</p></div>';
    return () => {};
  }

  // Arbeitskopie – wird erst beim Speichern geschrieben.
  const draft = existing
    ? JSON.parse(JSON.stringify({ ...emptyRecipe(), ...existing }))
    : (params.prefill || emptyRecipe());
  if (!draft.ingredients.length) draft.ingredients = [{ amount: null, unit: '', name: '', note: '', group: '' }];
  if (!draft.steps.length) draft.steps = [''];
  draft.nutrition = draft.nutrition || { basis: 'portion' };

  root.innerHTML = `
    <form id="form" autocomplete="off">
      <div class="card">
        <div class="field">
          <label>Titel *</label>
          <input type="text" id="f-title" value="${esc(draft.title)}" placeholder="z. B. Pesto alla Genovese" required>
        </div>
        <div class="row">
          <div class="field">
            <label>Kategorie</label>
            <select id="f-category">
              ${CATEGORIES.map((c) => `<option value="${c.id}" ${draft.category === c.id ? 'selected' : ''}>${c.emoji} ${esc(c.label)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Schwierigkeit</label>
            <select id="f-difficulty">
              ${DIFFICULTIES.map((d) => `<option value="${d}" ${draft.difficulty === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
          </div>
        </div>
        <div class="row">
          <div class="field"><label>Portionen</label><input type="number" id="f-servings" min="1" max="99" value="${Number(draft.servings) || 2}"></div>
          <div class="field"><label>Vorbereitung (Min)</label><input type="number" id="f-prep" min="0" max="1440" value="${Number(draft.prepMinutes) || 0}"></div>
          <div class="field"><label>Kochzeit (Min)</label><input type="number" id="f-cook" min="0" max="1440" value="${Number(draft.cookMinutes) || 0}"></div>
        </div>
        <div class="field">
          <label>Kurzbeschreibung</label>
          <input type="text" id="f-description" value="${esc(draft.description)}" placeholder="Ein Satz dazu – optional">
        </div>
        <div class="field">
          <label>Tags (mit Komma trennen)</label>
          <input type="text" id="f-tags" value="${esc((draft.tags || []).join(', '))}" placeholder="vegetarisch, schnell, Sommer">
        </div>
      </div>

      <div class="card">
        <h3>Bild</h3>
        <div id="img-box">${imageHtml(draft.image)}</div>
        <input type="file" id="f-image" accept="image/*" style="display:none">
        <div style="display:flex;gap:.5rem">
          <button type="button" class="btn btn-sm" id="pick-img">📷 Bild wählen</button>
          <span class="sub" id="img-info" style="align-self:center"></span>
        </div>
        <p class="sub">Wird automatisch verkleinert und direkt in der Datenbank gespeichert.</p>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h3 style="margin:0">Zutaten *</h3>
          <button type="button" class="btn btn-sm btn-ghost" id="ing-mode">📝 Als Text</button>
        </div>
        <div id="ing-rows" style="margin-top:.6rem"></div>
        <textarea id="ing-text" class="hidden" placeholder="Pro Zeile eine Zutat, z. B.:&#10;200 g Mehl&#10;2 EL Olivenöl&#10;1 Zehe Knoblauch"></textarea>
        <button type="button" class="btn btn-sm btn-block" id="ing-add">+ Zutat</button>
        <datalist id="dl-units">${UNITS.map((u) => `<option value="${esc(u)}">`).join('')}</datalist>
        <datalist id="dl-ings"></datalist>
      </div>

      <div class="card">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <h3 style="margin:0">Zubereitung *</h3>
          <button type="button" class="btn btn-sm btn-ghost" id="step-mode">📝 Als Text</button>
        </div>
        <div id="step-rows" style="margin-top:.6rem"></div>
        <textarea id="step-text" class="hidden" placeholder="Pro Zeile ein Schritt."></textarea>
        <button type="button" class="btn btn-sm btn-block" id="step-add">+ Schritt</button>
      </div>

      <details class="acc" ${hasAnyNutrition(draft) ? 'open' : ''}>
        <summary>Nährwerte / Makros (optional)</summary>
        <div class="field" style="margin-top:.7rem">
          <label>Angaben gelten für</label>
          <select id="n-basis">
            <option value="portion" ${draft.nutrition.basis !== 'total' ? 'selected' : ''}>eine Portion</option>
            <option value="total" ${draft.nutrition.basis === 'total' ? 'selected' : ''}>das ganze Rezept</option>
          </select>
        </div>
        <div class="row">
          <div class="field"><label>kcal</label><input type="number" id="n-kcal" min="0" step="1" value="${numVal(draft.nutrition.kcal)}"></div>
          <div class="field"><label>Eiweiss (g)</label><input type="number" id="n-protein" min="0" step="0.1" value="${numVal(draft.nutrition.protein)}"></div>
        </div>
        <div class="row">
          <div class="field"><label>Kohlenhydrate (g)</label><input type="number" id="n-carbs" min="0" step="0.1" value="${numVal(draft.nutrition.carbs)}"></div>
          <div class="field"><label>Fett (g)</label><input type="number" id="n-fat" min="0" step="0.1" value="${numVal(draft.nutrition.fat)}"></div>
        </div>
        <div class="field"><label>Ballaststoffe (g)</label><input type="number" id="n-fiber" min="0" step="0.1" value="${numVal(draft.nutrition.fiber)}"></div>
        <p class="sub">Leer lassen ist ok. Die KI im Import kann die Werte schätzen.</p>
      </details>

      <details class="acc">
        <summary>Notizen & Quelle</summary>
        <div class="field" style="margin-top:.7rem">
          <label>Notizen, Tipps, Variationen</label>
          <textarea id="f-notes">${esc(draft.notes)}</textarea>
        </div>
        <div class="field">
          <label>Quelle (Link oder Buch)</label>
          <input type="text" id="f-source" value="${esc(draft.source)}">
        </div>
      </details>

      <p class="error hidden" id="form-error"></p>

      <div class="sticky-save">
        <button type="button" class="btn" id="cancel">Abbrechen</button>
        <button type="submit" class="btn btn-primary" id="save">💾 Speichern</button>
      </div>
    </form>
  `;

  /* ---------- Zutaten ---------- */
  const ingRows = $('#ing-rows', root);

  function ingRowHtml(ing, i) {
    const open = Boolean(ing.note || ing.group);
    return `
      <div class="ing-item" data-i="${i}">
        <div class="ing-row">
          <input class="amount" type="text" inputmode="decimal" placeholder="200" value="${esc(ing.amount === null || ing.amount === undefined ? '' : fmtAmount(ing.amount))}">
          <input class="unit" type="text" list="dl-units" placeholder="g" value="${esc(ing.unit)}">
          <input class="name" type="text" list="dl-ings" placeholder="Zutat" value="${esc(ing.name)}">
          <button type="button" class="del-btn" data-more="${i}" title="Hinweis & Gruppe">⋯</button>
          <button type="button" class="del-btn" data-del="${i}" title="Zeile löschen">✕</button>
        </div>
        <div class="ing-extra ${open ? '' : 'hidden'}" data-extra="${i}">
          <input class="note" type="text" placeholder="Hinweis, z. B. fein gehackt" value="${esc(ing.note)}">
          <input class="group" type="text" placeholder="Gruppe, z. B. Teig" value="${esc(ing.group)}">
        </div>
      </div>`;
  }

  function drawIngs() {
    ingRows.innerHTML = draft.ingredients.map(ingRowHtml).join('');
  }

  ingRows.addEventListener('input', (e) => {
    const item = e.target.closest('.ing-item');
    if (!item) return;
    const ing = draft.ingredients[Number(item.dataset.i)];
    if (!ing) return;
    if (e.target.classList.contains('amount')) ing.amount = parseAmount(e.target.value);
    if (e.target.classList.contains('unit')) ing.unit = e.target.value;
    if (e.target.classList.contains('name')) ing.name = e.target.value;
    if (e.target.classList.contains('note')) ing.note = e.target.value;
    if (e.target.classList.contains('group')) ing.group = e.target.value;
  });

  ingRows.addEventListener('click', (e) => {
    const more = e.target.closest('[data-more]');
    if (more) {
      const extra = ingRows.querySelector(`[data-extra="${more.dataset.more}"]`);
      extra.classList.toggle('hidden');
      if (!extra.classList.contains('hidden')) extra.querySelector('input').focus();
      return;
    }
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    draft.ingredients.splice(Number(btn.dataset.del), 1);
    if (!draft.ingredients.length) draft.ingredients.push({ amount: null, unit: '', name: '', note: '', group: '' });
    drawIngs();
  });

  // Mehrzeiliges Einfügen in ein Zutatenfeld erzeugt mehrere Zeilen.
  ingRows.addEventListener('paste', (e) => {
    const text = e.clipboardData?.getData('text') || '';
    if (!text.includes('\n')) return;
    e.preventDefault();
    const item = e.target.closest('.ing-item');
    const at = item ? Number(item.dataset.i) : draft.ingredients.length;
    const parsed = text.split('\n').map((l) => l.trim()).filter(Boolean)
      .map((line) => normalizeRecipe({ ingredients: [line] }).recipe.ingredients[0])
      .filter(Boolean);
    draft.ingredients.splice(at, 1, ...parsed);
    drawIngs();
  });

  $('#ing-add', root).addEventListener('click', () => {
    draft.ingredients.push({ amount: null, unit: '', name: '', note: '', group: '' });
    drawIngs();
    const inputs = $$('.ing-row .amount', ingRows);
    inputs[inputs.length - 1]?.focus();
  });

  $('#ing-mode', root).addEventListener('click', () => {
    const area = $('#ing-text', root);
    const toText = area.classList.contains('hidden');
    if (toText) {
      area.value = draft.ingredients
        .filter((i) => i.name)
        .map((i) => [i.amount !== null && i.amount !== undefined ? fmtAmount(i.amount) : '', i.unit, i.name].filter(Boolean).join(' '))
        .join('\n');
      area.classList.remove('hidden');
      ingRows.classList.add('hidden');
      $('#ing-add', root).classList.add('hidden');
      $('#ing-mode', root).textContent = '📋 Als Liste';
    } else {
      draft.ingredients = area.value.split('\n').map((l) => l.trim()).filter(Boolean)
        .map((line) => normalizeRecipe({ ingredients: [line] }).recipe.ingredients[0])
        .filter(Boolean);
      if (!draft.ingredients.length) draft.ingredients = [{ amount: null, unit: '', name: '', note: '', group: '' }];
      area.classList.add('hidden');
      ingRows.classList.remove('hidden');
      $('#ing-add', root).classList.remove('hidden');
      $('#ing-mode', root).textContent = '📝 Als Text';
      drawIngs();
    }
  });

  /* ---------- Schritte ---------- */
  const stepRows = $('#step-rows', root);

  function drawSteps() {
    stepRows.innerHTML = draft.steps.map((text, i) => `
      <div class="step-row" data-i="${i}">
        <span class="step-no" style="margin-top:.55rem">${i + 1}</span>
        <textarea placeholder="Was passiert in diesem Schritt?">${esc(text)}</textarea>
        <button type="button" class="del-btn" data-del="${i}" title="Schritt löschen">✕</button>
      </div>`).join('');
  }

  stepRows.addEventListener('input', (e) => {
    const row = e.target.closest('.step-row');
    if (row && e.target.tagName === 'TEXTAREA') draft.steps[Number(row.dataset.i)] = e.target.value;
  });

  stepRows.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-del]');
    if (!btn) return;
    draft.steps.splice(Number(btn.dataset.del), 1);
    if (!draft.steps.length) draft.steps.push('');
    drawSteps();
  });

  $('#step-add', root).addEventListener('click', () => {
    draft.steps.push('');
    drawSteps();
    const areas = $$('.step-row textarea', stepRows);
    areas[areas.length - 1]?.focus();
  });

  $('#step-mode', root).addEventListener('click', () => {
    const area = $('#step-text', root);
    const toText = area.classList.contains('hidden');
    if (toText) {
      area.value = draft.steps.filter(Boolean).join('\n');
      area.classList.remove('hidden');
      stepRows.classList.add('hidden');
      $('#step-add', root).classList.add('hidden');
      $('#step-mode', root).textContent = '📋 Als Liste';
    } else {
      draft.steps = area.value.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean);
      if (!draft.steps.length) draft.steps = [''];
      area.classList.add('hidden');
      stepRows.classList.remove('hidden');
      $('#step-add', root).classList.remove('hidden');
      $('#step-mode', root).textContent = '📝 Als Text';
      drawSteps();
    }
  });

  /* ---------- Bild ---------- */
  function imageHtml(src) {
    return src
      ? `<div class="img-preview"><img src="${esc(src)}" alt=""><button type="button" class="del-btn" id="img-del" title="Bild entfernen">✕</button></div>`
      : '';
  }

  function refreshImage() {
    $('#img-box', root).innerHTML = imageHtml(draft.image);
    $('#img-info', root).textContent = draft.image ? formatBytes(dataUrlBytes(draft.image)) : '';
    const del = $('#img-del', root);
    if (del) del.addEventListener('click', () => { draft.image = ''; refreshImage(); });
  }

  $('#pick-img', root).addEventListener('click', () => $('#f-image', root).click());
  $('#f-image', root).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    $('#img-info', root).textContent = 'wird verkleinert …';
    try {
      draft.image = await fileToDataUrl(file);
      refreshImage();
    } catch (err) {
      toast(err.message || 'Bild konnte nicht geladen werden.');
      $('#img-info', root).textContent = '';
    }
    e.target.value = '';
  });

  /* ---------- Speichern ---------- */
  function collect() {
    draft.title = $('#f-title', root).value.trim();
    draft.category = $('#f-category', root).value;
    draft.difficulty = $('#f-difficulty', root).value;
    draft.servings = Math.max(1, Number($('#f-servings', root).value) || 1);
    draft.prepMinutes = Math.max(0, Number($('#f-prep', root).value) || 0);
    draft.cookMinutes = Math.max(0, Number($('#f-cook', root).value) || 0);
    draft.description = $('#f-description', root).value.trim();
    draft.tags = $('#f-tags', root).value.split(',').map((t) => t.trim()).filter(Boolean);
    draft.notes = $('#f-notes', root).value.trim();
    draft.source = $('#f-source', root).value.trim();
    draft.ingredients = draft.ingredients.filter((i) => (i.name || '').trim());
    draft.steps = draft.steps.map((s) => s.trim()).filter(Boolean);
    const n = (id) => {
      const value = $(id, root).value;
      return value === '' ? null : Number(value);
    };
    draft.nutrition = {
      basis: $('#n-basis', root).value,
      kcal: n('#n-kcal'), protein: n('#n-protein'), carbs: n('#n-carbs'),
      fat: n('#n-fat'), fiber: n('#n-fiber')
    };
    return normalizeRecipe(draft, { keepId: true }).recipe;
  }

  $('#form', root).addEventListener('submit', async (event) => {
    event.preventDefault();
    // Offene Text-Modi zuerst zurückschreiben
    if (!$('#ing-text', root).classList.contains('hidden')) $('#ing-mode', root).click();
    if (!$('#step-text', root).classList.contains('hidden')) $('#step-mode', root).click();

    const recipe = collect();
    const errors = validateRecipe(recipe);
    const errorBox = $('#form-error', root);
    if (errors.length) {
      errorBox.textContent = errors.join(' ');
      errorBox.classList.remove('hidden');
      errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    errorBox.classList.add('hidden');
    const btn = $('#save', root);
    btn.disabled = true;
    btn.textContent = 'Speichert …';
    try {
      recipe.createdAt = existing?.createdAt || null;
      recipe.createdBy = existing?.createdBy || '';
      await saveRecipe(recipe);
      toast(isNew ? 'Rezept gespeichert.' : 'Änderungen gespeichert.');
      location.hash = `#/rezept/${encodeURIComponent(recipe.id)}`;
    } catch (err) {
      console.error(err);
      errorBox.textContent = err.code === 'permission-denied'
        ? 'Keine Schreibrechte – prüfe die Firestore-Regeln.'
        : `Speichern fehlgeschlagen: ${err.message}`;
      errorBox.classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = '💾 Speichern';
    }
  });

  $('#cancel', root).addEventListener('click', () => {
    if (existing) location.hash = `#/rezept/${encodeURIComponent(existing.id)}`;
    else location.hash = '#/rezepte';
  });

  $('#dl-ings', root).innerHTML = allIngredientNames().map((n) => `<option value="${esc(n)}">`).join('');

  drawIngs();
  drawSteps();
  refreshImage();

  return () => {};
}

function numVal(value) {
  return value === null || value === undefined || value === '' ? '' : String(value);
}

function hasAnyNutrition(recipe) {
  const n = recipe.nutrition || {};
  return ['kcal', 'protein', 'carbs', 'fat', 'fiber'].some((k) => Number(n[k]) > 0);
}
