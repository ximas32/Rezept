/* Einzelnes Rezept: anzeigen, Portionen umrechnen, kochen, einkaufen. */
import { getRecipe, patchRecipe, deleteRecipe, state, saveShopping, onChange } from '../store.js';
import { categoryEmoji, categoryLabel, toExportObject } from '../schema.js';
import { forServings, hasNutrition, fmtMacro, perPortion } from '../nutrition.js';
import { $, esc, fmtAmount, fmtDuration, toast, downloadFile, slug, uid, copyText } from '../util.js';

export function render(root, params) {
  const id = params.id;
  let recipe = getRecipe(id);

  if (!state.loaded) {
    root.innerHTML = '<div class="empty"><span class="spinner"></span><p>Lädt …</p></div>';
    const off = onChange(() => { if (getRecipe(id)) { off(); render(root, params); } });
    return () => off();
  }
  if (!recipe) {
    root.innerHTML = '<div class="empty"><span class="big">🤔</span><p>Dieses Rezept gibt es nicht (mehr).</p><p><a class="btn" href="#/rezepte">Zur Übersicht</a></p></div>';
    return () => {};
  }

  let servings = Math.max(1, Number(recipe.servings) || 1);
  const factorOf = () => servings / Math.max(1, Number(recipe.servings) || 1);

  function draw() {
    const time = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
    const pills = [
      `${categoryEmoji(recipe.category)} ${categoryLabel(recipe.category)}`,
      recipe.difficulty ? `🎯 ${recipe.difficulty}` : '',
      recipe.prepMinutes ? `🔪 ${fmtDuration(recipe.prepMinutes)}` : '',
      recipe.cookMinutes ? `🔥 ${fmtDuration(recipe.cookMinutes)}` : '',
      !recipe.prepMinutes && !recipe.cookMinutes && time ? `⏱ ${fmtDuration(time)}` : ''
    ].filter(Boolean);

    root.innerHTML = `
      ${recipe.image ? `<img class="hero" src="${esc(recipe.image)}" alt="${esc(recipe.title)}">` : ''}
      <h2 class="detail-title">${esc(recipe.title)}</h2>
      ${recipe.description ? `<p class="muted">${esc(recipe.description)}</p>` : ''}

      <div class="meta-row">
        ${pills.map((p) => `<span class="pill">${esc(p)}</span>`).join('')}
        ${(recipe.tags || []).map((t) => `<span class="pill pill-accent">#${esc(t)}</span>`).join('')}
      </div>

      <div class="card card-tight" style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;flex-wrap:wrap">
        <div class="servings-ctl">
          <button id="minus" aria-label="weniger">−</button>
          <span class="servings-val"><b id="serv">${servings}</b> Portionen</span>
          <button id="plus" aria-label="mehr">+</button>
        </div>
        <div style="display:flex;align-items:center;gap:.6rem">
          <button class="icon-btn" id="fav" title="Favorit">${recipe.favorite ? '⭐' : '☆'}</button>
          <span class="stars" id="stars">${[1, 2, 3, 4, 5].map((i) => `<span data-star="${i}" class="${i <= (recipe.rating || 0) ? 'on' : ''}">★</span>`).join('')}</span>
        </div>
      </div>

      <div class="card">
        <h3>Zutaten</h3>
        <ul class="ing-list" id="ings">${ingredientsHtml()}</ul>
        <button class="btn btn-sm btn-block" id="to-cart" style="margin-top:.7rem">🛒 Zutaten auf die Einkaufsliste</button>
      </div>

      <div class="card">
        <h3>Zubereitung</h3>
        <ol class="step-list">
          ${(recipe.steps || []).map((s, i) => `
            <li><span class="step-no">${i + 1}</span><span class="step-text">${esc(s)}</span></li>`).join('')}
        </ol>
      </div>

      ${nutritionHtml()}

      ${recipe.notes ? `<div class="card"><h3>Notizen & Tipps</h3><p style="white-space:pre-wrap;margin:0">${esc(recipe.notes)}</p></div>` : ''}
      ${recipe.source ? `<p class="muted">Quelle: ${linkify(recipe.source)}</p>` : ''}

      <div class="actions-row">
        <button class="btn btn-primary" id="cook">👩‍🍳 Kochmodus</button>
        <a class="btn" href="#/bearbeiten/${encodeURIComponent(recipe.id)}">✏️ Bearbeiten</a>
      </div>
      <div class="actions-row">
        <button class="btn btn-sm" id="share">↗️ Teilen</button>
        <button class="btn btn-sm" id="export">⬇️ JSON</button>
        <button class="btn btn-sm" id="print">🖨️ Drucken</button>
        <button class="btn btn-sm btn-danger" id="del">🗑️ Löschen</button>
      </div>
    `;
    bind();
  }

  function ingredientsHtml() {
    const factor = factorOf();
    let html = '';
    let group = null;
    for (const ing of recipe.ingredients || []) {
      if ((ing.group || '') !== group) {
        group = ing.group || '';
        if (group) html += `<li class="ing-group" style="display:block">${esc(group)}</li>`;
      }
      const amount = ing.amount === null || ing.amount === undefined || ing.amount === ''
        ? '' : fmtAmount(Number(ing.amount) * factor);
      html += `<li>
        <span class="ing-amount">${esc(`${amount}${amount && ing.unit ? ' ' : ''}${ing.unit || ''}`)}</span>
        <span>${esc(ing.name)}${ing.note ? ` <span class="ing-note">(${esc(ing.note)})</span>` : ''}</span>
      </li>`;
    }
    return html || '<li class="muted">Keine Zutaten erfasst.</li>';
  }

  function nutritionHtml() {
    if (!hasNutrition(recipe.nutrition)) {
      return `<div class="card card-tight"><p class="muted" style="margin:0">
        Keine Nährwerte hinterlegt. Du kannst sie beim Bearbeiten ergänzen –
        oder die KI beim Import schätzen lassen.</p></div>`;
    }
    const one = perPortion(recipe);
    const all = forServings(recipe, servings);
    return `
      <div class="card">
        <h3>Nährwerte</h3>
        <div class="macro-grid">
          <div class="macro"><b>${fmtMacro(one.kcal, '')}</b><span>kcal</span></div>
          <div class="macro"><b>${fmtMacro(one.protein)}</b><span>Eiweiss</span></div>
          <div class="macro"><b>${fmtMacro(one.carbs)}</b><span>Kohlenh.</span></div>
          <div class="macro"><b>${fmtMacro(one.fat)}</b><span>Fett</span></div>
        </div>
        <p class="sub" style="margin-top:.5rem">
          pro Portion · für ${servings} Portionen zusammen:
          ${fmtMacro(all.kcal, '')} kcal, ${fmtMacro(all.protein)} E, ${fmtMacro(all.carbs)} KH, ${fmtMacro(all.fat)} F
          ${one.fiber ? ` · Ballaststoffe ${fmtMacro(one.fiber)}/Portion` : ''}
        </p>
      </div>`;
  }

  function bind() {
    $('#minus', root).addEventListener('click', () => { servings = Math.max(1, servings - 1); draw(); });
    $('#plus', root).addEventListener('click', () => { servings = Math.min(99, servings + 1); draw(); });

    $('#fav', root).addEventListener('click', async () => {
      recipe = { ...recipe, favorite: !recipe.favorite };
      draw();
      try { await patchRecipe(recipe.id, { favorite: recipe.favorite }); } catch (e) { toast('Konnte nicht speichern.'); }
    });

    $('#stars', root).addEventListener('click', async (e) => {
      const star = e.target.closest('[data-star]');
      if (!star) return;
      const value = Number(star.dataset.star);
      recipe = { ...recipe, rating: recipe.rating === value ? 0 : value };
      draw();
      try { await patchRecipe(recipe.id, { rating: recipe.rating }); } catch (err) { toast('Konnte nicht speichern.'); }
    });

    $('#to-cart', root).addEventListener('click', async () => {
      const factor = factorOf();
      const items = (state.shopping.items || []).slice();
      for (const ing of recipe.ingredients || []) {
        const parts = [
          ing.amount ? fmtAmount(Number(ing.amount) * factor) : '',
          ing.unit || '',
          ing.name
        ].filter(Boolean);
        items.push({ id: uid(), text: parts.join(' '), done: false, from: recipe.title });
      }
      try {
        await saveShopping(items);
        toast(`${recipe.ingredients.length} Zutaten auf der Einkaufsliste.`);
      } catch (err) {
        toast('Speichern fehlgeschlagen.');
      }
    });

    $('#cook', root).addEventListener('click', () => openCookMode(recipe, servings, factorOf()));

    $('#export', root).addEventListener('click', () => {
      downloadFile(`${slug(recipe.title)}.json`, JSON.stringify(toExportObject(recipe), null, 2));
    });

    $('#print', root).addEventListener('click', () => window.print());

    $('#share', root).addEventListener('click', async () => {
      const text = asPlainText(recipe, servings, factorOf());
      if (navigator.share) {
        try { await navigator.share({ title: recipe.title, text }); return; } catch { /* abgebrochen */ }
      }
      toast(await copyText(text) ? 'Rezept in die Zwischenablage kopiert.' : 'Kopieren nicht möglich.');
    });

    $('#del', root).addEventListener('click', async () => {
      if (!confirm(`„${recipe.title}" wirklich löschen?`)) return;
      try {
        await deleteRecipe(recipe.id);
        toast('Gelöscht.');
        location.hash = '#/rezepte';
      } catch (err) {
        toast('Löschen fehlgeschlagen.');
      }
    });
  }

  draw();

  const off = onChange(() => {
    const fresh = getRecipe(id);
    if (fresh && JSON.stringify(fresh) !== JSON.stringify(recipe)) {
      recipe = fresh;
      draw();
    }
  });
  return () => off();
}

function linkify(source) {
  if (/^https?:\/\//i.test(source)) {
    return `<a href="${esc(source)}" target="_blank" rel="noopener noreferrer">${esc(source.slice(0, 70))}</a>`;
  }
  return esc(source);
}

function asPlainText(recipe, servings, factor) {
  const lines = [recipe.title, ''];
  lines.push(`Für ${servings} Portionen`, '', 'Zutaten:');
  for (const i of recipe.ingredients || []) {
    const amount = i.amount ? `${fmtAmount(Number(i.amount) * factor)} ${i.unit || ''} ` : '';
    lines.push(`- ${amount}${i.name}${i.note ? ` (${i.note})` : ''}`);
  }
  lines.push('', 'Zubereitung:');
  (recipe.steps || []).forEach((s, i) => lines.push(`${i + 1}. ${s}`));
  if (recipe.notes) lines.push('', `Notizen: ${recipe.notes}`);
  if (recipe.source) lines.push('', `Quelle: ${recipe.source}`);
  return lines.join('\n');
}

/* ---------------- Kochmodus ---------------- */
async function openCookMode(recipe, servings, factor) {
  let wakeLock = null;
  try {
    if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
  } catch { /* nicht unterstützt – egal */ }

  const overlay = document.createElement('div');
  overlay.className = 'cook-mode';
  overlay.innerHTML = `
    <div class="cook-close">
      <h2>${esc(recipe.title)}</h2>
      <button class="btn btn-sm" id="cook-x">✕ Schliessen</button>
    </div>
    <p class="muted">Für ${servings} Portionen · tippe auf eine Zeile, um sie abzuhaken.
    Der Bildschirm bleibt an.</p>
    <h3>Zutaten</h3>
    <ul class="ing-list" id="c-ings">
      ${(recipe.ingredients || []).map((i) => {
        const amount = i.amount ? `${fmtAmount(Number(i.amount) * factor)} ${i.unit || ''}`.trim() : (i.unit || '');
        return `<li><span class="ing-amount">${esc(amount)}</span><span>${esc(i.name)}${i.note ? ` <span class="ing-note">(${esc(i.note)})</span>` : ''}</span></li>`;
      }).join('')}
    </ul>
    <h3 style="margin-top:1rem">Zubereitung</h3>
    <ol class="step-list" id="c-steps">
      ${(recipe.steps || []).map((s, i) => `<li><span class="step-no">${i + 1}</span><span class="step-text">${esc(s)}</span></li>`).join('')}
    </ol>
  `;
  document.body.appendChild(overlay);

  const toggle = (e) => {
    const li = e.target.closest('li');
    if (li) li.classList.toggle('checked');
  };
  overlay.querySelector('#c-ings').addEventListener('click', toggle);
  overlay.querySelector('#c-steps').addEventListener('click', toggle);

  const close = () => {
    overlay.remove();
    if (wakeLock) wakeLock.release().catch(() => {});
    window.removeEventListener('hashchange', close);
  };
  overlay.querySelector('#cook-x').addEventListener('click', close);
  window.addEventListener('hashchange', close);
}
