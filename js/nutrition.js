/* Nährwerte: umrechnen zwischen "pro Portion" und "ganzes Rezept",
   plus Skalierung auf eine abweichende Portionenzahl. */

const KEYS = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];

export function hasNutrition(nutrition) {
  if (!nutrition) return false;
  return KEYS.some((k) => Number(nutrition[k]) > 0);
}

/** Nährwerte pro Portion (unabhängig davon, wie sie erfasst wurden). */
export function perPortion(recipe) {
  const n = recipe?.nutrition || {};
  const servings = Math.max(1, Number(recipe?.servings) || 1);
  const divisor = n.basis === 'total' ? servings : 1;
  const out = {};
  for (const key of KEYS) {
    const value = Number(n[key]);
    out[key] = Number.isFinite(value) && value > 0 ? value / divisor : null;
  }
  if (!out.kcal) out.kcal = kcalFromMacros(out);
  return out;
}

/** Nährwerte für eine gewünschte Portionenzahl. */
export function forServings(recipe, servings) {
  const base = perPortion(recipe);
  const factor = Math.max(0, Number(servings) || 0);
  const out = {};
  for (const key of KEYS) out[key] = base[key] === null ? null : base[key] * factor;
  return out;
}

/** Fehlende Kalorien aus Makros schätzen (4/4/9 kcal pro Gramm). */
export function kcalFromMacros({ protein, carbs, fat }) {
  if (!protein && !carbs && !fat) return null;
  return Math.round((protein || 0) * 4 + (carbs || 0) * 4 + (fat || 0) * 9);
}

export function fmtMacro(value, unit = 'g') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '–';
  const rounded = value >= 100 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${unit}`;
}
