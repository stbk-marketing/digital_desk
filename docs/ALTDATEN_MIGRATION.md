# Altdatenmigration: Servervorbereitung und Betrieb

## Freigabegrenze und Zielmengen

Die lokale Testmigration ist abgeschlossen. Die Bereitstellung des Importcodes über Git verändert keine produktive Datenbank. Schemaänderung und eigentlicher Import erfolgen später kontrolliert auf dem internen Firmenserver nach separater Freigabe.

Die geprüfte Quelle ergibt **84 neue Projekte und 175 neue Aufgaben**. **43 Kommentare** werden vollständig den Aufgabennotizen zugeordnet. **Filiale des Monats bleibt ausgeschlossen**: 13 Aufgaben, elf Kommentare, eine Serie und eine Mitarbeiterzuordnung, insgesamt 26 Quelldatensätze.

542 reguläre Quelldatensätze werden in `legacy_records` nachgewiesen: 84 Projekte, 175 Aufgaben, 43 Kommentare und 240 Metadatensätze. Ein erneuter Import derselben Quelle erzeugt keine neuen fachlichen Datensätze. Ein eigener Laufnachweis wird angelegt.

Diese Git-Dokumentation enthält ausschließlich technische Informationen und aggregierte Prüfergebnisse. Einzelne Aufgaben, Kommentare, Benutzer, Quellprüfsummen und konkrete lokale Sicherungspfade bleiben privat. Mapping und Grenzen stehen in [ALTDATEN_ANALYSE.md](ALTDATEN_ANALYSE.md).

## Benötigte Dateien

- Laravel-Befehl und Importlogik: `app/Console/Commands/ImportLegacyWorkspace.php`, `app/Actions/ImportLegacyWorkspace.php`.
- Schema-Migration: `database/migrations/2026_10_30_000001_create_legacy_import_tables.php`.
- Datenvorbereitung: `tools/legacy/prepare.py`, Python 3 mit Standardbibliothek.
- Synthetische Tests: `tests/Feature/LegacyImportTest.php`, `tools/legacy/test_prepare.py`.

Die vorbereitete `migration.json` wird ausschließlich über geschützten internen Dateitransfer außerhalb des Webroots bereitgestellt. Ihr SHA-256-Wert muss mit dem vertrauenswürdigen privaten Manifest verglichen werden. Sie enthält vertrauliche Unternehmensdaten, obwohl Zugangsdaten entfernt wurden.

Originaldump, Backups, SQLite-Dateien, Analyse-JSON, Benutzerzuordnungen, Protokolle und Excel-Exporte gehören nicht in Git. Die Git-Ausschlüsse ergänzen diese Regel; die tatsächliche Commit-Auswahl ist ausdrücklich zu prüfen. Die ausführliche interne Dokumentation und sämtliche Datenartefakte bleiben privat aufbewahrt.

## Vorbereitung aus dem gesicherten Original

```bash
python tools/legacy/prepare.py /privater/pfad/quelle.sql.gz /privater/pfad/aufbereitung
```

Die Vorbereitung führt kein SQL aus. Sie prüft Gzip/UTF-8, SQL-Tupel, bekannte Tabellen, JSON-Felder, eindeutige Schlüssel, Fremdschlüssel und Medienzuordnungen. Ein verändertes Quellschema oder beschädigte Daten führen zum Abbruch.

| Private Ausgabedatei | Zweck                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `migration.json`     | Fachlicher Importinput; Benutzer nur mit ID, Name, E-Mail und Zeitstempeln                                           |
| `source.json`        | Vollständiges Analysezwischenprodukt, auch mit technischen Tabellen und ursprünglichen Zugangsdaten; nicht verteilen |
| `schema.json`        | SQL-Felder, Typen, Schlüssel und Beziehungen                                                                         |
| `analysis.json`      | Aggregierte Analyse und Quellprüfsumme                                                                               |
| `fdm.json`           | Private Sonderbereichszuordnung                                                                                      |

Passwörter, Tokens, Sitzungen, Cache und Warteschlangen werden nicht in `migration.json` übernommen. Der unveränderte Dump bleibt dauerhaft gesichert. Die Vorbereitung erstellt keine Originaldatensicherung; diese muss vorher separat angelegt und per Prüfsumme bestätigt werden.

## Befehl und Integrität

```text
php artisan workspace:import-legacy INPUT
    --sha256=GEPRUEFTE_JSON_PRUEFSUMME
    --database-file=EXPLIZITE_SQLITE_DATEI
    [--dry-run | --apply]
    [--backup=NEUE_PRIVATE_SICHERUNG]
    [--report=NEUES_PRIVATES_JSON_PROTOKOLL]
    [--user-map=PRIVATES_BENUTZERMAPPING]
    [--production-approved]
```

Ohne `--apply` wird ausschließlich geprüft. `--dry-run` und `--apply` schließen sich aus. Der CLI-Dry-Run öffnet SQLite schreibgeschützt und verändert weder Datensätze noch Journalmodus. Das Importschema muss vorher auf dem ausdrücklich gewählten Ziel vorhanden sein.

`--apply` verlangt einen neuen privaten Backuppfad. Vor dem Datenimport wird ein konsistentes SQLite-Onlinebackup einschließlich WAL-Inhalt erstellt und geprüft. Bestehende Backup-/Protokolldateinamen werden abgelehnt. Eingabe, Ziel und Ausgaben dürfen nicht im öffentlichen Webroot liegen. Bei gecachter Laravel-Konfiguration verweigert der Befehl die Ausführung, damit das Ziel kontrollierbar bleibt.

Der gesamte Datenimport erfolgt transaktionssicher. Pflichtfelder, Datumsgültigkeit, Statuswerte, Längen, Beziehungen und unabhängig nachgerechnete Sonderbereichsausschlüsse werden validiert. Ungeklärte Zuordnungen führen zum Abbruch.

Eine eindeutige Datenbankregel auf Quelle/Tabelle/Alt-ID verhindert doppelte Quellidentitäten. Bekannte unveränderte Zeilen werden übersprungen. Veränderte Quellzeilen mit bekannter Identität führen zum Fehler; es gibt keinen Überschreibmodus. Benutzeränderungen werden nicht zurückgesetzt. Importnachweise bleiben auch nach Papierkorblöschung erhalten und verhindern ein automatisches Wiederanlegen.

Das deaktivierte, unverifizierte technische Konto `legacy-import@workspace.invalid` besitzt ein unbekanntes Zufallspasswort und kennzeichnet die Erstellung importierter Datensätze. Originalautoren bleiben separat erkennbar. `activities` bleibt unverändert. `legacy_import_runs` dokumentiert tatsächlichen Importzeitpunkt, Prüfsummen und Mengen. Neue Projekte/Aufgaben erzeugen `workspace_changes` für die bestehende Synchronisierung.

`--report` schreibt ein privates Laufprotokoll. Erfolgreiche schreibende Läufe besitzen zusätzlich einen Datenbanknachweis. Fehler werden auf der Konsole und nach validierter Pfadangabe auch im Dateiprotokoll dokumentiert. Rückgabecodes: 0 für Erfolg, 1 für Fehler. Ein nachgelagerter Protokollfehler wird von einer fehlgeschlagenen Datenbanktransaktion unterschieden.

## Benutzerzuordnungen

Ein optionales `--user-map` enthält explizit geprüfte Alt-ID/Neu-ID-Paare. Rein fiktives Formatbeispiel:

```json
{ "7": 101 }
```

Zielbenutzer müssen aktiv und verifiziert sein. Ohne Identitätsprüfung wird keine Person einem neuen Account gleichgesetzt. Nur eine einzelne Altzuständigkeit kann das einzelne Zielfeld befüllen. Mehrfachzuordnungen bleiben in Notizen und Payload erhalten. Ein später geändertes Mapping aktualisiert bereits importierte Datensätze bewusst nicht automatisch.

## Kontrollierter Firmenserverimport

Die folgenden Schritte beschreiben spätere Betriebsaktionen; sie wurden nicht auf einem Produktivsystem ausgeführt.

1. Separate Freigabe dokumentieren. Die 84 Projekte/175 Aufgaben, den Sonderbereichsausschluss, das Benutzermapping und fehlende Mediendateien fachlich prüfen.
2. Getesteten Code aus `main` bereitstellen. Daten intern und geschützt übertragen; Inputprüfsumme gegen das private Manifest vergleichen.
3. Wartungsfenster starten, Schreibzugriffe beenden, Konfigurationscache auflösen und die tatsächliche SQLite-Datei prüfen. Vor jeder Schemaänderung ein konsistentes Onlinebackup erstellen und den Rücksicherungsweg prüfen.
4. Nach Freigabe die Schema-Migration ausführen. Sie erstellt ausschließlich `legacy_import_runs` und `legacy_records` und importiert noch keine Altdaten.
5. Dry-Run gegen die explizite Zieldatei ausführen. Beim Erstimport müssen 84 Projekte, 175 Aufgaben und 43 Kommentare vorgesehen sein; 26 Sonderbereichsdatensätze bleiben ausgeschlossen. Bei abweichenden Mengen stoppen.
6. Erst danach mit `--apply`, neuem `--backup`, neuem `--report` und `--production-approved` importieren. Das letzte Flag ist eine technische Sperre, kein Ersatz für die Freigabe.
7. Protokoll, Datenbankintegrität, Jahresplan, Projektzuordnungen, Aufgabenstatus, Notizen und Ausschluss abnehmen. Ein erneuter Dry-Run muss die bereits importierten 542 Quellzeilen erkennen.
8. Betriebsübliche Cachekonfiguration wiederherstellen und Wartungsfenster beenden.

Linux-Beispiel mit beispielhaften Pfaden; Prüfsumme und Zielpfad ausdrücklich ersetzen:

```bash
# Ausschließlich nach separater Freigabe auf dem geprüften Server ausführen.
set -eu
php artisan down
php artisan config:clear
php artisan workspace:backup /srv/private-migration/workspace-before-schema.sqlite
php artisan migrate --force

# Mit dem vertrauenswürdigen privaten Manifest vergleichen.
sha256sum /srv/private-migration/migration.json
php artisan workspace:import-legacy /srv/private-migration/migration.json \
  --sha256=HIER_DIE_GEPRUEFTE_JSON_PRUEFSUMME \
  --database-file=/srv/workspace/database/database.sqlite \
  --dry-run --report=/srv/private-migration/dry-run.json

# Nur fortsetzen, wenn Dry-Run und Mengen fachlich geprüft sind.
php artisan workspace:import-legacy /srv/private-migration/migration.json \
  --sha256=HIER_DIE_GEPRUEFTE_JSON_PRUEFSUMME \
  --database-file=/srv/workspace/database/database.sqlite \
  --apply --production-approved \
  --backup=/srv/private-migration/workspace-before-import.sqlite \
  --report=/srv/private-migration/import.json
```

`migrate --force` führt alle noch offenen Laravel-Migrationen aus. Vorab auf einer isolierten Kopie sicherstellen, dass keine weiteren ungeprüften Schemaänderungen ausstehen. Eine gesetzte `DB_URL` kann den bei Schemaänderungen verwendeten Datenbankpfad übersteuern; Konfiguration vorher prüfen.

Nach erfolgreicher Abnahme Cache wie betriebsüblich wiederherstellen und `php artisan up` ausführen. Rücksicherung im Wartungsfenster aus dem vollständigen SQLite-Onlinebackup nach [BETRIEB.md](BETRIEB.md). Niemals `migrate:fresh` verwenden oder eine laufende Datenbank mit WAL unkoordiniert ersetzen.

## Prüfungen

```bash
composer test
python tools/legacy/test_prepare.py
```

Die Tests verwenden synthetische Daten und isolierte SQLite-Testdatenbanken. Die Laravel-Suite prüft bestehende Workspace-Funktionen mit. Tests führen keinen produktiven Import aus.

Dokumentiertes Ergebnis der lokalen Testmigration:

| Prüfung                                     | Ergebnis                                                                                                  |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Import / Wiederholung                       | 84 Projekte und 175 Aufgaben; keine neuen fachlichen Datensätze bei Wiederholung                          |
| Vollständigkeit                             | 542 vorgesehene Quellzeilen erhalten                                                                      |
| Originalbestand                             | Bestehende Datensätze und lokale Quelldatenbank unverändert                                               |
| Datenbankintegrität                         | `integrity_check: ok`, keine Fremdschlüsselverletzung                                                     |
| Historische Aktivitäten                     | Keine nachgebauten Benutzeraktionen                                                                       |
| Jahresplan / Suche / Kalender / Wochencheck | Erfolgreich; alle 84 importierten Projekte sichtbar                                                       |
| Gezielte Importtests                        | Sieben Laravel-Tests mit 53 Assertions; vier Python-Tests                                                 |
| Gesamte Laravel-Suite                       | 70 erfolgreich, sechs deaktivierte Startertests übersprungen; 412 Assertions                              |
| PHP-Formatierung / statische Analyse        | Erfolgreich                                                                                               |
| TypeScript / Client- und SSR-Build          | Erfolgreich                                                                                               |
| Fachliche Browserprüfungen                  | Elf erfolgreich                                                                                           |
| Bereits bekannte UI-Abweichungen            | Zwei Theme-Designprüfungen und Formatabweichungen in bestehenden UI-Dateien, unverändert durch den Import |

Die Importtests decken schreibgeschützten CLI-Dry-Run, Prüfsummensperre, Schutz der konfigurierten Datenbank, Wiederholung, Originalzeiten, fehlende Fristen, Ausschlussliste, Benutzermapping, Benutzernachbearbeitung, Rollback bei späterem Quellkonflikt, Suche, Jahresplan, Datumsfilter, Wochencheck und Papierkorb ab.
