/* ============================================================
   HIER MUSST DU ETWAS EINTRAGEN  (einmalig, 5 Minuten)
   ------------------------------------------------------------
   1. firebase.google.com -> Projekt erstellen (gratis, Spark-Plan)
   2. Im Projekt: Zahnrad -> Projekteinstellungen -> "Meine Apps"
      -> Web-App (</>) hinzufuegen -> die Werte aus "firebaseConfig"
      unten eintragen.
   3. Sicherheit -> Authentifizierung -> Reiter "Anmeldemethode"
      -> "E-Mail/Passwort" aktivieren.
      (Nicht "Nutzer und Berechtigungen" in den Projekteinstellungen – das
      regelt nur, wer das Firebase-Projekt verwalten darf.)
   4. Datenbanken und Speicher -> Firestore -> Datenbank erstellen
      (Edition "Standard", Region europe-west*, Produktionsmodus).
   5. Firestore -> Reiter "Regeln" -> Inhalt von firestore.rules einfuegen.

   Die Werte hier sind KEINE Geheimnisse – sie duerfen oeffentlich im
   GitHub-Repo stehen. Den Zugriff schuetzen die Firestore-Regeln.
   ============================================================ */

export const firebaseConfig = {
  apiKey: 'AIzaSyDky26GVY7DJmnoJU9yf8kJ3WV9ecehQZ8',
  authDomain: 'rezepte-b2eba.firebaseapp.com',
  projectId: 'rezepte-b2eba',
  storageBucket: 'rezepte-b2eba.firebasestorage.app',
  messagingSenderId: '688868103653',
  appId: '1:688868103653:web:ae8a708f4fb96bd1a90b0c'
  // measurementId braucht es nur fuer Google Analytics – nutzt die App nicht.
};

/* Wer darf rein? Dieselben Adressen auch in firestore.rules eintragen –
   dort wird es wirklich durchgesetzt, hier dient es nur der Fehlermeldung. */
export const ALLOWED_EMAILS = [
  'deine@mail.ch',
  'ihre@mail.ch'
];

/* Kategorien – frei erweiterbar. id = intern, label = Anzeige. */
export const CATEGORIES = [
  { id: 'vorspeise', label: 'Vorspeise', emoji: '🥗' },
  { id: 'hauptspeise', label: 'Hauptspeise', emoji: '🍝' },
  { id: 'dessert', label: 'Dessert', emoji: '🍰' },
  { id: 'beilage', label: 'Beilage', emoji: '🥔' },
  { id: 'fruehstueck', label: 'Frühstück', emoji: '🥐' },
  { id: 'snack', label: 'Snack', emoji: '🥨' },
  { id: 'getraenk', label: 'Getränk', emoji: '🥤' },
  { id: 'sauce', label: 'Sauce & Dip', emoji: '🫙' },
  { id: 'backen', label: 'Backen', emoji: '🍞' },
  { id: 'sonstiges', label: 'Sonstiges', emoji: '🍽️' }
];

export const DIFFICULTIES = ['einfach', 'mittel', 'anspruchsvoll'];

/* Einheiten fuer die Vorschlagsliste im Editor */
export const UNITS = [
  'g', 'kg', 'ml', 'l', 'EL', 'TL', 'Stk', 'Prise', 'Bund', 'Zehe',
  'Dose', 'Packung', 'Scheibe', 'Tasse', 'cm', 'n. B.'
];

export const APP_VERSION = '1.0.0';
