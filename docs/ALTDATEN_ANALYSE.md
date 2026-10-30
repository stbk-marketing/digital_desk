# Altdatenanalyse und Feldzuordnung

## Umfang und Datenschutz

Die lokale Testmigration ist abgeschlossen. Für den späteren Serverimport sind **84 Projekte und 175 Aufgaben** vorgesehen. **43 Kommentare** werden vollständig in den Aufgabennotizen erhalten. **„Filiale des Monats“ bleibt ausgeschlossen.**

Diese Dokumentation enthält technische Strukturen, Mappingregeln und aggregierte Prüfergebnisse. Originaldaten, konkrete Quellprüfsummen, persönliche Pfade, einzelne Kommentare, Benutzerlisten und Sicherungsprotokolle bleiben ausschließlich in der privaten Migrationsablage. Die ausführliche interne Dokumentation wurde dort ebenfalls aufbewahrt.

Der SQL-Dump wurde vollständig als Daten gelesen, niemals ausgeführt. Gzip-Prüfung, UTF-8, Abschlussvermerk, Spaltenanzahl, JSON-Felder, eindeutige Schlüssel, deklarierte Fremdschlüssel und polymorphe Medienbeziehungen wurden geprüft. Das bestätigt die strukturelle Konsistenz des gelieferten Dumps. Früher gelöschte oder im Dump fehlende Daten lassen sich nicht rekonstruieren. Original und unveränderte Sicherung sind durch ein privates SHA-256-Manifest nachgewiesen.

## Quellstruktur

| Tabellen                                                                                                        | Bedeutung                                                                                          | Behandlung                                                                       |
| --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `projects`                                                                                                      | Projekte, Beschreibungen, Zeiträume, Status, Archivierung, Ersteller                               | Neue Projekte mit dauerhaftem ID-Mapping                                         |
| `tickets`                                                                                                       | Aufgaben, Beschreibungen, JSON-Zusatzfelder, Status, Fristen, Planungszeiten, Projekt-/Serienbezug | Neue Aufgaben; Sonderbereich ausgeschlossen                                      |
| `ticket_comments`                                                                                               | Aufgabe, Autor, Text, Originalzeitstempel                                                          | Vollständig in der Aufgabennotiz; Einzelwerte zusätzlich im Quellpayload         |
| `ticket_assignees`                                                                                              | Aufgabe/Benutzer, zuweisende Person, Zeitstempel                                                   | Vollständige Metadaten; optional eindeutiges Benutzermapping                     |
| `ticket_series`                                                                                                 | Wiederholungsregeln, Kategorie, Titel, Daten, Planungsparameter                                    | Metadaten erhalten; keine Erzeugung neuer zukünftiger Aufgaben                   |
| `ticket_categories`                                                                                             | Kategorien und dynamische Formularschemas                                                          | Vollständige Metadaten                                                           |
| `departments`, `department_user`                                                                                | Abteilungen und Mitgliedschaften                                                                   | Vollständige Metadaten                                                           |
| `users`                                                                                                         | Historische Benutzer                                                                               | Nur ID, Name, E-Mail und Zeitstempel im privaten Importinput; keine Zugangsdaten |
| `media`                                                                                                         | Polymorphe Dateiverweise und Zusatzmetadaten                                                       | Metadaten und Hinweis auf fehlende Dateiinhalte erhalten                         |
| `migrations`, `cache`, `cache_locks`, `sessions`, `password_reset_tokens`, `jobs`, `job_batches`, `failed_jobs` | Technische Infrastruktur                                                                           | Nur in der unveränderten privaten Quelle; kein Workspace-Import                  |

Die Quelle besitzt 18 Tabellen. Das vollständige SQL-Feld-/Indexinventar wird als private `schema.json` erzeugt. Unbekannte oder fehlende Tabellen führen zum Abbruch der Vorbereitung und erfordern eine neue Analyse.

Projekte besitzen Aufgaben über `tickets.project_id`. Aufgaben gehören einer Kategorie und optional einer Serie an. Kommentare und Mehrfachzuständigkeiten verweisen auf Aufgaben; Benutzerbezüge betreffen Autoren, Ersteller, Archivierende und zuweisende Personen. Medien sind polymorph zugeordnet. Gemeinsam genutzte Benutzer oder Abteilungen begründen keine fachliche Zusammengehörigkeit sonst unabhängiger Aufgaben.

Eine eigene Unteraufgaben- oder allgemeine Notiztabelle wurde nicht gefunden. Notizen liegen in Projektbeschreibungen, Aufgabenbeschreibungen, dynamischen JSON-Feldern und Kommentaren. Es werden keine zusätzlichen offenen Aufgaben aus Notiztexten erzeugt und keine neue Notizfunktion eingeführt.

## Feldmapping

| Quelle                                                                                                    | Ziel / Regel                                                                                                                   |
| --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `projects.id`, `tickets.id`                                                                               | Neue ULIDs; Mapping über `legacy_records` mit Quelle/Tabelle/Alt-ID                                                            |
| `projects.title`                                                                                          | `projects.name`, unverändert; Längenüberschreitung führt zum Fehler                                                            |
| `projects.description`                                                                                    | `projects.description`, ergänzt um gekennzeichnete Herkunft und Originalstatus                                                 |
| `start_date`, `end_date`                                                                                  | `starts_on`, `ends_on`, unverändert; fehlende Werte bleiben NULL                                                               |
| Projektstatus `geplant`, `aktiv`                                                                          | `active`; Originalstatus bleibt nachvollziehbar                                                                                |
| Projektstatus `abgeschlossen`                                                                             | `completed`                                                                                                                    |
| Projektstatus `abgebrochen` oder vorhandene Archivierung                                                  | `archived`; Abbruch bleibt beschriftet, kein erfundener Archivzeitpunkt                                                        |
| `tickets.title`                                                                                           | `tasks.title`, unverändert                                                                                                     |
| Aufgabenbeschreibung, JSON-Zusatzfelder, Kommentare                                                       | Vollständige `tasks.notes`; Herkunft, Originalautor und Kommentarzeitpunkt gekennzeichnet; Rohwerte zusätzlich im Quellpayload |
| Aufgabenstatus `offen`, `in_bearbeitung`                                                                  | `open`; ursprüngliche Differenzierung bleibt in Notizen und Payload                                                            |
| Aufgabenstatus `erledigt`, `abgebrochen`                                                                  | `done`; Abbruch ausdrücklich mit Originalstatus gekennzeichnet                                                                 |
| `deadline_at`                                                                                             | Kalenderdatum nach `due_on`; ursprüngliche Uhrzeit bleibt in Notizen/Payload                                                   |
| `planned_start_at`, `planned_end_at`, `is_all_day`                                                        | Originalwerte erhalten; keine künstliche Ersatzfrist                                                                           |
| `closed_at`                                                                                               | `completed_at`, unverändert; NULL bleibt NULL                                                                                  |
| Abschlussautor                                                                                            | `completed_by` bleibt NULL, da die Quelle keinen Abschlussautor belegt                                                         |
| `project_id`                                                                                              | Über ID-Mapping zu `tasks.project_id`; fehlende Zielbeziehung führt zum Abbruch                                                |
| `ticket_assignees`                                                                                        | Nur explizit geprüftes Benutzermapping; mehrere Zuständige werden nicht willkürlich reduziert                                  |
| `created_by`                                                                                              | Deaktivierter technischer Importaccount; historischer Ersteller separat dokumentiert                                           |
| `created_at`, `updated_at`                                                                                | Originalwerte einschließlich NULL; Importzeitpunkt ausschließlich im Laufnachweis                                              |
| `archived_at` der Aufgaben                                                                                | Unverändert                                                                                                                    |
| Kategorie, Abteilung, Priorität, harte Frist, Slug, Archivgrund/-autor, Serie, Ausnahmen, Medienmetadaten | Vollständige Werte in `legacy_records.payload`; hilfreiche Angaben zusätzlich in Notizen                                       |

Das Zielmodell besitzt zwei Aufgabenstatuswerte und eine einzelne Zuständigkeit. Die ursprünglichen Unterschiede bleiben im Text und strukturierten Payload erhalten. Historische Kommentare sind keine nachgebauten Workspace-Aktivitäten. Der Import erzeugt keine Einträge in `activities`.

Der Dump verwendet UTC für SQL-`TIMESTAMP`-Werte. `DATETIME`-Planungswerte enthalten selbst keine Zeitzone. Originalzeichenfolgen werden ohne spekulative Zeitverschiebung übernommen.

## Ausschluss von Filiale des Monats

Die Vorbereitung sucht im gesamten Quellbestand nach Schreibvarianten, Bindestrichen/Unterstrichen und `FDM`. Weitere gemeinsame Erwähnungen von Filiale und Monat werden als unsicher markiert und verhindern den Import bis zur Klärung.

Eindeutige Treffer werden über echte Beziehungen erweitert: Serie/Projekt/Kategorie zu Aufgaben, Aufgaben zu Kommentaren und Zuständigkeiten sowie polymorphe Medienbezüge. Ein passender Kommentar schließt seine gesamte Aufgabe ein. Gemeinsame Benutzer oder Abteilungen ziehen keine fremden Aufgaben in den Sonderbereich. Der Laravel-Importer berechnet die Ausschlussliste unabhängig nach und lehnt eine abweichende Liste ab.

In der geprüften Quelle sind **13 Aufgaben, elf Kommentare, eine Serie und eine Mitarbeiterzuordnung** ausgeschlossen, insgesamt **26 Quelldatensätze**. Es gibt keine ausgeschlossenen Projekte und keine ungeklärten Treffer. Gemischte fachliche Datensätze bleiben vollständig in der privaten Quelle beziehungsweise dem separaten Export und werden nicht teilweise übernommen.

## Erhaltene Einschränkungen

- Bei 21 Projekten fehlt ein Enddatum. Sie bleiben im Jahresplan als unvollständig geplant sichtbar.
- 90 reguläre Aufgaben besitzen eine wiederhergestellte Projektbeziehung. Elf Aufgaben bleiben ohne tatsächliche Frist.
- Bei 119 importierten erledigten/abgebrochenen Aufgaben fehlt ein belegter Abschlusszeitpunkt. Er bleibt NULL; die Aufgaben erscheinen nicht als neu erledigte Arbeiten im Wochencheck.
- Bei 64 Aufgaben bestehen mehrere Altzuständigkeiten. Bei 92 weiteren fehlt ein freigegebenes Benutzermapping für die einzelne Altzuständigkeit. Originalzuordnungen bleiben vollständig erhalten.
- Der Kalender folgt den bestehenden Fristen und Projektbalken. Zusätzliche Planungsuhrzeiten bleiben in Notizen und Payload erhalten.
- Serienregeln werden aufbewahrt, ohne zukünftige Wiederholungen zu erzeugen.
- Zwei Medienverweise enthalten keine Dateiinhalte. Die Dateiwiederherstellung erfordert zusätzlich das Medienverzeichnis des Altsystems.

Es werden keine vorgesehenen Quellfelder gekürzt oder stillschweigend verworfen. Die Grenzen betreffen die direkte Darstellung im vorhandenen Zielmodell. Die Serveranleitung steht in [ALTDATEN_MIGRATION.md](ALTDATEN_MIGRATION.md).
