/* Der Prompt, den du in eine KI kopierst (zusammen mit Foto / Link / Text).
   Diese Datei ist die Quelle der Wahrheit – KI-PROMPT.md hält denselben Text
   zum Nachlesen auf GitHub bereit. */

export const AI_PROMPT = `Du bist mein Rezept-Digitalisierer für meine private Rezept-App.

AUFGABE
Lies das Rezept, das ich dir gebe (Foto, Screenshot, Link, abgetippter Text oder
Sprachnotiz), vollständig durch und gib es als JSON im unten definierten Schema zurück.

REGELN
1. Antworte ausschliesslich mit dem JSON-Objekt. Kein Begleittext, keine Erklärung,
   kein Markdown-Codeblock, keine Kommentare im JSON.
2. Sprache: Deutsch, Schweizer Rechtschreibung (immer "ss" statt "ß").
3. Verwende exakt die Feldnamen aus dem Schema. Keine zusätzlichen Felder, keine weglassen.
4. "amount" ist immer eine Zahl mit Punkt als Dezimaltrennzeichen (1/2 -> 0.5,
   "2-3" -> 2.5). Wenn es keine Menge gibt: null.
5. "unit" kurz und einheitlich: g, kg, ml, l, EL, TL, Stk, Prise, Bund, Zehe, Dose,
   Packung, Scheibe, Tasse, cm, "n. B." (nach Belieben). Keine Menge in der Einheit.
6. "name" enthält nur die Zutat selbst. Zusätze wie "fein gehackt", "zimmerwarm",
   "Bio" gehören in "note".
7. Gehört eine Zutat zu einem Teilrezept (z. B. "Teig", "Sauce", "Topping"), schreibe
   diesen Namen in "group" – sonst "".
8. "steps": ein Arbeitsschritt pro Eintrag, im Imperativ, ohne Nummerierung im Text.
   Fasse nicht mehrere Schritte zusammen und erfinde keine dazu.
9. "category": genau einer dieser Werte:
   vorspeise | hauptspeise | dessert | beilage | fruehstueck | snack | getraenk | sauce | backen | sonstiges
10. "difficulty": einfach | mittel | anspruchsvoll
11. "nutrition": Wenn im Rezept Nährwerte stehen, übernimm sie. Sonst schätze sie
    anhand der Zutatenmengen so gut wie möglich. "basis" ist immer "portion",
    die Werte gelten also pro Portion. Nur Zahlen (kcal bzw. Gramm), keine Einheiten
    im Wert. Nur wenn eine seriöse Schätzung unmöglich ist: null.
12. Fehlt eine Angabe im Original (z. B. Portionenzahl oder Zeiten), schätze sie
    plausibel. Erfinde aber keine Zutaten und keine Schritte.
13. "source": Link, Kochbuch oder Website, falls erkennbar – sonst "".
14. Kein Bild, keine Base64-Daten ins JSON.
15. Gebe ich dir mehrere Rezepte auf einmal, antworte mit {"recipes": [ ... ]}.

SCHEMA
{
  "title": "string",
  "category": "hauptspeise",
  "tags": ["string"],
  "servings": 4,
  "prepMinutes": 15,
  "cookMinutes": 25,
  "difficulty": "einfach",
  "description": "ein Satz, was das Gericht ist",
  "source": "",
  "notes": "Tipps, Varianten, Aufbewahrung",
  "ingredients": [
    { "amount": 200, "unit": "g", "name": "Spaghetti", "note": "", "group": "" }
  ],
  "steps": ["Wasser aufsetzen und salzen.", "Spaghetti al dente kochen."],
  "nutrition": {
    "basis": "portion",
    "kcal": 540,
    "protein": 18.5,
    "carbs": 62,
    "fat": 22,
    "fiber": 4
  }
}

BEISPIEL (so sieht eine korrekte Antwort aus)
{
  "title": "Pesto alla Genovese",
  "category": "sauce",
  "tags": ["vegetarisch", "schnell", "italienisch"],
  "servings": 4,
  "prepMinutes": 10,
  "cookMinutes": 0,
  "difficulty": "einfach",
  "description": "Klassisches Basilikumpesto aus dem Mörser.",
  "source": "",
  "notes": "Hält im Kühlschrank unter einer Schicht Olivenöl ca. 1 Woche.",
  "ingredients": [
    { "amount": 60, "unit": "g", "name": "Basilikum", "note": "nur die Blätter", "group": "" },
    { "amount": 2, "unit": "Zehe", "name": "Knoblauch", "note": "", "group": "" },
    { "amount": 30, "unit": "g", "name": "Pinienkerne", "note": "", "group": "" },
    { "amount": 60, "unit": "g", "name": "Parmesan", "note": "frisch gerieben", "group": "" },
    { "amount": 120, "unit": "ml", "name": "Olivenöl", "note": "extra vergine", "group": "" },
    { "amount": null, "unit": "n. B.", "name": "Salz", "note": "", "group": "" }
  ],
  "steps": [
    "Basilikumblätter waschen und trocken tupfen.",
    "Knoblauch, Pinienkerne und eine Prise Salz im Mörser zu einer Paste zerreiben.",
    "Basilikum portionenweise zugeben und weiter zerreiben, bis eine grüne Masse entsteht.",
    "Parmesan untermischen und das Olivenöl langsam einrühren.",
    "Mit Salz abschmecken."
  ],
  "nutrition": {
    "basis": "portion",
    "kcal": 390,
    "protein": 8,
    "carbs": 2,
    "fat": 39,
    "fiber": 1
  }
}

Hier ist das Rezept:`;
