# UI-Refactoring – 23. Oktober 2026

## Umfang

Der Workspace verwendet das vorhandene Laravel-Starter-Kit-Design: Instrument Sans, ursprüngliche Rundungen, shadcn/ui-Komponenten und semantische Theme-Tokens. Stone bildet die neutrale Basis; Emerald kennzeichnet primäre Aktionen, aktive Navigation, Auswahl und Fokus. Beide Farbmodi verwenden das bestehende Appearance-System.

Schreibtisch, Aufgabenzeilen und Details, Projekte, Monats-/Wochenkalender, Wochencheck, Jahresplan und Navigation wurden visuell angepasst. Verwendet werden unter anderem Sidebar, Sheet, Card, Collapsible, Badge, Button, Input, Textarea, Checkbox, NativeSelect, Tabs, Table und Alert. Die offizielle shadcn-CLI ergänzte Textarea, NativeSelect, Tabs und Table. Importpfade wurden an die vorhandenen Aliase und einzelnen Radix-Pakete angepasst; als zusätzliche Laufzeitabhängigkeit bleibt nur `@radix-ui/react-tabs`.

Die separate, 837 Zeilen umfassende `workspace.css` wurde entfernt. Die Darstellung nutzt die vorhandenen Tailwind-/shadcn-Tokens und Komponenten. Projektspezifisch gespeicherte Farben bleiben erhalten. Kalender- und Zeitstrahlgeometrie verwenden weiterhin ihre bisherigen Berechnungen.

Keine Änderungen an Backend, Datenbank, API, Geschäftsregeln, Autosave, Synchronisierung oder Audit. Login-, Registrierungs- und Einstellungs-Komponenten sowie die eigenständige Druckvorlage wurden nicht geändert; sie verwenden lediglich die gemeinsamen Theme-Farben.

## Ausgeführte Prüfungen

| Prüfung                | Ergebnis                                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run types:check`  | Erfolgreich                                                                                           |
| `npm run lint`         | Erfolgreich; keine Formatierungs-, Lintfehler oder Lintwarnungen                                      |
| `npm run build`        | Erfolgreich                                                                                           |
| `npm run build:ssr`    | Client- und SSR-Produktionsbuild erfolgreich                                                          |
| `composer test`        | Pint erfolgreich; PHPStan ohne Fehler; 60 Tests, davon 54 erfolgreich, 6 übersprungen; 241 Assertions |
| `npm run test:browser` | 8 Tests erfolgreich: 6 vorhandene unverändert, 2 zusätzliche Darstellungstests                        |

Die sechs vorhandenen Browsertests prüfen weiterhin Projekt-Autosave, Aufgabenerfassung, unabhängige Datumswerte, HTTP-CSRF und Registrierung, Konflikterhalt und Wiederholung, Synchronisierung zweier Sitzungen, Abschluss/Wiederöffnung/Verlauf, fehlgeschlagene Erfassung, Tastaturbedienung, mobile Nutzung, Kalenderbalken und Jahresdruck.

Die zusätzlichen Darstellungstests prüfen Light und Dark Mode bei 1440 × 1000 sowie 390 × 1000 Pixeln: alle fünf Workspace-Ansichten, mobile Sidebar-Navigation, Monats- und Wochenkalender und Detail-Sheet. Sie prüfen den Farbmodus, die Sichtbarkeit und fehlenden horizontalen Seitenüberlauf beziehungsweise den fehlenden inneren Überlauf des Detail-Sheets. Der Jahresplan bleibt innerhalb seines eigenen Tabellenbereichs horizontal scrollbar. Screenshots wurden zusätzlich visuell gesichtet; die Tabellenüberschrift im Jahresplan darf auf schmalen Ansichten umbrechen.

Die Druckprüfung verwendet 40 Projekte mit langen Namen. Sie prüft alle Zeilen, Textbegrenzung und Balken innerhalb der Zeitleiste und erzeugt A3- und A4-Querformat-PDFs. Die Druckansicht wurde auch als Screenshot gesichtet. Ein physischer Drucker wurde nicht verwendet.

## Lokale Prüfartefakte

- `storage/test-results/browser-report/index.html`: Playwright-Bericht.
- `storage/test-results/design-{light,dark}-{1440,390}-*.png`: Workspace-, Kalender- und Detail-Screenshots.
- `storage/test-results/design-{light,dark}-login.png`: Vergleich mit dem bestehenden Login.
- `storage/test-results/jahresplan.png`: Druckdarstellung mit 40 Projekten.
- `storage/test-results/jahresplan-2026-A3.pdf` und `jahresplan-2026-A4.pdf`: erzeugte Druckdateien.

Die Browserprüfungen verwenden ausschließlich die bestehende isolierte Browser-Testdatenbank und deren Fixtures. Die erzeugten Prüfartefakte sind lokale, nicht versionierte Dateien. Ältere Prüfprotokolle zur ursprünglichen Implementierung bleiben unverändert.
