/* Zwischenablage innerhalb der App: ein Rezept aus dem KI-Import an den
   Editor übergeben, ohne es vorher zu speichern. */
let pending = null;

export function setPrefill(recipe) {
  pending = recipe;
}

export function takePrefill() {
  const value = pending;
  pending = null;
  return value;
}
