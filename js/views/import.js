/* KI-Import: Prompt kopieren, Antwort der KI einfügen, prüfen, speichern. */
import { AI_PROMPT } from '../prompt.js';
import { parseRecipeJson, normalizeRecipe, categoryLabel } from '../schema.js';
import { saveMany, saveRecipe, state } from '../store.js';
import { setPrefill } from '../pending.js';
import { $, esc, copyText, toast } from '../util.js';

export function render(root) {
  let parsed = [];

  root.innerHTML = `
    <div class="card">
      <h3>1. Prompt kopieren</h3>
      <p class="muted" style="margin-bottom:.6rem">
        Kopiere den Prompt, öffne eine KI (Claude, ChatGPT, Gemini …), füge den Prompt ein
        und hänge Foto, Link oder Text des Rezepts an.
      </p>
      <button class="btn btn-primary btn-block" id="copy-prompt">📋 Prompt kopieren</button>
      <details class="acc" style="margin-top:.7rem">
        <summary>Prompt ansehen</summary>
        <pre id="prompt-text">${esc(AI_PROMPT)}</pre>
      </details>
    </div>

    <div class="card">
      <h3>2. Antwort einfügen</h3>
      <textarea id="json-input" placeholder='Hier die Antwort der KI einfügen – das JSON, das mit { beginnt.' style="min-height:150px"></textarea>
      <div style="display:flex;gap:.5rem;margin-top:.5rem;flex-wrap:wrap">
        <button class="btn btn-sm" id="paste">📥 Aus Zwischenablage</button>
        <button class="btn btn-sm" id="pick-file">📄 JSON-Datei</button>
        <button class="btn btn-sm btn-primary" id="check" style="margin-left:auto">Prüfen</button>
        <input type="file" id="file" accept=".json,application/json" style="display:none">
      </div>
      <p class="error hidden" id="err"></p>
    </div>

    <div id="preview"></div>
  `;

  $('#copy-prompt', root).addEventListener('click', async () => {
    const ok = await copyText(AI_PROMPT);
    toast(ok ? 'Prompt kopiert – jetzt in die KI einfügen.' : 'Kopieren hat nicht geklappt, Text bitte manuell markieren.');
  });

  $('#paste', root).addEventListener('click', async () => {
    try {
      const text = await navigator.clipboard.readText();
      $('#json-input', root).value = text;
      check();
    } catch {
      toast('Zwischenablage nicht lesbar – bitte von Hand einfügen.');
    }
  });

  $('#pick-file', root).addEventListener('click', () => $('#file', root).click());
  $('#file', root).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    $('#json-input', root).value = await file.text();
    e.target.value = '';
    check();
  });

  $('#check', root).addEventListener('click', check);
  $('#json-input', root).addEventListener('input', () => {
    $('#err', root).classList.add('hidden');
  });

  function showError(message) {
    const box = $('#err', root);
    box.textContent = message;
    box.classList.remove('hidden');
    $('#preview', root).innerHTML = '';
    parsed = [];
  }

  function check() {
    const raw = $('#json-input', root).value.trim();
    if (!raw) return showError('Bitte zuerst die Antwort der KI einfügen.');
    let items;
    try {
      items = parseRecipeJson(raw);
    } catch (err) {
      return showError(
        'Das ist kein gültiges JSON. Häufigster Grund: Der Text wurde aus der ' +
        'Chat-Oberfläche markiert statt über den Kopier-Knopf am Codeblock – dann ' +
        'schleichen sich Backslashes am Zeilenende oder Zeichen wie "&#x20;" ein. ' +
        `Sonst hilft: die KI bitten, nur das JSON nochmals auszugeben. (${err.message})`
      );
    }
    if (!items.length) return showError('Im Text war kein Rezept zu finden.');

    parsed = items.map((item) => normalizeRecipe(item));
    const valid = parsed.filter((p) => p.recipe.title && p.recipe.ingredients.length);
    if (!valid.length) return showError('Gefunden, aber ohne Titel oder Zutaten – bitte die KI-Antwort prüfen.');

    $('#err', root).classList.add('hidden');
    drawPreview();
  }

  function drawPreview() {
    const box = $('#preview', root);
    box.innerHTML = `
      <div class="card">
        <h3>3. Prüfen & übernehmen</h3>
        ${parsed.map((p, i) => previewCard(p, i)).join('')}
        <div class="actions-row">
          <button class="btn btn-primary" id="import-all">✅ ${parsed.length > 1 ? `Alle ${parsed.length} importieren` : 'Importieren'}</button>
          ${parsed.length === 1 ? '<button class="btn" id="edit-first">✏️ Zuerst bearbeiten</button>' : ''}
        </div>
      </div>`;

    box.querySelector('#import-all').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Speichert …';
      try {
        const recipes = parsed.map((p) => p.recipe);
        if (recipes.length === 1) await saveRecipe(recipes[0]);
        else await saveMany(recipes);
        toast(`${recipes.length} Rezept${recipes.length > 1 ? 'e' : ''} importiert.`);
        $('#json-input', root).value = '';
        location.hash = recipes.length === 1
          ? `#/rezept/${encodeURIComponent(recipes[0].id)}`
          : '#/rezepte';
      } catch (err) {
        btn.disabled = false;
        btn.textContent = '✅ Importieren';
        showError(err.code === 'permission-denied'
          ? 'Keine Schreibrechte – prüfe die Firestore-Regeln.'
          : `Speichern fehlgeschlagen: ${err.message}`);
      }
    });

    const editBtn = box.querySelector('#edit-first');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        setPrefill(parsed[0].recipe);
        location.hash = '#/neu';
      });
    }
  }

  function previewCard(p, index) {
    const r = p.recipe;
    const duplicate = state.recipes.some(
      (x) => x.title.trim().toLowerCase() === r.title.trim().toLowerCase()
    );
    return `
      <div class="card card-tight" style="margin-bottom:.6rem">
        <b>${index + 1}. ${esc(r.title || '(ohne Titel)')}</b>
        <div class="recipe-meta" style="margin-top:.2rem">
          ${esc(categoryLabel(r.category))} · ${r.ingredients.length} Zutaten ·
          ${r.steps.length} Schritte · ${r.servings} Portionen
          ${r.nutrition.kcal ? ` · ${Math.round(r.nutrition.kcal)} kcal/Portion` : ''}
        </div>
        ${duplicate ? '<p class="error" style="margin:.4rem 0 0">⚠️ Ein Rezept mit diesem Titel existiert schon – es wird zusätzlich angelegt.</p>' : ''}
        ${p.warnings.length ? `<p class="sub" style="margin-top:.3rem">${esc(p.warnings.join(' '))}</p>` : ''}
      </div>`;
  }

  return () => {};
}
