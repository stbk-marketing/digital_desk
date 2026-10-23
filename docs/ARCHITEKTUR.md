# Architektur – Kühl Workspace

Stand: 23.10.2026. Verbindliche Produktgrundlage: `../UMSETZUNG.md` im übergeordneten Paket. Neues Projekt ohne Migration alter Produktivdaten.

## Stack und Herkunft

Offizieller `laravel/react-starter-kit`, Git-Ausgangsstand in der lokalen Historie. Die Packagist-Vorlage v1.0.1 enthielt Laravel 12; deshalb wurde stattdessen der aktuelle offizielle Git-Stand mit Laravel 13, React 19, TypeScript, Inertia 3, Tailwind 4 und Fortify verwendet. Die konkreten Versionen stehen in `composer.lock` und `package-lock.json`.

- [Laravel Starter Kits](https://laravel.com/framework/docs/13.x/starter-kits)
- [Offizielle Vorlage](https://github.com/laravel/react-starter-kit)
- [SQLite-Konfiguration](https://laravel.com/framework/docs/13.x/database)
- [Vite+-Aktualisierung und Paketaliase](https://viteplus.dev/guide/migrate)

Vite+ wurde wegen gemeldeter Schwachstellen der mitgelieferten Version 0.3.0 auf 1.4.0 aktualisiert. Das offizielle Migrationswerkzeug richtete den Vite-Paketalias und npm-Override ein. Kein erzwungener Peer-Override wird für normale Installationen benötigt. Fonts werden beim Build lokal gebündelt; die Anwendung ruft zur Laufzeit keinen Font-CDN auf.

Composer löst mit `config.platform.php=8.3.0` auf, damit die Lockdatei nicht versehentlich PHP-8.4-exklusive Symfony-Pakete voraussetzt. Lokal wurde tatsächlich mit PHP 8.4.23 getestet; der PHP-8.3-Lauf ist in der CI-Konfiguration vorgesehen, wurde hier mangels zweiter PHP-Laufzeit nicht behauptet.

## Daten und Mutationen

Ein gemeinsamer Workspace. Alle aktiven, verifizierten Accounts sind gleichberechtigt. Web-/JSON-/Report-Routen verwenden Session-Authentifizierung, Verifikation und globale Aktivitätsprüfung; Policies erlauben nur aktiven verifizierten Accounts die Mutationen. Fortify übernimmt Login, Logout, Verifikation, Reset und Passwortbestätigung. Registrierungs- und Reset-Limits sind zusätzliche Middleware; der Registrierungscode bleibt ausschließlich serverseitig. Reset-Link-Anforderungen liefern eine kontoneutrale Antwort.

`MutateWorkspace` kapselt Task-/Project-Mutationen und schreibt in **einer Transaktion**:

1. Versionsprüfung des aktuellen Datensatzes und Validierung des kombinierten Projektzeitraums.
2. Atomisches Update mit `WHERE id = … AND version = expected_version`.
3. Append-only Activity mit fachlichen Vorher-/Nachherwerten und Account.
4. Monotonen Änderungszähler für Team-Synchronisierung.

SQLite verwendet `IMMEDIATE`-Transaktionen, WAL, Foreign Keys und 5000 ms Busy-Timeout auf demselben lokalen Datenträger. Die zusätzliche bedingte UPDATE-Abfrage verhindert auch nach einem späteren Datenbankwechsel das stille Überschreiben veralteter Versionen. Ein Konflikt liefert HTTP 409 und den Serverstand; kein Audit-Eintrag bei Konflikt oder Rollback. Die UI hält den Entwurf und bietet einen ausdrücklichen erneuten Versand auf der aktuellen Basis an.

ULIDs identifizieren Aufgaben, Projekte und Activities. Fremdschlüssel verhindern Cascade-Löschungen. Aufgaben werden archiviert, Projekte haben einen Archivstatus; Accounts können über Artisan deaktiviert werden. Die Selbstlöschung des Starters ist gesperrt, damit Aufgaben und Historie erhalten bleiben. Keine Schreib-/Löschroute für Activities. App-seitiger Append-only-Schutz ersetzt keine Datenbankzugriffskontrolle: DB-Datei und Backups sind nur für Betriebsverantwortliche zugänglich.

`workspace_requests` speichert pro Account und Objekttyp eine Erfassungs-ID. Wiederholung nach verlorener Antwort erstellt keine zweite Aufgabe/kein zweites Projekt. `search_text` ist ein intern normalisiertes Suchfeld für deutsche Unicode-Groß-/Kleinschreibung; es wird zusammen mit dem Objekt aktualisiert und weder an den Browser noch ins Audit ausgeliefert. Suche umfasst Titel, Notiz und verknüpften Projektnamen/-beschreibung. Auch archivierte Treffer bleiben explizit erreichbar.

## Frontend und Synchronisierung

Fünf Perspektiven, zentrale Erfassung per Enter, N oder Ctrl/Cmd+K. Aufgaben: optimistischer In-Memory-Entwurf, serialisierte Einzelmutationen je Datensatz, Textdebounce 500 ms mit Blur-/Unmount-Flush. Der beim ersten Tastendruck gebundene Stand bleibt Grundlage der Textänderung, auch wenn Polling während der Eingabe neuere Daten bringt. Fehlerhafte Entwürfe werden nicht durch Polling ersetzt; vor dem Schließen mit ungespeicherten Änderungen warnt der Browser. Nur die Perspektive wird im LocalStorage gespeichert, keine Workspace-Inhalte. Ohne Netzverbindung bleibt der Entwurf bis zum Schließen der Seite im Speicher; es gibt bewusst keine dauerhafte Offline-Datenbank.

Alle 7 Sekunden wird im sichtbaren Tab ein Änderungszähler abgefragt; Fokus, Sichtbarkeit und Reconnect lösen ebenfalls einen Abruf aus. Bei Änderungen werden die aktuell gefilterte Aufgaben-Seite und die Projektliste aktualisiert. Es wird nicht dauernd der komplette Jahresreport geladen. Aufgabenlisten (60) und Historien (40) sind serverseitig paginiert. Der Kalender lädt alle Seiten im gewählten Datumsbereich. Projekte sind für die kleine Teamgröße eine gemeinsame Liste.

Eigener Kalender mit Montag als Wochenbeginn, date-fns und dnd-kit. Tageserfassung und Datumseingabe sind die Touch-/Tastaturalternative zum Ziehen. Mehrtägige Projektbalken werden je Woche gekürzt; die Originaldaten bleiben unverändert. Jahresreport berechnet inklusive Tagesdauern anhand 365/366 Tagen und unterschiedlich breiten Monatsabschnitten. Serverreport und Druckseite verwenden dieselben Berechnungen. Die Druckseite benötigt keinen Node-/Chromium-Server; `window.print()` genügt.

Kalendertage bleiben `YYYY-MM-DD`, ohne UTC-Konvertierung. Audit-Timestamps werden UTC gespeichert und in Europe/Berlin angezeigt. Geplante Projektdauern sind keine Arbeitszeitnachweise.

## Spätere KI – getrennte Phase

Der MVP enthält keine KI-Endpunkte, Sprachaufnahme, Modelle oder zusätzliche Services. Ein späterer lokaler Assistent kann dieselben validierten Actions aufrufen, mit Session, Policy, erwarteter Version und Audit. Keine freien Modell-SQL-Abfragen. Schreibaktionen mit Unklarheiten zuerst als Entwurf bestätigen. Ollama/Whisper, eigene Ressourcen und Datenschutzprüfung werden erst in einer separat beauftragten Phase geplant. Die vollständige klassische Bedienung bleibt davon unabhängig.
