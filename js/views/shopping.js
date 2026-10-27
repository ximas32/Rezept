/* Gemeinsame Einkaufsliste – ihr seht beide dieselbe Liste in Echtzeit. */
import { state, onChange, saveShopping } from '../store.js';
import { $, esc, uid, toast, copyText } from '../util.js';

export function render(root) {
  function items() {
    return (state.shopping.items || []).slice();
  }

  async function write(next) {
    try {
      await saveShopping(next);
    } catch (err) {
      toast('Speichern fehlgeschlagen.');
    }
  }

  function draw() {
    const list = items();
    const open = list.filter((i) => !i.done);
    const done = list.filter((i) => i.done);

    root.innerHTML = `
      <div class="card card-tight">
        <form id="add-form" style="display:flex;gap:.4rem">
          <input type="text" id="add-input" placeholder="Was fehlt noch?" autocomplete="off" enterkeyhint="done">
          <button class="btn btn-sm btn-primary" type="submit">+</button>
        </form>
      </div>

      ${list.length ? '' : `<div class="empty"><span class="big">🛒</span>
        <p>Die Liste ist leer.</p>
        <p class="muted">Tipp: In einem Rezept auf „Zutaten auf die Einkaufsliste" tippen.</p></div>`}

      ${open.length ? `<div class="card">
        <h3>Noch zu kaufen (${open.length})</h3>
        ${open.map(row).join('')}
      </div>` : ''}

      ${done.length ? `<div class="card">
        <h3 class="muted">Erledigt (${done.length})</h3>
        ${done.map(row).join('')}
      </div>` : ''}

      ${list.length ? `<div class="actions-row">
        <button class="btn btn-sm" id="copy">📋 Liste kopieren</button>
        ${done.length ? '<button class="btn btn-sm" id="clear-done">Erledigte entfernen</button>' : ''}
        <button class="btn btn-sm btn-danger" id="clear-all">Alles löschen</button>
      </div>` : ''}
    `;
    bind();
  }

  function row(item) {
    return `
      <div class="shop-item ${item.done ? 'checked' : ''}" data-id="${esc(item.id)}">
        <input type="checkbox" ${item.done ? 'checked' : ''} data-toggle="${esc(item.id)}">
        <label>${esc(item.text)}${item.from ? ` <span class="muted">· ${esc(item.from)}</span>` : ''}</label>
        <button class="del-btn" data-del="${esc(item.id)}" title="Entfernen">✕</button>
      </div>`;
  }

  function bind() {
    $('#add-form', root)?.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = $('#add-input', root);
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      write([...items(), { id: uid(), text, done: false, from: '' }]);
    });

    $('#clear-done', root)?.addEventListener('click', () => write(items().filter((i) => !i.done)));
    $('#clear-all', root)?.addEventListener('click', () => {
      if (confirm('Die ganze Einkaufsliste löschen?')) write([]);
    });
    $('#copy', root)?.addEventListener('click', async () => {
      const text = items().filter((i) => !i.done).map((i) => `- ${i.text}`).join('\n');
      toast(await copyText(text) ? 'Liste kopiert.' : 'Kopieren nicht möglich.');
    });
  }

  // Delegierte Handler nur einmal registrieren – draw() tauscht nur den Inhalt aus.
  const onToggle = (e) => {
    const id = e.target.dataset?.toggle;
    if (!id) return;
    write(items().map((i) => (i.id === id ? { ...i, done: e.target.checked } : i)));
  };
  const onDelete = (e) => {
    const del = e.target.closest('[data-del]');
    if (del) write(items().filter((i) => i.id !== del.dataset.del));
  };
  root.addEventListener('change', onToggle);
  root.addEventListener('click', onDelete);

  draw();
  const off = onChange(draw);
  return () => {
    off();
    root.removeEventListener('change', onToggle);
    root.removeEventListener('click', onDelete);
  };
}
