'use strict';
/* FitScan i18n: German source strings are the keys; t() looks up English and fills {placeholders}. */
const EN = {
  // Navigation & common
  'Tagebuch': 'Diary', 'Lebensmittel': 'Foods', 'Fortschritt': 'Progress', 'Profil': 'Profile', 'Einstellungen': 'Settings',
  'geplant': 'planned', 'Geplant': 'Planned', 'Alle bestätigen': 'Confirm all', 'Als gegessen bestätigen': 'Confirm as eaten', '{name} bestätigt': '{name} confirmed', '{n} bestätigt': '{n} confirmed', 'Als gegessen speichern': 'Save as eaten',
  'Mit Geplantem: {r} kcal übrig': 'With planned: {r} kcal left', 'Mit Geplantem: {r} kcal drüber': 'With planned: {r} kcal over',
  'Mit Drive verbinden': 'Connect Drive', 'Synchronisiere…': 'Syncing…', '{n} nicht synchronisiert · zum Anmelden tippen': '{n} not synced · tap to sign in', 'Zum Anmelden tippen': 'Tap to sign in', '{n} warten · offline': '{n} waiting · offline', 'Offline': 'Offline',
  'Sync-Fehler · tippen': 'Sync error · tap', '{n} nicht synchronisiert': '{n} not synced', 'Synchronisiert': 'Synced', 'Synchronisation': 'Sync', 'Jetzt synchronisieren': 'Sync now', 'Mit Google Drive verbinden': 'Connect Google Drive',
  'Verbunden': 'Connected', 'Anmeldung abgelaufen': 'Sign-in expired', 'Nicht verbunden': 'Not connected', 'Zuletzt {t}': 'Last {t}', '{d}: nicht synchronisiert ({w})': '{d}: not synced ({w})', 'Anmeldung fehlgeschlagen: {m}': 'Sign-in failed: {m}',
  'Vorschläge von außerhalb': 'Suggested changes', 'Änderungen aus Drive, die deine Einträge nicht überschreiben durften': 'Changes from Drive that were not allowed to overwrite your entries', 'Abmelden': 'Sign out',
  'Der Zugriff bleibt in deinem Google-Konto, bis du ihn dort entfernst': 'Access stays in your Google account until you remove it there', 'Abgemeldet': 'Signed out', 'Verwerfen': 'Dismiss',
  'Diese Änderungen kamen aus Drive und haben deine Einträge nicht überschrieben.': 'These changes came from Drive and did not overwrite your entries.', 'Keine Vorschläge.': 'No suggestions.',
  'Planned change to an entry you already ate': 'Planned change to an entry you already ate', 
 'Kalorien- und Makroziele eintragen': 'Enter your calorie and macro goals', 'Kalorien und Makros pro Tag.': 'Calories and macros per day.',
  'Tagebuch, eigene Lebensmittel und Einstellungen werden von diesem Gerät entfernt. Das kann nicht rückgängig gemacht werden.': 'Your diary, custom foods and settings will be removed from this device. This cannot be undone.', 'Scannen': 'Scan', 'Heute': 'Today', 'Gestern': 'Yesterday', 'Morgen': 'Tomorrow',
  'Abbrechen': 'Cancel', 'Schließen': 'Close', 'Speichern': 'Save', 'Löschen': 'Delete', 'Hinzufügen': 'Add', 'Weiter': 'Next', 'Zurück': 'Back', 'Fertig': 'Done', 'Auswählen': 'Select',
  'Rückgängig': 'Undo', 'Gespeichert': 'Saved', 'Gelöscht': 'Deleted', 'Details': 'Details', 'Datum': 'Date', 'Name': 'Name', 'Entfernen': 'Remove', 'Laden': 'Load', 'Importieren': 'Import',
  'Vorherige Woche': 'Previous week', 'Nächste Woche': 'Next week', 'Mahlzeit': 'Meal', 'Menge': 'Amount', 'Einheit': 'Unit', 'Fällig': 'Due', 'Auto': 'Auto',
  // Meals
  'Frühstück': 'Breakfast', 'Mittagessen': 'Lunch', 'Abendessen': 'Dinner', 'Snacks': 'Snacks', 'Mittag': 'Lunch', 'Abend': 'Dinner',
  // Nutrients
  'Kalorien': 'Calories', 'Protein': 'Protein', 'Kohlenhydrate': 'Carbs', 'Fett': 'Fat', 'K': 'C', 'Ballaststoffe': 'Fiber', 'Zucker': 'Sugar', 'davon Zucker': 'of which sugar', 'Salz': 'Salt',
  'Energie': 'Energy', 'Nährwerte': 'Nutrition', 'Nährwerte pro 100 g': 'Nutrition per 100 g', 'Mikronährstoffe': 'Micronutrients', 'Makros': 'Macros',
  'Gesättigte Fettsäuren': 'Saturated fat', 'Natrium': 'Sodium', 'Cholesterin': 'Cholesterol', 'Kalium': 'Potassium', 'Calcium': 'Calcium', 'Magnesium': 'Magnesium', 'Eisen': 'Iron', 'Zink': 'Zinc',
  'Vitamin A': 'Vitamin A', 'Vitamin C': 'Vitamin C', 'Vitamin D': 'Vitamin D', 'Vitamin E': 'Vitamin E', 'Vitamin B12': 'Vitamin B12', 'Vitamin B6': 'Vitamin B6', 'Folat': 'Folate', 'Koffein': 'Caffeine',
  // Diary
  'kcal übrig': 'kcal left', 'kcal drüber': 'kcal over', '{a} von {b} kcal': '{a} of {b} kcal', 'Tage in Folge geloggt': 'Days logged in a row',
  'Ziele festlegen': 'Set your goals', 'Persönliche Kalorien- und Makroziele in einer Minute': 'Personal calorie and macro targets in a minute',
  'Wöchentlicher Check-in': 'Weekly check-in', 'Ziele an deinen echten Verbrauch anpassen': 'Adjust targets to your real expenditure',
  'Ganzen Tag von gestern kopieren': 'Copy all of yesterday', 'Wie gestern': 'Same as yesterday', 'Schnelleintrag': 'Quick add', 'Schnelleintrag bearbeiten': 'Edit quick add',
  'Gewicht': 'Weight', 'Eintragen': 'Log', 'Zuletzt {w} kg': 'Last {w} kg', 'Morgens nüchtern wiegen': 'Weigh in the morning before eating',
  '{n} Einträge kopiert': '{n} entries copied', 'Eintrag gelöscht': 'Entry deleted', 'Eintrag löschen': 'Delete entry',
  'Wasser': 'Water', 'Glas': 'Glass', 'Wasserziel erreicht!': 'Water goal reached!',
  'Intervallfasten': 'Intermittent fasting', 'Fastenziel': 'Fasting goal', 'Letztes Fasten: {h} h': 'Last fast: {h} h', 'Starte nach deiner letzten Mahlzeit.': 'Start after your last meal.',
  'Starten': 'Start', 'Beenden': 'End', 'Ziel erreicht': 'Goal reached', 'Noch {h} h {m} min': '{h} h {m} min to go', 'seit {t}': 'since {t}',
  'Fasten gestartet': 'Fast started', 'Fasten beendet · {h} h': 'Fast ended · {h} h',
  'Nur Kalorien oder Makros – z. B. im Restaurant.': 'Just calories or macros – e.g. at a restaurant.', 'Nur Kalorien oder Makros': 'Just calories or macros', 'Bezeichnung': 'Label',
  '≈ {k} kcal aus Makros': '≈ {k} kcal from macros', 'Bitte Kalorien oder Makros eingeben': 'Please enter calories or macros', '{k} kcal hinzugefügt': '{k} kcal added',
  'Bitte gültiges Gewicht': 'Please enter a valid weight', 'Gewicht gespeichert': 'Weight saved',
  'Berechnet aus {n} geloggten Tagen und deinem Trendgewicht der letzten {d} Tage.': 'Based on {n} logged days and your trend weight over the last {d} days.',
  'Noch zu wenig Daten – Schätzung per Formel. Logge weiter Essen und Gewicht, dann wird es genauer.': 'Not enough data yet – formula estimate. Keep logging food and weight to make it more accurate.',
  'Bisher': 'Current', 'Neu': 'New', 'Keine Änderung nötig': 'No change needed', '{d} kcal pro Tag': '{d} kcal per day', 'Verbrauch': 'Expenditure', 'Trend pro Woche': 'Trend per week',
  'Neue Ziele übernehmen': 'Apply new targets', 'Ziele beibehalten': 'Keep targets', 'Letzte Check-ins': 'Recent check-ins', 'Ziele aktualisiert': 'Targets updated',
  'Tagesdetails': 'Day details', 'Makroverteilung': 'Macro split', 'Anteil an Kalorien': 'Share of calories', '{a} von {b} Einträgen': '{a} of {b} entries',
  'Nur aus Produkten mit Angaben von Open Food Facts.': 'Only from products with Open Food Facts data.',
  'Keine Mikronährstoff-Daten für diesen Tag. Gescannte Produkte liefern oft Werte wie Natrium, Calcium oder Vitamine.': 'No micronutrient data for this day. Scanned products often provide values like sodium, calcium or vitamins.',
  // Foods
  'Zuletzt': 'Recent', 'Favoriten': 'Favorites', 'Scans': 'Scans', 'Eigene': 'Custom', 'Gerichte': 'Recipes', 'Basis': 'Basics', 'Eigenes': 'Custom', 'Gericht': 'Recipe',
  'Hinzufügen zu': 'Add to', 'Lebensmittel oder Barcode': 'Food or barcode', 'Schnell hinzufügen': 'Quick add', 'Bibliothek & Eigene': 'Library & custom',
  'Hier erscheinen zuletzt eingetragene Lebensmittel.': 'Recently logged foods appear here.', 'Noch keine Favoriten. Tippe beim Lebensmittel auf den Stern.': 'No favorites yet. Tap the star on a food.',
  'Hier erscheinen deine gescannten Produkte – auch offline verfügbar.': 'Your scanned products appear here – available offline too.',
  'Eigenes Lebensmittel anlegen': 'Create custom food', 'Mit Nährwerten von der Verpackung': 'With nutrition facts from the package', 'Neues Gericht': 'New recipe',
  'Mehrere Zutaten zu einer Portion kombinieren': 'Combine ingredients into servings', 'Barcode {c} nachschlagen': 'Look up barcode {c}', 'Keine Produkte gefunden.': 'No products found.',
  'Online-Suche gerade nicht erreichbar. Lokale Treffer funktionieren trotzdem.': 'Online search is unavailable right now. Local results still work.',
  '{name} · {k} kcal zu {m}': '{name} · {k} kcal to {m}', '{n} ausgewählt': '{n} selected', 'Zu {m} hinzufügen': 'Add to {m}', '{n} Lebensmittel · {k} kcal hinzugefügt': '{n} foods · {k} kcal added',
  'Gramm': 'Grams', 'Stück': 'Piece', 'Portion': 'Serving', 'Portionen': 'Servings', 'Wie zuletzt': 'Same as last time', 'Favorit': 'Favorite',
  'Zu Favoriten hinzugefügt': 'Added to favorites', 'Aus Favoriten entfernt': 'Removed from favorites', 'Bitte Menge eingeben': 'Please enter an amount', 'Menge zu groß': 'Amount too large',
  '{name} hinzugefügt': '{name} added', 'Gericht bearbeiten': 'Edit recipe', 'Lebensmittel bearbeiten': 'Edit food',
  'Daten: Open Food Facts (ODbL) – Angaben können unvollständig sein.': 'Data: Open Food Facts (ODbL) – information may be incomplete.',
  'Eigenes Lebensmittel': 'Custom food', 'Marke (optional)': 'Brand (optional)', 'z. B. Omas Apfelkuchen': 'e.g. Grandma’s apple pie', 'Bitte Namen eingeben': 'Please enter a name',
  'Barcode {c} ist nicht bei Open Food Facts. Trage die Werte von der Verpackung ein – beim nächsten Scan wird das Produkt erkannt.': 'Barcode {c} is not on Open Food Facts. Enter the values from the package – the product will be recognized on the next scan.',
  '„{n}“ löschen?': 'Delete “{n}”?', 'Bereits eingetragene Mahlzeiten bleiben erhalten.': 'Meals you already logged are kept.',
  'z. B. Protein-Porridge': 'e.g. protein porridge', 'Zutaten': 'Ingredients', 'Noch keine Zutaten': 'No ingredients yet', 'Zutat suchen': 'Search ingredient', 'kcal/Portion': 'kcal/serving',
  'Gericht speichern': 'Save recipe', 'Mindestens eine Zutat': 'At least one ingredient', 'Gericht gespeichert': 'Recipe saved', '{n} Zutaten · {k} kcal/Portion': '{n} ingredients · {k} kcal/serving',
  // Scanner
  'Serienscan an': 'Continuous scan on', 'Serienscan aus': 'Continuous scan off', 'Kamera wird gestartet…': 'Starting camera…', 'Kamera nicht verfügbar': 'Camera not available',
  'Kamera braucht HTTPS': 'Camera needs HTTPS', 'Kein Kamerazugriff': 'No camera access', 'Barcode in den Rahmen halten': 'Hold the barcode inside the frame',
  '{e} – nutze „Nummer eingeben“ oder „Foto“.': '{e} – use “Enter number” or “Photo”.', 'QR-Code erkannt': 'QR code detected', 'Dieser Code enthält keine Produktnummer.': 'This code contains no product number.',
  'Suche {c}…': 'Looking up {c}…', '{c}: nicht gefunden': '{c}: not found', 'Hinzugefügt – nächsten Barcode scannen': 'Added – scan the next barcode', 'Keine Verbindung': 'No connection',
  'Licht nicht unterstützt': 'Torch not supported', 'Foto wird gelesen…': 'Reading photo…', 'Kein Barcode im Foto gefunden': 'No barcode found in photo',
  'Barcode eingeben': 'Enter barcode', 'Die Ziffern unter dem Strichcode (EAN/UPC, 8–13 Stellen).': 'The digits under the barcode (EAN/UPC, 8–13 digits).', 'Barcode': 'Barcode',
  'Produkt suchen': 'Find product', 'Ungültiger Code': 'Invalid code', 'Produkt nicht gefunden': 'Product not found', 'Lebensmittel anlegen': 'Create food',
  'Der Barcode {c} ist noch nicht bei Open Food Facts. Lege das Produkt selbst an – es wird lokal gespeichert und beim nächsten Scan erkannt.': 'Barcode {c} is not on Open Food Facts yet. Create the product yourself – it is saved locally and recognized on the next scan.',
  'Hinweis: Für dieses Produkt fehlen Nährwerte – bitte prüfen': 'Note: nutrition data missing for this product – please check', 'Aus lokalem Speicher (offline verfügbar)': 'From local storage (available offline)',
  'Open Food Facts ist gerade nicht erreichbar. Versuche es gleich nochmal oder lege das Produkt selbst an.': 'Open Food Facts is unreachable right now. Try again shortly or create the product yourself.',
  'Erneut versuchen': 'Try again', 'Selbst anlegen': 'Create it yourself', 'Nummer eingeben': 'Enter number', 'Foto': 'Photo', 'Licht': 'Torch',
  // Progress
  'Wiegen': 'Weigh in', 'Zuletzt {d} · {k} kcal': 'Last {d} · {k} kcal',
  'Passt dein Kalorienziel jede Woche an': 'Adjusts your calorie target every week', 'Trendgewicht': 'Trend weight', 'Waage': 'Scale', 'Pro Woche': 'Per week',
  'Wochenschnitt': 'Weekly avg', 'Körpermaße': 'Body', '7T': '7D', '30T': '30D', '90T': '90D', '1J': '1Y', 'Alles': 'All',
  'Diese Woche': 'This week', '{n} von 7 Tagen geloggt': '{n} of 7 days logged', 'Ø Kalorien': 'Avg calories', '{d} vs. Vorwoche': '{d} vs. last week', 'Ø Protein': 'Avg protein',
  'Ziel {g} g': 'Goal {g} g', 'Im Zielbereich': 'On target', 'Tage ±10 % vom Kalorienziel': 'Days within ±10% of calorie goal', 'Proteinziel erreicht': 'Protein goal hit', 'Tage · Serie {s}': 'Days · streak {s}',
  'Energieverbrauch': 'Energy expenditure', 'adaptiv': 'adaptive', 'Geschätzter Verbrauch (letzte {n} Tage)': 'Estimated expenditure (last {n} days)',
  'Ø Aufnahme {i} kcal · Trend {c} kg · {n} Tage geloggt. Berechnet aus Aufnahme und Veränderung des Trendgewichts (7.700 kcal ≈ 1 kg).': 'Avg intake {i} kcal · trend {c} kg · {n} days logged. Calculated from intake and the change in trend weight (7,700 kcal ≈ 1 kg).',
  'Logge etwa zwei Wochen lang Essen und wiege dich regelmäßig. Dann berechnet FitScan deinen tatsächlichen Verbrauch – genauer als jede Formel.': 'Log your food for about two weeks and weigh in regularly. FitScan then calculates your actual expenditure – more accurate than any formula.',
  'Messen': 'Measure', 'Zuletzt {a} · Veränderung seit {b}': 'Last {a} · change since {b}', 'Taille, Hüfte, Brust & Co. zeigen Fortschritt, den die Waage nicht sieht.': 'Waist, hips, chest & co. show progress the scale can’t see.',
  'Wiegungen': 'Weigh-ins', 'Trend': 'Trend', 'Noch keine Einträge': 'No entries yet', 'Linie': 'Line', 'Balken': 'Bars', '7-Tage-Mittel': '7-day average', 'Keine Glättung': 'No smoothing',
  'Ziel': 'Goal', 'Min {a} · Max {b} kg · {n} Wiegungen': 'Min {a} · max {b} kg · {n} weigh-ins', 'Noch keine Gewichtsdaten in diesem Zeitraum.': 'No weight data in this period yet.',
  'Geglättet': 'Smoothed', 'Ø {a} {u} an {n} geloggten Tagen': 'Avg {a} {u} on {n} logged days', 'Keine Einträge in diesem Zeitraum.': 'No entries in this period.',
  'Kalorien aus Makros pro Tag (Protein und Kohlenhydrate × 4, Fett × 9).': 'Calories from macros per day (protein and carbs × 4, fat × 9).', 'KW {d}': 'Wk {d}', 'Ø kcal pro Tag': 'Avg kcal per day',
  'Durchschnittliche Kalorien pro Woche im Vergleich zum Ziel.': 'Average calories per week compared to your goal.', 'Ø Aufnahme 7 Tage': 'Avg intake 7 days',
  'Geschätzter Verbrauch aus Aufnahme und Trendgewicht (rollierend, 21–28 Tage).': 'Estimated expenditure from intake and trend weight (rolling, 21–28 days).',
  'Wähle das Maß unten aus.': 'Pick a measurement below.', 'Noch keine Körpermaße erfasst.': 'No body measurements yet.', 'Leere Felder werden ignoriert.': 'Empty fields are ignored.',
  'Bitte mindestens einen Wert eingeben': 'Please enter at least one value',
  'Taille': 'Waist', 'Hüfte': 'Hips', 'Brust': 'Chest', 'Oberarm': 'Upper arm', 'Oberschenkel': 'Thigh', 'Hals': 'Neck', 'Körperfett': 'Body fat',
  // Profile & settings
  'Dein Tagesziel': 'Your daily target', '{r} kg pro Woche': '{r} kg per week', 'manuell angepasst': 'adjusted manually', 'Ziele': 'Goals', 'Profil & Ziel': 'Profile & goal',
  'Noch nicht eingerichtet': 'Not set up yet', 'Tagesziele anpassen': 'Adjust daily targets', 'Kalorien und Makros manuell festlegen': 'Set calories and macros manually',
  'Zuletzt {d}': 'Last {d}', 'Ziel an echten Verbrauch anpassen': 'Match your target to real expenditure', 'Wasser-Tracker': 'Water tracker', 'Wasserziel': 'Water goal', 'Glasgröße': 'Glass size',
  'Fasten-Timer im Tagebuch anzeigen': 'Show the fasting timer in the diary', 'Scanner': 'Scanner', 'Ton beim Scannen': 'Beep on scan', 'Serienscan': 'Continuous scan',
  'Produkte direkt hinzufügen, Kamera bleibt offen': 'Add products directly, camera stays open', 'Darstellung': 'Appearance', 'Design': 'Theme', 'Hell': 'Light', 'Dunkel': 'Dark', 'Sprache': 'Language',
  'Daten': 'Data', 'Backup exportieren': 'Export backup', 'Alle Daten als JSON-Datei': 'All data as a JSON file', 'Backup importieren': 'Import backup', 'Ersetzt die aktuellen Daten': 'Replaces your current data',
  'Tagebuch als CSV': 'Diary as CSV', 'Körperdaten als CSV': 'Body data as CSV', 'Gewicht, Wasser und Maße': 'Weight, water and measurements', 'Demo-Daten laden': 'Load demo data',
  'Sechs Wochen Beispieldaten': 'Six weeks of sample data', 'Einrichtung erneut starten': 'Run setup again', 'Alle Daten löschen': 'Delete all data',
  'Alles bleibt auf diesem Gerät – kein Konto, keine Cloud, keine Paywall.': 'Everything stays on this device – no account, no cloud, no paywall.',
  '{p} Produkte offline · {b} Basis-Lebensmittel': '{p} products offline · {b} basic foods', 'Ungültige Backup-Datei': 'Invalid backup file', 'Backup importieren?': 'Import backup?',
  'Deine aktuellen Daten werden durch das Backup ersetzt.': 'Your current data will be replaced by the backup.', 'Backup importiert': 'Backup imported', 'Demo-Daten laden?': 'Load demo data?',
  'Die letzten sechs Wochen im Tagebuch werden mit Beispieldaten überschrieben.': 'The last six weeks of your diary will be overwritten with sample data.', 'Demo-Daten geladen': 'Demo data loaded',
  'Alle Daten löschen?': 'Delete all data?', 'Tagebuch, Gewicht, eigene Lebensmittel und Einstellungen werden von diesem Gerät entfernt. Das kann nicht rückgängig gemacht werden.': 'Your diary, weight, custom foods and settings will be removed from this device. This cannot be undone.',
  'Alle Daten gelöscht': 'All data deleted', 'Männlich': 'Male', 'Weiblich': 'Female', '{n} Jahre': '{n} years', 'Alter': 'Age', 'J.': 'yrs', 'Größe': 'Height', 'Aktivität': 'Activity', 'Tempo': 'Pace',
  'Grundumsatz {b} kcal · Gesamtumsatz ≈ {t} kcal': 'BMR {b} kcal · TDEE ≈ {t} kcal', 'Ziele berechnen & übernehmen': 'Calculate & apply goals', 'Bitte Werte prüfen': 'Please check the values',
  'Ziele übernommen': 'Goals applied', 'Tagesziele': 'Daily targets', 'Überschreibt die berechneten Ziele bis zum nächsten Check-in.': 'Overrides the calculated targets until the next check-in.',
  'Makros ergeben {a} kcal (Ziel {b} kcal)': 'Macros add up to {a} kcal (goal {b} kcal)', 'Bitte mindestens 800 kcal': 'Please enter at least 800 kcal',
  'Speicher voll – bitte Backup exportieren': 'Storage full – please export a backup',
  'Abnehmen': 'Lose weight', 'Fett verlieren, Muskeln erhalten': 'Lose fat, keep muscle', 'Gewicht halten': 'Maintain weight', 'Gesund essen, Form halten': 'Eat well, stay in shape',
  'Aufbauen': 'Build muscle', 'Muskeln und Gewicht zulegen': 'Gain muscle and weight',
  'Kaum aktiv': 'Sedentary', 'Bürojob, wenig Sport': 'Desk job, little exercise', 'Leicht aktiv': 'Lightly active', '1–3× Sport pro Woche': 'Exercise 1–3× per week',
  'Mäßig aktiv': 'Moderately active', '3–5× Sport pro Woche': 'Exercise 3–5× per week', 'Sehr aktiv': 'Very active', '6–7× Sport pro Woche': 'Exercise 6–7× per week',
  'Extrem aktiv': 'Extremely active', 'Körperliche Arbeit und Sport': 'Physical job and exercise',
  // Onboarding
  'Kalorien und Makros tracken. Unbegrenzt scannen, ohne Konto – deine Daten bleiben auf deinem Gerät.': 'Track calories and macros. Unlimited scans, no account – your data stays on your device.',
  "Los geht's": "Let's go", 'Überspringen': 'Skip', 'Was ist dein Ziel?': 'What is your goal?', 'Über dich': 'About you',
  'Für die erste Schätzung deines Verbrauchs. Danach lernt FitScan aus deinen echten Daten.': 'For the first estimate of your expenditure. After that, FitScan learns from your real data.',
  'Wie aktiv bist du?': 'How active are you?', 'Dein Plan': 'Your plan', 'pro Tag': 'per day', 'Plan übernehmen': 'Use this plan', 'Plan übernommen – viel Erfolg!': 'Plan saved – good luck!',
  'Geschätzter Verbrauch ≈ {t} kcal. Der wöchentliche Check-in passt dein Ziel an deinen gemessenen Verbrauch an.': 'Estimated expenditure ≈ {t} kcal. The weekly check-in adjusts your target to your measured expenditure.',
  // CSV
  'Lebensmittel': 'Foods', 'Marke': 'Brand', 'Menge (g)': 'Amount (g)', 'Protein (g)': 'Protein (g)', 'Kohlenhydrate (g)': 'Carbs (g)', 'Fett (g)': 'Fat (g)', 'Zucker (g)': 'Sugar (g)',
  'Ballaststoffe (g)': 'Fiber (g)', 'Salz (g)': 'Salt (g)', 'Gewicht (kg)': 'Weight (kg)', 'Trend (kg)': 'Trend (kg)', 'Wasser (ml)': 'Water (ml)',
  // Food categories
  'Milchprodukte': 'Dairy', 'Obst': 'Fruit', 'Gemüse': 'Vegetables', 'Getreide': 'Grains', 'Beilagen': 'Sides', 'Brot': 'Bread', 'Käse': 'Cheese', 'Fette': 'Fats & oils', 'Eier': 'Eggs',
  'Fleisch': 'Meat', 'Wurst': 'Cold cuts', 'Fisch': 'Fish', 'Hülsenfrüchte': 'Legumes', 'Nüsse': 'Nuts & seeds', 'Süßes': 'Sweets', 'Supplemente': 'Supplements', 'Getränke': 'Drinks',
  'Saucen': 'Sauces', 'Trockenobst': 'Dried fruit',
};
let LANG = 'de';
const LOC = () => LANG === 'en' ? 'en-US' : 'de-DE';
const I18N_MISSING = new Set();
function t(s, vars) {
  let r = s;
  if (LANG === 'en' && s) { if (EN[s] != null) r = EN[s]; else I18N_MISSING.add(s); }
  return vars ? String(r).replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m) : r;
}
// Food categories & serving labels (food names themselves are never translated)
const UNITS_EN = { Scheibe: 'slice', Portion: 'serving', Stück: 'piece', Glas: 'glass', Tasse: 'cup', Dose: 'can', EL: 'tbsp', TL: 'tsp', Handvoll: 'handful', Becher: 'tub', Riegel: 'bar', Kugel: 'scoop', Flasche: 'bottle',
  Messlöffel: 'scoop', Packung: 'pack', Schale: 'bowl', Teller: 'plate', Stange: 'stalk', Zehe: 'clove', Filet: 'fillet', Wurst: 'sausage', Würstchen: 'sausage', Brötchen: 'roll', Ei: 'egg', Eiweiß: 'egg white',
  Eigelb: 'egg yolk', Keks: 'cookie', Waffel: 'waffle', Stäbchen: 'stick' };
function tFood(s) {
  if (!s) return '';
  if (LANG !== 'en') return s;
  if (s === 'Gerichte') return 'Dishes';
  if (EN[s] != null) return EN[s];
  return String(s).replace(/Portion: /g, 'Serving: ').replace(/× Portion\b/g, '× serving').replace(/^Portion$/, 'Serving')
    .replace(/(\d+(?:[.,]\d+)?) (Scheibe|Portion|Stück|Glas|Tasse|Dose|EL|TL|Handvoll|Becher|Riegel|Kugel|Flasche|Messlöffel|Packung|Schale|Teller|Stange|Zehe|Filet|Würstchen|Wurst|Brötchen|Eiweiß|Eigelb|Ei|Keks|Waffel|Stäbchen)(?![a-zäöüß])( roh)?/g,
      (m, n, u, raw) => `${n} ${UNITS_EN[u]}${raw ? ' raw' : ''}`)
    .replace(/\bca\. /g, 'approx. ');
}
function applyLang(lang) {
  LANG = lang === 'en' ? 'en' : 'de'; document.documentElement.lang = LANG;
  document.querySelectorAll('[data-t]').forEach(el => el.textContent = t(el.dataset.t));
  document.querySelectorAll('[data-tl]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.tl)); el.title = t(el.dataset.tl); });
}
