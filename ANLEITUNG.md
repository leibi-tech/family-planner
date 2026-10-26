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

## F) Meine Daten
- Ohne «Gemeinsam nutzen» liegen die Daten **nur auf deinem Handy**.
- Mit «Gemeinsam nutzen» liegen sie zusätzlich verschlüsselt übertragen in eurer Supabase-Datenbank in Zürich. Nur Konten eures Haushalts sehen sie. Private ToDos sieht nur, wer sie erfasst hat.
- ⚠️ Gelöschtes wird auch auf den anderen Handys gelöscht. Ein Export-Knopf als zusätzliche Sicherung kommt noch (Wunschliste).

## Wenn etwas nicht klappt
Mach ein Foto oder einen Screenshot und schick es Claude.
