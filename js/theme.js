/* Hell / Dunkel / Automatisch – gespeichert pro Gerät. */
const KEY = 'rezeptbuch.theme';

export function getTheme() {
  try {
    return localStorage.getItem(KEY) || 'auto';
  } catch {
    return 'auto';
  }
}

export function setTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch { /* Privatmodus */ }
  applyTheme();
}

export function applyTheme() {
  const theme = getTheme();
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);

  const dark = theme === 'dark'
    || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#17130f' : '#b4502b');
}
