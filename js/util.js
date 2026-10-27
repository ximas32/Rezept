/* Kleine Helfer, die überall gebraucht werden. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** HTML-Escaping – IMMER benutzen, bevor Nutzertext in innerHTML landet. */
export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Für die Suche: klein, ohne Akzente, Umlaute ausgeschrieben. */
export function norm(value) {
  return String(value ?? '')
    .toLowerCase()
    .replaceAll('ä', 'ae').replaceAll('ö', 'oe').replaceAll('ü', 'ue').replaceAll('ß', 'ss')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const FRACTIONS = [
  [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.5, '½'],
  [0.667, '⅔'], [0.75, '¾']
];

/** Menge hübsch darstellen: 0.5 -> ½, 1.5 -> 1½, 12.345 -> 12.3 */
export function fmtAmount(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  const num = Number(n);
  if (num === 0) return '0';
  const abs = Math.abs(num);
  // Brüche nur bei kleinen Mengen – "583⅓ g" liest sich niemand gern.
  if (abs < 10) {
    const whole = Math.floor(abs);
    const rest = abs - whole;
    for (const [val, glyph] of FRACTIONS) {
      if (Math.abs(rest - val) < 0.02) {
        const sign = num < 0 ? '-' : '';
        return sign + (whole ? whole + glyph : glyph);
      }
    }
  }
  if (abs >= 100) return String(Math.round(num));
  if (abs >= 10) return String(Math.round(num * 10) / 10);
  return String(Math.round(num * 100) / 100);
}

/** "1 1/2", "1½", "0,5", "2-3" -> Zahl (bzw. null) */
export function parseAmount(input) {
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  let s = String(input ?? '').trim().replace(',', '.');
  if (!s) return null;
  for (const [val, glyph] of FRACTIONS) {
    if (s.includes(glyph)) s = s.replace(glyph, (s.trim() === glyph ? '' : '+') + val);
  }
  const range = s.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
  if (range) return (parseFloat(range[1]) + parseFloat(range[2])) / 2;
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1], 10) + parseInt(mixed[2], 10) / parseInt(mixed[3], 10);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1], 10) / parseInt(frac[2], 10);
  const plus = s.match(/^(\d+)\+(\d*\.?\d+)$/);
  if (plus) return parseInt(plus[1], 10) + parseFloat(plus[2]);
  const num = parseFloat(s);
  return Number.isFinite(num) ? num : null;
}

let toastTimer;
export function toast(message, ms = 2600) {
  const box = document.getElementById('toast');
  if (!box) return;
  box.textContent = message;
  box.classList.remove('hidden');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.add('hidden'), ms);
}

export function fmtDate(value) {
  if (!value) return '';
  const d = value.toDate ? value.toDate() : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDuration(minutes) {
  const m = Number(minutes) || 0;
  if (!m) return '';
  if (m < 60) return `${m} Min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} Min` : `${h} h`;
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

export function downloadFile(filename, content, type = 'application/json') {
  const blob = new Blob([content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Dateiname ohne Sonderzeichen */
export function slug(text) {
  return norm(text).replace(/\s+/g, '-').slice(0, 60) || 'rezept';
}
