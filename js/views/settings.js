/* Einstellungen, Backup und Infos. */
import { APP_VERSION, ALLOWED_EMAILS, firebaseConfig } from '../config.js';
import { state, saveMany, onChange } from '../store.js';
import { normalizeRecipe, toExportObject } from '../schema.js';
import { logout, currentUser } from '../auth.js';
import { $, esc, toast, downloadFile } from '../util.js';
import { getTheme, setTheme } from '../theme.js';

export function render(root) {
  function draw() {
    const user = currentUser();
    const withImage = state.recipes.filter((r) => r.image).length;
    const withMacros = state.recipes.filter((r) => r.nutrition?.kcal).length;

    root.innerHTML = `
      <div class="card">
        <h3>Konto</h3>
        <div class="kv"><span>Angemeldet als</span><b>${esc(user?.email || '–')}</b></div>
        <div class="kv"><span>Freigegebene Adressen</span><span class="muted">${esc(ALLOWED_EMAILS.join(', '))}</span></div>
        <button class="btn btn-block" id="logout" style="margin-top:.6rem">Abmelden</button>
      </div>

      <div class="card">
        <h3>Darstellung</h3>
        <div class="chips" id="theme-chips" style="margin-bottom:0">
          ${[['auto', 'Automatisch'], ['light', 'Hell'], ['dark', 'Dunkel']]
            .map(([id, label]) => `<button class="chip ${getTheme() === id ? 'active' : ''}" data-theme="${id}">${label}</button>`).join('')}
        </div>
      </div>

      <div class="card">
        <h3>Eure Sammlung</h3>
        <div class="kv"><span>Rezepte</span><b>${state.recipes.length}</b></div>
        <div class="kv"><span>mit Bild</span><b>${withImage}</b></div>
        <div class="kv"><span>mit Nährwerten</span><b>${withMacros}</b></div>
        <div class="kv"><span>Einkaufsliste</span><b>${(state.shopping.items || []).length} Einträge</b></div>
      </div>

      <div class="card">
        <h3>Backup</h3>
        <p class="muted">Lade alle Rezepte als JSON-Datei herunter oder spiele ein Backup wieder ein.</p>
        <div class="actions-row" style="margin-top:0">
          <button class="btn btn-sm" id="export-all">⬇️ Alle exportieren</button>
          <button class="btn btn-sm" id="import-all">⬆️ Backup einspielen</button>
          <input type="file" id="backup-file" accept=".json,application/json" style="display:none">
        </div>
      </div>

      <div class="card">
        <h3>App</h3>
        <div class="kv"><span>Version</span><span>${esc(APP_VERSION)}</span></div>
        <div class="kv"><span>Firebase-Projekt</span><span>${esc(firebaseConfig.projectId)}</span></div>
        <div class="kv"><span>Verbindung</span><span>${navigator.onLine ? '🟢 online' : '🔴 offline (Änderungen werden später synchronisiert)'}</span></div>
        <button class="btn btn-sm btn-block" id="reload" style="margin-top:.6rem">🔄 Nach Update suchen</button>
        <p class="sub">Auf dem Handy: Browser-Menü → „Zum Startbildschirm hinzufügen", dann startet die App wie eine normale App.</p>
      </div>
    `;
    bind();
  }

  function bind() {
    $('#logout', root).addEventListener('click', async () => {
      await logout();
      location.hash = '#/rezepte';
    });

    $('#theme-chips', root).addEventListener('click', (e) => {
      const btn = e.target.closest('[data-theme]');
      if (!btn) return;
      setTheme(btn.dataset.theme);
      draw();
    });

    $('#export-all', root).addEventListener('click', () => {
      const data = {
        exportedAt: new Date().toISOString(),
        app: 'Rezeptbuch',
        version: APP_VERSION,
        recipes: state.recipes.map(toExportObject)
      };
      const date = new Date().toISOString().slice(0, 10);
      downloadFile(`rezepte-backup-${date}.json`, JSON.stringify(data, null, 2));
    });

    $('#import-all', root).addEventListener('click', () => $('#backup-file', root).click());
    $('#backup-file', root).addEventListener('change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const raw = Array.isArray(data) ? data : (data.recipes || []);
        const recipes = raw.map((r) => normalizeRecipe(r, { keepId: true }).recipe)
          .filter((r) => r.title && r.ingredients.length);
        if (!recipes.length) return toast('Keine Rezepte in der Datei gefunden.');
        if (!confirm(`${recipes.length} Rezepte einspielen? Gleiche IDs werden überschrieben.`)) return;
        await saveMany(recipes);
        toast(`${recipes.length} Rezepte eingespielt.`);
      } catch (err) {
        toast(`Import fehlgeschlagen: ${err.message}`);
      }
    });

    $('#reload', root).addEventListener('click', async () => {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.update()));
      }
      location.reload();
    });
  }

  draw();
  const off = onChange(draw);
  return () => off();
}
