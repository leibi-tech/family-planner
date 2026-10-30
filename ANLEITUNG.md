# ANLEITUNG – Family-Planner

App-Adresse: **https://leibi-tech.github.io/family-planner/**

## A) Einmalig: GitHub Desktop installieren
1. Gehe auf **desktop.github.com**, lade das Programm herunter, installiere es und melde dich mit deinem GitHub-Konto (leibi-tech) an.

## B) Einmalig: Ordner mit GitHub verbinden
1. Klicke in GitHub Desktop auf **Add an Existing Repository from your local drive…**.
2. Wähle mit **Choose…** den Ordner `C:\Users\tleibacher\Claude\Family-Planner` und klicke auf **Add Repository**.
3. Es erscheint der Hinweis «This directory does not appear to be a Git repository». Klicke dort auf den blauen Link **create a repository**.
4. Lass alles wie es ist («Git ignore: None», «License: None») und klicke auf **Create repository**.
5. Die Verbindung zu GitHub (Remote `https://github.com/leibi-tech/family-planner.git`) einrichten, unter **Repository** und dann **Repository settings…**. *(Erledigt am 22.10.2026.)*
6. Klicke oben auf **Publish branch**. Nicht auf «Publish repository» klicken.

## C) Einmalig: GitHub Pages einschalten
1. Öffne **github.com/leibi-tech/family-planner**.
2. Klicke oben auf **Settings** und links auf **Pages**.
3. Bei «Source» wählst du **Deploy from a branch**.
4. Bei «Branch» wählst du **main**, daneben den Ordner **/docs**, und klickst dann auf **Save**.
5. Nach 1–2 Minuten ist die App unter der Adresse oben erreichbar.

## D) App auf dem Handy installieren
1. Öffne die App-Adresse in **Chrome** auf dem Handy.
2. Tippe oben rechts auf das Menü **⋮** und dann auf **Zum Startbildschirm hinzufügen** bzw. **App installieren**.
3. Ab jetzt startest du die App über das Symbol auf dem Startbildschirm.

## E) Updates
1. Öffne **GitHub Desktop**. Links siehst du die geänderten Dateien von Claude.
2. Schreibe unten links bei «Summary» z.B. `Update` und klicke auf **Commit to main**.
3. Klicke oben auf **Push origin**.
4. Öffne nach 1–2 Minuten die App auf dem Handy mit Internet. Nach kurzer Zeit lädt sie neu, und unten steht die neue Version mit Datum. Falls nicht: App ganz schliessen und neu öffnen.

## G) Einmalig: Supabase einrichten (Phase 2)
1. Gehe auf **supabase.com**, klicke auf **Start your project** und melde dich mit **Continue with GitHub** an (Konto leibi-tech).
2. Klicke auf **New project**: Name `family-planner`, ein **Database Password** wählen und gut aufbewahren (z.B. Passwort-Manager), Region **Central EU (Frankfurt)**, Plan **Free**. Dann **Create new project** und ca. 2 Minuten warten.
3. Links auf **SQL Editor**, dann **New query**. Die Datei `supabase\schema.sql` aus dem Ordner mit dem Editor öffnen, alles kopieren (Ctrl+A, Ctrl+C), in Supabase einfügen und auf **Run** klicken. Unten muss «Success. No rows returned» stehen.
4. Links auf **Authentication**, dann **Sign In / Providers** (bzw. **Providers**), dann **Email**: den Schalter **Confirm email** ausschalten und speichern. *(Grund: Ohne eigenen E-Mail-Dienst verschickt Supabase nur wenige Mails und nur an die Projekt-Mitglieder. Wir melden uns darum mit E-Mail + Passwort an, ohne Bestätigungsmail.)*
5. Unter **Authentication**, dann **URL Configuration**: bei «Site URL» `https://leibi-tech.github.io/family-planner/` eintragen und speichern.
6. Links unten auf **Project Settings** (Zahnrad), dann **API** bzw. **Data API / API Keys**. Die **Project URL** (`https://….supabase.co`) und den Schlüssel **anon public** (oder «publishable», beginnt mit `eyJ…` oder `sb_publishable_…`) an Claude schicken. Diese zwei Angaben sind für die App gedacht und dürfen öffentlich sein, die Sicherheitsregeln schützen eure Daten. **Nie** den Schlüssel «service_role» oder «secret» weitergeben.

## H) Gemeinsam nutzen (ab Version 0.8.0)
**Admin (wer die Familie erstellt), einmalig:**
1. Unter **Familie** alle Personen mit ihrem richtigen Vornamen erfassen (z.B. Tobias, Thadea, …).
2. Oben **«Gemeinsam nutzen»** → **Neues Konto** → E-Mail + Passwort → **Konto erstellen**.
3. Haushalt-Namen eingeben → **Haushalt erstellen**. Danach fragt die App **«Wer bist du?»** → eigenen Namen antippen.
4. Den **Einladungscode** mit **Code teilen** verschicken. Nur Admins sehen den Code.

**Weitere Familienmitglieder:**
1. App installieren (Abschnitt D) → **Familie** → **«Gemeinsam nutzen»** → **Neues Konto**.
2. **Code** und **eigenen Vornamen** (so wie ihn der Admin erfasst hat) eingeben → **Beitreten** → **Ja, beitreten**. Stimmt eines davon nicht, erscheint «Code oder Name falsch».

**Rollen:**
- **Admin:** darf Personen und Faktoren ändern, sieht den Einladungscode und alle Mitglieder mit E-Mail. Er kann Mitglieder zu Admins machen, ihnen eine Person zuordnen oder sie entfernen.
- **Mitglied:** plant Menüs, Wochenplan und Einkauf, ändert aber keine Personen oder Faktoren.
- **Faktoren** sieht jede Person aus ihrer eigenen Sicht: man selbst ist immer 1.0.

**Im Alltag:** Änderungen werden automatisch abgeglichen (kurz nach jeder Änderung, beim Öffnen der App und alle 30 Sekunden). Ohne Internet funktioniert alles weiter, abgeglichen wird, sobald wieder Internet da ist. Oben rechts zeigt ☁︎ an, dass die App verbunden ist (⟳ = gleicht gerade ab, ⚠︎ = Problem, antippen für Details).

**Neues Handy:** App installieren → «Gemeinsam nutzen» → **Anmelden** → «auf diesem Handy verwenden».

## I) Einmalig: Link-Import in Supabase einrichten (ab Version 0.9.0)
Der Import aus **Text** funktioniert sofort. Für den Import per **Link** braucht es eine kleine Funktion in Supabase:
1. Öffne **supabase.com**, dein Projekt **family-planner**.
2. Links auf **Edge Functions** klicken, dann **Deploy a new function** und **Via Editor**.
3. Den Namen oben auf **`rezept-import`** ändern (genau so geschrieben).
4. Im Ordner die Datei `supabase\functions\rezept-import\index-zum-kopieren.txt` öffnen (Doppelklick; bei `index.ts` hingegen Rechtsklick → «Im Editor bearbeiten», sonst öffnet Windows den Medienplayer), alles kopieren (Ctrl+A, Ctrl+C), im Supabase-Editor den Beispieltext ganz ersetzen (Ctrl+A, Ctrl+V).
5. Unten rechts auf **Deploy function** klicken und warten, bis es fertig ist.
6. In der Funktion auf **Details** bzw. **Settings**: den Schalter **Verify JWT** (oder «Enforce JWT verification») **ausschalten** und speichern. *(Die Funktion prüft selbst, ob jemand angemeldet ist.)*

## J) Menü importieren
1. **Menüs** → **⤓ Importieren**.
2. Einen **Link** zu einem Rezept einfügen (z.B. in Chrome bei Fooby: Teilen → Link kopieren) oder den **Rezepttext** kopieren und einfügen. Mit **📋 Aus Zwischenablage einfügen** geht das mit einem Tipp.
3. **Weiter zum Prüfen**: Namen, Mahlzeit, Portionen und Zutaten kontrollieren. Unter jeder Zutat steht die Originalzeile, ⚠️ heisst «genau anschauen».
   - **Meine Portion:** Unter der Portionenzahl steht z.B. «Meine Portion Spaghetti: 125 g ✎». Antippen, die gewünschte Menge eingeben (z.B. 150) und **OK**: Die App rechnet alles um. Massgebend ist die oberste Zutat mit Menge, darum die Hauptzutat zuoberst lassen.
   - Eine Portion gilt immer für die Person, die erfasst. Thadea gibt also ein, was für sie stimmt.
4. Erst **Speichern** legt das Menü an. **Abbrechen** führt zurück zum eingefügten Text.
- **Rezept auf Papier oder Foto:** Mit **Google Lens** (Kamera-App oder Google-App) den Text markieren, «Kopieren» und in der App einfügen.
- **Link geht nicht?** Manche Seiten enthalten keine lesbaren Rezeptangaben. Dann Zutaten und Zubereitung auf der Seite markieren, kopieren und als Text einfügen.
- Der Link-Import braucht Internet und ein Konto («Gemeinsam nutzen»).

## K) Datenbank-Update für private ToDos (ab Version 0.10.0, einmalig)
1. Öffne supabase.com → euer Projekt → links **SQL Editor**.
2. Prüfe oben rechts: Dort muss **Database** stehen (nicht «Logs»).
3. Öffne im Ordner Family-Planner die Datei `supabase/update-0.10.sql` (Rechtsklick → Öffnen mit → Editor), alles markieren (Ctrl+A), kopieren (Ctrl+C).
4. Im SQL Editor einfügen (Ctrl+V) und auf **Run** klicken. Es sollte «Success» erscheinen.
5. Ohne dieses Update erscheint beim Speichern eines privaten ToDos eine Meldung, und private ToDos werden nicht abgeglichen.

## L) ToDos und Ämtli
- **ToDo erfassen:** Text eintippen und Enter = schnell. Mit **+** kannst du zusätzlich Datum, Personen, Notiz und «🔒 Privat» wählen.
- **Abhaken:** Kästchen links antippen. Antippen des Textes öffnet das ToDo zum Bearbeiten.
- **Meine / Alle** umschalten, oder darunter eine Person antippen, um nur ihre ToDos zu sehen (private der anderen sind nie sichtbar). Die rote Zahl unten am ToDo-Knopf zeigt deine offenen ToDos.
- **Ämtli erfassen:** «Ämtli-Plan» → «+ Ämtli erfassen». Wiederholung, ersten Termin und Personen wählen. Bei «Abwechselnd» die Personen in der gewünschten Reihenfolge antippen. Unten siehst du die nächsten 4 Termine.
- Das Ämtli erscheint in seiner Woche automatisch bei den ToDos (🔁). Unten im Ämtli-Plan siehst du pro Woche, wer was erledigt hat.

## M) Notizen und Listen (ab Version 0.11.0)
Kein Datenbank-Update nötig. Einfach hochladen wie immer (siehe E).
- **Neu erfassen:** Unten auf «Notizen», dann «+ Notiz» (Titel und Text) oder «+ Liste» (Punkte zum Abhaken). Gespeichert wird automatisch, einen Speichern-Knopf gibt es nicht. Mit «‹ Zurück» gehst du zur Übersicht.
- **Liste:** Unten «Neuer Punkt …» eintippen und Enter. Kästchen antippen = erledigt (rutscht nach unten). Text antippen = ändern oder löschen (✕). Mit dem Pfeil ⤷ rechts fügst du einen **Unterpunkt** hinzu. «Erledigte entfernen» räumt auf.
- **Schloss oben rechts:** 🔓 = alle in der Familie sehen es und können es bearbeiten. 🔒 = **privat**, nur du siehst es. Zum Umstellen tippst du aufs Schloss und bestätigst.
- **Pin (📌) oben rechts:** «Für mich anheften» oder «Für alle anheften» (📌📌). Angeheftetes steht in der Übersicht oben und erscheint später auf der Startseite. Jede Person kann es bei sich selbst wieder lösen («Bei mir lösen»). Private Einträge kannst du nur für dich anheften.
- **Als ToDo anheften (✅ oben rechts, ab 0.11.1):** Tippe aufs ✅. Du wählst «Nur für mich» oder «Für alle» (offen, wer Zeit hat) und kannst ein Datum setzen oder weglassen. Bei einer **privaten** Notiz fällt die Frage weg: Das ToDo wird auch privat. Im ToDo siehst du 📝; im ToDo-Fenster führt «Notiz öffnen» (bzw. «Liste öffnen») direkt zurück zur Notiz.
- Wenn zwei Personen gleichzeitig dieselbe Liste ändern, werden die Punkte zusammengeführt. Bei einer Notiz mit Text gewinnt die zuletzt gespeicherte Fassung.

## N) Startseite (ab Version 0.12.0)
Kein Datenbank-Update nötig. Einfach hochladen wie immer (siehe E).
- **Die App startet immer auf der Startseite** (Knopf «Start» unten, grün hervorgehoben).
- **Was kochen wir heute?** Die Menüs von heute. Menünamen antippen öffnet das Menü; mit «Schliessen» kommst du wieder zur Startseite. «Plan ›» öffnet den Wochenplan.
- **Meine ToDos:** deine offenen ToDos, Überfälliges zuerst (max. 5, darunter «+ n weitere»). Kästchen antippen = erledigt, Text antippen = ToDo öffnen.
- **Angeheftet:** Notizen und Listen mit Pin (📌). Bei Listen siehst du die ersten 5 offenen Punkte und kannst sie direkt abhaken. Das ✕ rechts löst die Anheftung nur bei dir.
- **Zuletzt geändert:** die neusten Notizen und Listen mit Name und Zeit.
- **Mehr** (unten rechts): Wochenplan, Menüs und Familie. Oben links bringt dich der Pfeil ‹ zurück zu «Mehr».

## O) Passwort ändern (ab Version 0.13.0)
Kein Datenbank-Update nötig. Einfach hochladen wie immer (siehe E).
1. In der App: unten **Mehr**, dann **Familie**, dann die Karte **Gemeinsam: …** antippen.
2. Ganz unten **Passwort ändern** antippen.
3. Bisheriges Passwort eingeben, dann zweimal das neue (mindestens 8 Zeichen, anders als das bisherige).
4. **Passwort speichern**. Es erscheint «Passwort geändert ✓». Du bleibst angemeldet; auf dem Handy der anderen Person ändert sich nichts.
- **Passwort vergessen?** Das kommt als nächster Schritt (braucht einen kostenlosen E-Mail-Dienst, ich schreibe dir dann die Anleitung). Bis dahin kann in Supabase unter *Authentication → Users* bei einem Konto ein neues Passwort gesetzt werden (ich zeige dir bei Bedarf wo).

## P) Kalender mit Google einrichten (ab Version 0.14.0, einmalig)
Das ist der aufwendigste Teil bisher (ca. 20 Minuten), muss aber nur **einmal** gemacht werden. Mach es am PC.

**Teil 1 – Google-Projekt (gratis)**
1. Öffne **console.cloud.google.com** und melde dich mit deinem Google-Konto an (Bedingungen akzeptieren).
2. Oben links neben «Google Cloud» auf die **Projektauswahl** klicken → **Neues Projekt**. Name: `Family-Planner` → **Erstellen**. Danach oben sicherstellen, dass dieses Projekt ausgewählt ist.
3. Oben im Suchfeld **Google Calendar API** eingeben, öffnen und **Aktivieren** klicken.
4. Im Suchfeld **Google Auth Platform** (oder «OAuth-Zustimmungsbildschirm») öffnen → **Jetzt starten** / **Get started**:
   - App-Name: `Family-Planner`, Support-E-Mail: deine Gmail-Adresse → Weiter
   - Zielgruppe: **Extern** → Weiter
   - Kontakt-E-Mail: deine Gmail-Adresse → Weiter → Richtlinie akzeptieren → **Erstellen**
5. Links auf **Clients** → **Client erstellen**:
   - Anwendungstyp: **Webanwendung**, Name: `Family-Planner`
   - Unten bei **Autorisierte Weiterleitungs-URIs** auf **URI hinzufügen** und genau das eintragen:
     `https://hkakelobqtbyliszrils.supabase.co/functions/v1/google-kalender`
   - **Erstellen**. Es erscheinen **Client-ID** und **Clientschlüssel**. Fenster offen lassen (oder als JSON herunterladen). ⚠️ Den Clientschlüssel **nicht** in den Chat kopieren.
6. Links auf **Branding** und ergänzen (Google verlangt das für «In Produktion»):
   - Startseite der App: `https://leibi-tech.github.io/family-planner/`
   - Link zur Datenschutzerklärung: `https://leibi-tech.github.io/family-planner/datenschutz.html` *(die Seite ist in Version 0.14.0 dabei, also zuerst hochladen, siehe E)*
   - Link zu den Nutzungsbedingungen: leer lassen
   - **Autorisierte Domains:** `leibi-tech.github.io` und `hkakelobqtbyliszrils.supabase.co` hinzufügen (falls Google eine nicht annimmt: weglassen und melden)
   - Unten **Speichern**.
   Danach links auf **Zielgruppe** (Audience) → **App veröffentlichen** → bestätigen. Der Status heisst danach **«In Produktion»**. *(Ohne das läuft die Verbindung nach 7 Tagen ab.)* Eine Überprüfung durch Google braucht es für uns nicht.

**Teil 2 – Supabase**
7. supabase.com → Projekt **family-planner** → **SQL Editor** → Inhalt von `supabase\update-0.14.sql` einfügen → **Run** (oben rechts muss «Database» stehen).
8. Links **Edge Functions** → **Secrets** (bzw. «Manage secrets»): zwei Einträge hinzufügen und speichern:
   - Name `GOOGLE_CLIENT_ID` → Wert: die Client-ID aus Schritt 5
   - Name `GOOGLE_CLIENT_SECRET` → Wert: der Clientschlüssel aus Schritt 5
9. **Edge Functions** → **Deploy a new function** → **Via Editor**. Name oben: **`google-kalender`** (genau so). Datei `supabase\functions\google-kalender\index-zum-kopieren.txt` öffnen, alles kopieren und den Beispieltext im Editor ganz ersetzen → **Deploy function**.
10. In der Funktion unter **Details/Settings** den Schalter **Verify JWT** **ausschalten** und speichern.

**Teil 3 – App**
11. Neue Version hochladen wie immer (siehe E) und die App auf dem Handy einmal schliessen und neu öffnen.
12. In der App: **Mehr → Kalender → Mit Google verbinden**. Google zeigt **«Google hat diese App nicht überprüft»** → **Erweitert** → **Weiter zu Family-Planner (unsicher)**. Das ist normal, weil die App nur für uns ist. Dann den Zugriff auf den Kalender erlauben (alle Häkchen setzen).
13. Zurück in der App: Kalender wählen. Dein Hauptkalender ist als **«Mein Kalender»** vorgeschlagen. Euren gemeinsamen Kalender auf **«Familie»** stellen. **Auswahl speichern**.
14. **Thadea** macht auf ihrem Handy Schritt 12 und 13 mit ihrem eigenen Google-Konto.

**Familienkalender (falls ihr noch keinen habt):** In Google Kalender am PC links bei «Weitere Kalender» auf **+** → **Neuen Kalender erstellen**, Name `Familie`. Danach in seinen Einstellungen bei **«Für bestimmte Personen freigeben»** Thadeas Gmail-Adresse mit **«Änderungen an Terminen vornehmen»** hinzufügen.

**So funktioniert der Kalender (Version 0.14.0):**
- Monatsansicht mit farbigen Balken pro Person, darunter die Termine des gewählten Tages. Tag antippen = Termine dieses Tages. **Heute** springt zurück.
- Oben Knöpfe pro Person und «Familie»: antippen blendet aus bzw. wieder ein. Beim Öffnen sind immer alle sichtbar.
- Termin antippen zeigt Details und den Link «In Google Kalender öffnen».
- **Ohne Internet** siehst du den letzten Stand (unten «Offline · Stand …»). Online wird alle 5 Minuten aufgefrischt, mit «⟳ Aktualisieren» sofort.
- **Ändern und Erfassen** von Terminen: siehe Q (ab Version 0.15.0).
- Alles, was du unter «Mein Kalender» auswählst, sehen alle in der Familie. Private Kalender einfach auf «Nicht zeigen» lassen.

## Q) Termine erfassen und ändern (ab Version 0.15.0)
**Einmalig in Supabase:** Die Kalender-Funktion hat neue Teile bekommen.
1. supabase.com → **Edge Functions** → **google-kalender** → oben **Code**.
2. Links `index.ts` anklicken, rechts alles markieren (Ctrl+A) und mit dem Inhalt von `supabase\functions\google-kalender\index-zum-kopieren.txt` ersetzen (Ctrl+V).
3. **Deploy** klicken. Kein Datenbank-Update nötig. «Verify JWT» bleibt aus.
4. App hochladen wie immer (siehe E), auf dem Handy schliessen und neu öffnen (Version 0.15.0).

**So geht es:**
- **Neuer Termin:** Tag im Kalender antippen → **+ Termin**. Titel, Kalender («mein Kalender» oder «Familie»), **Wen betrifft es?**, Mit Zeit / Ganztägig, Beginn und Ende, Wiederholung, Ort, Notiz → **Speichern**.
- **Wen betrifft es?** Bei deinem eigenen Kalender bist du immer dabei; du kannst Kinder dazunehmen (z.B. Zahnarzt mit Kind 1). Im Familienkalender: niemand gewählt = ganze Familie. Die Namen stehen in Google vorne im Titel, z.B. «[Kind 1] Zahnarzt». Die App zeigt sie farbig und ohne Klammern. Wer direkt in Google einen Termin so schreibt, wird ebenfalls erkannt (Namen genau wie in der App).
- **Ändern / Löschen:** Termin antippen → **✎ Bearbeiten** oder **Löschen**. Bei wiederkehrenden Terminen fragt die App: **«Nur diesen Termin»** oder **«Alle Termine der Serie»**. Bei «alle» verschiebt eine Änderung von Datum/Zeit die ganze Serie gleich weit.
- **Wiederholung:** täglich, wöchentlich, alle 2 Wochen, monatlich, jährlich, optional «bis» Datum. Kompliziertere Serien aus Google (z.B. Mo + Mi) bleiben unverändert («Wie bisher»).
- **Erinnerungen:** wie in deinem Google Kalender eingestellt (Standard-Erinnerung).
- Termine der anderen Person kannst du ansehen, aber nicht ändern. Ändern geht nur mit Internet.

## R) Von unterwegs mit Claude arbeiten (Claude Code, einmalig einrichten)
Damit kannst du vom Handy aus Ideen schicken oder Änderungen bauen lassen. Dein PC muss dafür nicht laufen.

**Einmalig:**
1. In der Claude-App auf dem Handy (oder im Browser auf claude.ai/code) den Bereich **Code** öffnen.
2. **GitHub verbinden** wählen und mit deinem GitHub-Konto (leibi-tech) anmelden.
3. Wenn GitHub fragt, welche Repositories Claude sehen darf: **Only select repositories** → **family-planner** → **Install** / **Save**.
4. Neue Sitzung starten und als Repository **leibi-tech/family-planner** wählen.

**Eine Idee festhalten:** Einfach schreiben, z.B. «Idee: Im Wochenplan Menüs per Ziehen verschieben». Claude trägt sie in `IDEEN.md` ein und baut nichts.

**Etwas bauen lassen:** Schreiben, was du willst, und dazu «bitte bauen». Claude fragt nach, wenn etwas unklar ist, baut und testet.
Danach bekommst du einen Link zu einem **Pull Request** (Vorschlag für die Änderung):
1. Link öffnen (oder GitHub-App → family-planner → **Pull requests**).
2. **Merge pull request** → **Confirm merge**.
3. 1–2 Minuten warten, App auf dem Handy schliessen und neu öffnen, Version prüfen.

**Wichtig:**
- Immer nur **eine** Änderung gleichzeitig offen haben: erst mergen, dann die nächste Sache anfangen.
- Wenn du danach wieder am PC mit Claude (Cowork) arbeitest: zuerst in **GitHub Desktop** auf **Fetch origin** und dann **Pull origin** klicken. So hat der PC den neusten Stand.
- Datenbank-Updates und Supabase-Funktionen musst du weiterhin selbst in Supabase einspielen. Claude sagt dir, wenn das nötig ist.

## S) Kalender: Monat, Woche, Tag (ab Version 0.16.0)
Kein Datenbank-Update und nichts in Supabase nötig.
1. Pull Request mergen (Link von Claude öffnen → **Merge pull request** → **Confirm merge**).
2. 1–2 Minuten warten, App schliessen und neu öffnen. Unter Mehr → unten muss **0.16.0** stehen.

**So geht es:**
- Oben im Kalender: **Monat / Woche / Tag**. Ein Tipp darauf springt immer auf **heute**. Die App merkt sich die zuletzt gewählte Ansicht.
- **Woche:** die 7 Tage untereinander. Tag antippen → Tagesansicht dieses Tages. **+** neben dem Tag → neuer Termin an diesem Tag.
- **Tag:** Zeitraster mit einer Spalte pro Person (und Familie). So siehst du sofort, wenn zwei gleichzeitig weg sind. Rote Linie = jetzt. Mit den farbigen Knöpfen blendest du Personen aus.
- **Farben:** Termin für dich und Antonia = halb blau, halb orange. Termin mit **allen** Personen = grün wie «Familie».

## T) Wer schaut auf die Kinder? Termine auf der Startseite (ab Version 0.17.0)
Kein Datenbank-Update und nichts in Supabase nötig.
1. Pull Request mergen (Link von Claude öffnen → **Merge pull request** → **Confirm merge**).
2. 1–2 Minuten warten, App schliessen und neu öffnen. Unter Mehr → unten muss **0.17.0** stehen.

**So geht es:**
- **Startseite:** Oben erscheint **«⚠️ Wer schaut auf die Kinder?»**, wenn ihr beide in den nächsten 14 Tagen gleichzeitig einen Termin habt. Darunter **Termine** von heute und morgen. Antippen öffnet den Kalender beim richtigen Tag.
- **Betreuung erfassen:** Warnung antippen → «Jemand betreut» (z.B. Grosi) oder «Kinder gehen mit» (mit wem) → Notiz → **Speichern**. Im Kalender steht dann ✅ beim Termin. Beide sehen das.
- **Termin verschoben oder gelöscht?** Dann meldet die App «Termin geändert – Betreuung prüfen». Antippen, prüfen, speichern (oder löschen).
- Keine Warnung gibt es, wenn alle Kinder bei einem der Termine dabei sind (z.B. «[Kind 1, Kind 2] Schwimmen»). Ganztägige Termine (Ferien) zählen nicht.
- Als Eltern zählen alle Personen mit eigenem App-Konto oder eigenem Google-Kalender (ab 0.17.1). Thadeas Termine erscheinen aber erst, wenn sie ihren Google-Kalender verbindet. Bis dahin warnt die App nur bei deinen Terminen, in denen sie mit dabei ist (z.B. «[Thadea] Essen»).
- **Rückfrage:** Termin von Thadea antippen → **💬 Rückfrage an …** → Text → **Senden**. Sie bekommt ein ToDo mit dem Knopf **«📅 Termin öffnen»**.

## U) Dokumente auf dem NAS – Test (ab Version 0.18.0)
Ziel: Die App speichert Fotos und PDFs (Quittungen, Garantiescheine, Policen) **nur auf deinem Synology NAS**. Angemeldet wird mit einem NAS-Konto. Dieser Schritt ist ein Test: anmelden, Foto hochladen, wieder ansehen, löschen.
Am PC im Browser bei deinem NAS (DSM) geht es am einfachsten. Rechne mit etwa 30–45 Minuten. Bleibst du irgendwo hängen: Screenshot an Claude.

**Teil 1 – Ordner und Konto (Systemsteuerung im DSM)**
1. **Systemsteuerung → Gemeinsamer Ordner → Erstellen.** Name genau: `Familien-Dokumente`. Haken bei «Papierkorb aktivieren». Weiter bis Fertig (Verschlüsselung nicht nötig).
2. **Systemsteuerung → Benutzer und Gruppe → Benutzer → Erstellen.** Name z.B. `familienapp`, langes Passwort (notieren!). Nicht in die Gruppe «administrators».
   - Bei **Berechtigungen für gemeinsame Ordner**: `Familien-Dokumente` = **Lesen/Schreiben**, alle anderen = **Kein Zugriff**.
   - Bei **Anwendungsberechtigungen**: nur **File Station** = Zulassen, alle anderen = Verweigern.
3. **Abmelden** und dich mit `familienapp` beim NAS anmelden. Oben rechts auf das Personen-Symbol → **Persönlich → Sicherheit → 2-Faktor-Authentifizierung** einschalten. Als Methode den **Bestätigungscode (OTP)** mit einer Authenticator-App wählen (z.B. Google Authenticator oder Synology Secure SignIn). Die App muss einen 6-stelligen Code zeigen. Danach wieder abmelden und mit deinem normalen Konto anmelden.
4. **Systemsteuerung → Sicherheit → Schutz:** «Automatische Blockierung aktivieren» einschalten (z.B. 5 Fehlversuche in 5 Minuten).

**Teil 2 – Eigene Adresse mit Zertifikat**
5. **Systemsteuerung → Externer Zugriff → DDNS → Hinzufügen.** Dienstanbieter **Synology**, Hostname z.B. `leibi-familie` (ergibt `leibi-familie.synology.me`). Haken bei **«Zertifikat von Let's Encrypt erhalten und als Standard festlegen»**. OK.
   Gibt es dort schon eine Adresse, nimm diese. Klappt das Zertifikat nicht: Screenshot an Claude (manchmal muss dafür kurz Port 80 im Router offen sein).

**Teil 3 – Hilfsprogramm installieren**
6. **Paket-Zentrum → Container Manager → Installieren.**
7. Die zwei Dateien holen: am PC **github.com/leibi-tech/family-planner** → Ordner **nas** → Datei `docker-compose.yml` öffnen → oben rechts **Download** (Pfeil). Dasselbe für `nginx.conf`.
8. **File Station** → Ordner **docker** → neuer Ordner `family-planner-nas` → beide Dateien dort hineinziehen (Namen nicht ändern).
9. **Container Manager → Projekt → Erstellen.** Projektname `family-planner-nas`, Pfad: `/docker/family-planner-nas` wählen, Quelle: **«Vorhandene docker-compose.yml verwenden»**. Weiter (Web-Portal **nicht** einrichten) → Fertig. Nach kurzer Zeit steht das Projekt auf **grün / läuft**.

**Teil 4 – Von aussen erreichbar machen**
10. **Systemsteuerung → Anmeldeportal → Erweitert → Reverse Proxy → Erstellen.**
    - Beschreibung: `Family-Planner`
    - Quelle: Protokoll **HTTPS**, Hostname `leibi-familie.synology.me` (deine Adresse aus Schritt 5), Port **8443**
    - Ziel: Protokoll **HTTP**, Hostname `localhost`, Port **8890**
    - Speichern.
11. **Systemsteuerung → Sicherheit → Zertifikat → Einstellungen:** beim Eintrag `leibi-familie.synology.me:8443` das Let's-Encrypt-Zertifikat wählen → OK.
12. **Router:** Port **8443** (TCP) an die Adresse deines NAS weiterleiten. Wie das geht, hängt vom Router ab (z.B. Swisscom Internet-Box: Einstellungen → Netzwerk → NAT/Portweiterleitung). Sag Claude, welchen Router du hast, dann gibt es eine genaue Anleitung. Hast du auf dem NAS die Firewall eingeschaltet, dort Port 8443 erlauben.
13. **Prüfen** (Handy, mobile Daten statt WLAN): im Browser öffnen
    `https://leibi-familie.synology.me:8443/webapi/entry.cgi?api=SYNO.API.Info&version=1&method=query`
    Richtig ist: Schloss-Symbol in der Adresszeile und eine Textseite mit `"success":true`.

**Teil 5 – In der App ausprobieren**
14. Pull Request mergen (Link von Claude öffnen → **Merge pull request** → **Confirm merge**). 1–2 Minuten warten, App schliessen und neu öffnen. Unter Mehr → unten muss **0.18.0** stehen.
15. **Mehr → Dokumente (Test).** Adresse `https://leibi-familie.synology.me:8443`, Benutzer `familienapp`, Passwort → **Beim NAS anmelden** → Code aus der Authenticator-App.
16. **📷 Foto oder PDF hinzufügen** → Foto machen oder PDF wählen. Es erscheint in der Liste mit Vorschau. Antippen öffnet es. **Löschen** löscht es auf dem NAS.
17. Am PC in File Station nachsehen: Die Datei liegt in `Familien-Dokumente/Test`.

**Gut zu wissen**
- Dein Passwort speichert die App nicht. Auf dem Handy bleibt nur die Anmeldung. Ist sie abgelaufen, fragt die App nochmals nach dem Passwort. Den Code braucht es auf diesem Handy nur beim ersten Mal.
- Über Port 8443 erreicht man nur die Datei-Schnittstelle, nicht die NAS-Oberfläche. Diese bleibt wie bisher (QuickConnect).
- Ohne Internet oder wenn der NAS aus ist, sind die Dateien nicht erreichbar.

## V) Neues Aussehen und eigene Menüleiste (ab Version 0.19.0)
Die App ist jetzt hell und farbig, mit runden Symbolen statt Emojis. Die Menüleiste unten richtest du selber ein.

**Menüleiste anpassen**
1. Unten auf **Mehr** tippen.
2. Unter «Einstellungen» auf **Menüleiste anpassen** tippen.
3. Oben siehst du eine Vorschau der Leiste. **Start** bleibt in der Mitte, **Mehr** ganz rechts. Dazu kommen 3 freie Plätze.
4. Mit **✕** löst du einen Knopf aus der Leiste. Er steht dann unter «Mehr».
5. Unten bei «Unter «Mehr»» auf **Anheften** tippen, um eine Seite in die Leiste zu holen.
6. Mit **‹** und **›** verschiebst du einen Knopf nach links oder rechts.

Die Einstellung gilt für dein Handy. Thadea richtet ihre Leiste auf ihrem Handy selber ein.

**Hell oder dunkel**
- **Mehr → Aussehen → Hell / Dunkel.** Die App ist immer hell, ausser du wählst hier «Dunkel». Der Dunkel-Modus des Handys spielt keine Rolle mehr.

## W) Liebesgruss (ab Version 0.20.0)
Du kannst Thadea (oder sie dir) einen kleinen Gruss auf den Startbildschirm schicken, mit Text, Foto oder beidem. Kein Datenbank-Update nötig.

**Gruss senden**
1. Auf der **Startseite** zur Karte **💌 Liebesgruss**.
2. **Gruss an … senden** tippen.
3. Text schreiben und/oder **📷 Foto aufnehmen oder wählen** (das Handy fragt: Kamera oder Galerie).
4. **Senden 💌** tippen.
5. Bei dir steht jetzt «wartet auf Reaktion». Solange kannst du dieser Person keinen weiteren Gruss schicken. Mit **Zurücknehmen** ziehst du ihn zurück.

**Gruss bekommen**
- Beim nächsten Öffnen der App erscheint der Gruss über den ganzen Bildschirm. Erst nach einem Tipp auf ❤️ 😘 😂 oder 👍 geht die App auf.
- Ist die App gerade offen, erscheint er nach spätestens etwa 30 Sekunden. Eine Meldung aufs Handy gibt es nicht.

**Reaktion sehen**
- Auf deiner Startseite steht dann z.B. «Thadea hat mit ❤️ reagiert». Mit **✕** blendest du das aus.

**Album**
- **Album ›** in der Karte (oder Mehr → **Unsere Grüsse**): alle Grüsse, die neusten zuerst. Antippen zeigt sie gross, dort kannst du einen auch löschen.
- Es bleiben die letzten 100. Kommen mehr dazu, verschwindet bei den älteren jeder zweite. So bleiben auch ein paar alte erhalten.

**Zum Testen**
1. Pull Request mergen, 1–2 Minuten warten, App auf beiden Handys schliessen und neu öffnen (Version 0.20.0, Mehr → unten).
2. Du schickst Thadea einen Gruss mit Foto.
3. Thadea öffnet die App: Gruss erscheint, sie tippt ein Emoji.
4. Bei dir erscheint die Reaktion auf der Startseite (evtl. App kurz schliessen und wieder öffnen).

Hinweis: Die Karte erscheint nur, wenn beide mit «Gemeinsam nutzen» angemeldet sind und unter «Familie» festgelegt ist, wer man ist. Hat Thadea die App noch nicht auf 0.20.0, kommt der Gruss erst nach ihrem Update an.

## X) Neues App-Symbol (ab Version 0.20.1)
Die App hat ein neues Symbol: eine Familie mit vier Personen, die Köpfe in den Farben vom Kalender.

1. Pull Request mergen, 1–2 Minuten warten, App schliessen und neu öffnen (Version 0.20.1).
2. Android übernimmt das neue Symbol auf dem Startbildschirm von selbst, das kann aber **bis zu einem Tag** dauern. Evtl. fragt Chrome kurz, ob das neue Symbol übernommen werden soll: «Aktualisieren» tippen.
3. Ist es nach einem Tag noch das alte grüne Klemmbrett: App-Symbol lange drücken → **Deinstallieren** (die Daten bleiben in Supabase), dann https://leibi-tech.github.io/family-planner/ in Chrome öffnen → ⋮ → **App installieren**. Danach unter «Familie» wieder anmelden, falls nötig.

## F) Meine Daten
- Ohne «Gemeinsam nutzen» liegen die Daten **nur auf deinem Handy**.
- Mit «Gemeinsam nutzen» liegen sie zusätzlich verschlüsselt übertragen in eurer Supabase-Datenbank in Zürich. Nur Konten eures Haushalts sehen sie. Private ToDos sieht nur, wer sie erfasst hat.
- **Kalender:** Die Termine bleiben bei Google. Der Zugangsschlüssel zu Google liegt geschützt in Supabase; die App selbst kann ihn nicht lesen. «Verbindung trennen» löscht ihn und meldet die App bei Google ab.
- **Liebesgrüsse (ab 0.20.0):** liegen wie die anderen Daten in Supabase. Fotos werden vorher verkleinert (ca. 100–200 KB pro Foto).
- **Dokumente (Test, ab 0.18.0):** Fotos und PDFs liegen nur auf deinem NAS, nicht in Supabase. Die Anmeldung beim NAS bleibt auf dem Handy.
- ⚠️ Gelöschtes wird auch auf den anderen Handys gelöscht. Ein Export-Knopf als zusätzliche Sicherung kommt noch (Wunschliste).

## Wenn etwas nicht klappt
Mach ein Foto oder einen Screenshot und schick es Claude.
