# 🍲 Unser Rezeptbuch

Eine private Rezept-App für zwei Personen: PWA (installierbar auf dem Handy),
gehostet gratis auf GitHub Pages, Daten in Firebase Firestore (ebenfalls gratis).

**Funktionen**

- Rezepte anlegen, bearbeiten, löschen – mit Bild, Portionen, Zeiten, Tags
- Kategorien: Vorspeise, Hauptspeise, Dessert, Beilage, Frühstück, Snack, Getränk, Sauce, Backen
- Suche nach Titel **und Zutaten** („Was habt ihr da?" – mehrere Zutaten kombinierbar)
- Filter nach Kategorie, Dauer, Favoriten; Sortierung nach Name, Datum, Bewertung, Zeit
- Portionenrechner: Mengen werden live umgerechnet
- Nährwerte/Makros pro Portion (kcal, Eiweiss, Kohlenhydrate, Fett, Ballaststoffe)
- **KI-Import**: Prompt kopieren → bei einer KI mit Foto/Link einfügen → JSON zurück in die App
- Gemeinsame Einkaufsliste in Echtzeit
- Kochmodus (grosse Schrift, Schritte abhaken, Bildschirm bleibt an)
- Favoriten, Sternebewertung, Zufallsrezept
- Offline nutzbar, Hell/Dunkel-Modus, Backup als JSON-Datei

Kein Build-Schritt, kein npm: reines HTML/CSS/JavaScript. Hochladen reicht.

---

## Einrichtung (einmalig, ca. 15 Minuten)

### 1. Firebase-Projekt anlegen

1. [console.firebase.google.com](https://console.firebase.google.com) öffnen, mit Google-Konto anmelden.
2. **Projekt hinzufügen** → Name z. B. `rezeptbuch` → Google Analytics kannst du abwählen.
3. Links in der Navigation **Sicherheit → Authentifizierung** → *Jetzt starten* →
   Reiter **Anmeldemethode** → Anbieter **E-Mail/Passwort** → aktivieren → speichern.
4. **Datenbanken und Speicher → Firestore** → *Datenbank erstellen* →
   Edition **Standard**, Standort **eur3 (europe-west)** → im **Produktionsmodus** starten.

> **Nicht verwechseln:** *Projekteinstellungen → Nutzer und Berechtigungen* regelt,
> welche Google-Konten das Firebase-Projekt **verwalten** dürfen. Die Konten eurer
> App stehen woanders, nämlich unter *Sicherheit → Authentifizierung → Nutzer*.
> Ältere Konsolen zeigen statt der Bereiche *Sicherheit* und *Datenbanken und
> Speicher* noch **Build → Authentication** bzw. **Build → Firestore Database** –
> gemeint ist dasselbe.

> Der Spark-Plan (gratis) reicht locker: 1 GB Speicher, 50 000 Lesezugriffe pro Tag.
> Eine Kreditkarte ist nicht nötig. **Firebase Storage** brauchen wir bewusst nicht –
> Bilder werden verkleinert und direkt im Rezept gespeichert.

### 2. Web-App registrieren und Zugangsdaten eintragen

1. Zahnrad oben links → **Projekteinstellungen** → runterscrollen zu *Meine Apps*
   → Symbol **`</>`** (Web) → App-Name eingeben → *App registrieren*.
2. Firebase zeigt ein Objekt `firebaseConfig = { apiKey: … }`.
3. Diese Werte in [`js/config.js`](js/config.js) eintragen.
4. In derselben Datei bei `ALLOWED_EMAILS` eure beiden E-Mail-Adressen eintragen.
5. Domain freigeben: **Sicherheit → Authentifizierung → Einstellungen** →
   Bereich **Autorisierte Domains** → *Domain hinzufügen* → `ximas32.github.io`.
   Für lokale Tests zusätzlich `localhost` eintragen – bei Projekten, die nach
   dem 28.04.2025 erstellt wurden, ist localhost nicht mehr automatisch dabei.

Diese Werte sind **keine Geheimnisse** und dürfen öffentlich im Repo stehen.
Den Zugriff regeln die Sicherheitsregeln im nächsten Schritt.

### 3. Sicherheitsregeln setzen (wichtig!)

1. Firebase-Console → **Datenbanken und Speicher → Firestore** → Reiter **Regeln**.
2. Inhalt von [`firestore.rules`](firestore.rules) hineinkopieren.
3. Die beiden Beispiel-Adressen durch eure echten ersetzen (klein geschrieben!).
4. **Veröffentlichen**.

Ohne diesen Schritt könnte jede angemeldete Person eure Rezepte lesen.

### 4. Auf GitHub Pages veröffentlichen

```bash
git add .
git commit -m "Rezeptbuch"
git push
```

Dann im GitHub-Repo: **Settings → Pages** → *Source*: `Deploy from a branch`
→ Branch `main`, Ordner `/ (root)` → *Save*.

Nach ein bis zwei Minuten läuft die App unter:
`https://ximas32.github.io/Rezept/`

### 5. Konten anlegen

Beide öffnen die Seite, tippen auf **Registrieren** und legen mit ihrer
(in Schritt 2 und 3 eingetragenen) E-Mail-Adresse ein Passwort fest. Fertig –
ihr seht ab sofort dieselben Rezepte.

### 6. Auf dem Handy installieren

- **Android/Chrome**: Menü ⋮ → *App installieren* bzw. *Zum Startbildschirm hinzufügen*
- **iPhone/Safari**: Teilen-Symbol → *Zum Home-Bildschirm*

---

## KI-Import benutzen

1. In der App auf **🤖 KI-Import** → **Prompt kopieren**.
2. Eine KI öffnen (Claude, ChatGPT, Gemini …), den Prompt einfügen und
   **das Rezept anhängen**: Foto, Screenshot, Link oder abgetippter Text.
3. Die KI antwortet mit einem JSON-Block. Diesen kopieren.
4. Zurück in der App: in das Feld **Antwort einfügen** einsetzen → **Prüfen**
   → Vorschau kontrollieren → **Importieren**
   (oder *Zuerst bearbeiten*, wenn du noch etwas anpassen willst).

Der Prompt steht auch in [`KI-PROMPT.md`](KI-PROMPT.md).
Mehrere Rezepte auf einmal gehen auch – die KI antwortet dann mit `{"recipes": [...]}`.

Das Foto selbst landet **nicht** automatisch im Rezept: Bild im Editor über
**📷 Bild wählen** hinzufügen (wird automatisch auf ca. 300 KB verkleinert).

---

## Lokal testen

```bash
python -m http.server 8000
```

Dann `http://localhost:8000` öffnen. (Direkt per Doppelklick auf `index.html`
funktioniert nicht – ES-Module brauchen einen Webserver.)

---

## Aufbau des Codes

| Datei | Zweck |
|---|---|
| `index.html` | Grundgerüst, Login-Maske, Navigation |
| `css/app.css` | Gesamtes Design, Hell/Dunkel-Modus |
| `js/config.js` | **Deine Firebase-Daten, Kategorien, Einheiten** |
| `js/firebase.js` | Firebase-SDK laden und initialisieren |
| `js/auth.js` | Anmeldung, Registrierung, Passwort zurücksetzen |
| `js/store.js` | Lesen/Schreiben in Firestore, Suche, Einkaufsliste |
| `js/schema.js` | Datenmodell eines Rezepts + Normalisierung von Importen |
| `js/prompt.js` | Der KI-Prompt |
| `js/nutrition.js` | Makro-Berechnung pro Portion |
| `js/image.js` | Bilder verkleinern |
| `js/views/*.js` | Die einzelnen Seiten |
| `sw.js` | Service Worker (Offline-Betrieb) |
| `firestore.rules` | Sicherheitsregeln für die Datenbank |

Nach einer Änderung an den Dateien: in `sw.js` die `CACHE_VERSION` erhöhen
(z. B. `v1` → `v2`), damit alle Geräte die neue Version laden.

---

## Kategorien ändern

In `js/config.js` die Liste `CATEGORIES` anpassen – fertig. Bestehende Rezepte
behalten ihre Kategorie; entfernst du eine, werden sie als *Sonstiges* angezeigt.

## Kosten

Alles im Gratis-Rahmen: GitHub Pages ist kostenlos, Firebase Spark ebenso.
Bei zwei Personen und ein paar hundert Rezepten bleibt ihr weit unter allen Limits.
