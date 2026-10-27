/* Firebase-Initialisierung (SDK direkt vom Google-CDN, kein Build-Schritt). */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js';
import {
  getAuth, setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager
} from 'https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js';
import { firebaseConfig } from './config.js';

export const configIsPlaceholder =
  !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('DEIN_');

export let app = null;
export let auth = null;
export let db = null;

if (!configIsPlaceholder) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(() => {});

  // Offline-Cache: Rezepte sind auch ohne Internet lesbar, Aenderungen
  // werden spaeter automatisch synchronisiert.
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
}
