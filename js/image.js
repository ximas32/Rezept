/* Bilder werden im Browser verkleinert und als Data-URL direkt im
   Firestore-Dokument gespeichert. Damit braucht ihr kein Firebase Storage
   (das verlangt inzwischen eine Kreditkarte) – und bleibt komplett gratis.
   Grenze: ein Firestore-Dokument darf max. 1 MB gross sein. */

const MAX_SIDE = 1200;
const TARGET_BYTES = 350 * 1024;

export async function fileToDataUrl(file, { maxSide = MAX_SIDE, targetBytes = TARGET_BYTES } = {}) {
  if (!file || !file.type.startsWith('image/')) {
    throw new Error('Das ist keine Bilddatei.');
  }
  const bitmap = await loadBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  let quality = 0.82;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (dataUrlBytes(url) > targetBytes && quality > 0.4) {
    quality -= 0.1;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrlBytes(url) > targetBytes) {
    // Immer noch zu gross -> zusätzlich die Kantenlänge halbieren.
    const c2 = document.createElement('canvas');
    c2.width = Math.round(w * 0.7);
    c2.height = Math.round(h * 0.7);
    c2.getContext('2d').drawImage(canvas, 0, 0, c2.width, c2.height);
    url = c2.toDataURL('image/jpeg', 0.7);
  }
  return url;
}

export function dataUrlBytes(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  return Math.round(base64.length * 0.75);
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

async function loadBitmap(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file); } catch { /* Fallback unten */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Bild konnte nicht geladen werden.')); };
    img.src = url;
  });
}
