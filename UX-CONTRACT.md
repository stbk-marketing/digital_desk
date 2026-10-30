# UX Contract

## Product context

Interner gemeinsamer Workspace der Stadtbäckerei Kühl. Deutsch, de-DE, Europe/Berlin, Datumswerte ohne UTC-Verschiebung. Ziel: WCAG 2.2 AA. Visuelle Referenz und Runtime-Tokenpfad: DESIGN.md.

## Business-context sources

| Domain / scope                                 | Authoritative source                                           | Source type             | Reviewed date |
| ---------------------------------------------- | -------------------------------------------------------------- | ----------------------- | ------------- |
| Berechtigungen, Lebenszyklus, Synchronisierung | docs/ARCHITEKTUR.md                                            | Maintained architecture | 2026-10-30    |
| Fachliche Einstiegspunkte und Betrieb          | README.md                                                      | Product documentation   | 2026-10-30    |
| Validierung und Mutation                       | app/Http/Requests/TaskRequest.php und bestehende Workspace-API | Server contract         | 2026-10-30    |

## Canonical UI Map

| Capability     | Canonical owner                     | Source of truth                              | Allowed variants                                       | Verification                                      |
| -------------- | ----------------------------------- | -------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------- |
| Select/Listbox | NativeSelect                        | resources/js/components/ui/native-select.tsx | Native, plattformgesteuertes Popup                     | Browser: Filter, Erfassung, Details               |
| Date           | Input type=date                     | resources/js/components/ui/input.tsx         | Native, plattformgesteuertes Popup und Tastatureingabe | Browser: Erfassung, Details, Kalender             |
| Form           | Textarea, Input, DraftInput         | resources/js/workspace/draft-input.tsx       | Enter-Erfassung, automatisches Speichern               | tests/Browser/workspace.spec.ts                   |
| Scrollbar      | Globale CSS-Basis                   | resources/css/app.css                        | Standard, Detailbereich mit eigener Geometrie          | Browser: schmale und lange Ansichten              |
| Toast          | Sonner und bestehende Statusanzeige | resources/js/workspace/record-actions.tsx    | Erfolg, Fehler, Rückgängig                             | tests/Browser/trash.spec.ts                       |
| CRUD           | Workspace und vorhandene API        | resources/js/pages/workspace.tsx             | Im aktuellen Kontext bleiben                           | tests/Browser/workspace.spec.ts und trash.spec.ts |

## Dataset navigation

Aufgaben serverseitig mit 60 Einträgen pro Seite; Historie 40. Suche, Filter und Seite bleiben wie bisher im flüchtigen React-Zustand, ohne sensible Suchbegriffe in URL oder dauerhafter Speicherung. Nur die Perspektive wird lokal gespeichert. Abschnittszähler beziehen sich auf die geladene Seite.

Suche erfolgt mit Debounce und Versionszähler gegen veraltete Antworten. Suchdialog schließt über „Ergebnisse anzeigen“, Escape oder Schließen. Filter ändern die aktuelle Ansicht; aktive Kriterien bleiben oberhalb der Liste sichtbar und gemeinsam zurücksetzbar. Leere Abschnitte enthalten einen Hinweis, Verbindungsfehler erhalten Daten und bieten erneutes Laden.

## Flow ledger

| Operation   | Trigger                       | Pending                  | Success destination   | Success feedback            | Failure recovery                           | Focus outcome         | Source ref    |
| ----------- | ----------------------------- | ------------------------ | --------------------- | --------------------------- | ------------------------------------------ | --------------------- | ------------- |
| Create      | Enter oder Hinzufügen         | Lokale Karte             | Aktuelle Ansicht      | Gespeicherte Karte          | Entwurf und Erneut versuchen               | Eingabefeld           | Workspace     |
| Edit        | Kartentitel oder Detailfelder | Wird gespeichert         | Gleiche Karte/Details | Aktualisierter Wert         | Entwurf, Serververgleich, expliziter Retry | Aktives Feld          | DraftInput    |
| Search      | Suche öffnen                  | Bestehende Daten bleiben | Aktuelle Ansicht      | Trefferzahl und Suchbegriff | Erneut laden, Suchbegriff löschen          | Zurück zum Suchbutton | Workspace     |
| Soft-delete | Detailaktionen                | Bestehender Löschablauf  | Liste/Papierkorb      | Rückgängig                  | Bestehende Fehlermeldung                   | Bestehender Kontext   | RecordActions |
| Hard-delete | Papierkorb                    | Bestätigungsdialog       | Papierkorb            | Bestätigung                 | Retry im bestehenden Ablauf                | Bestehender Kontext   | Trash         |

## Navigation and overlays

Die sechs bestehenden Perspektiven bleiben über dieselbe Navigation erreichbar. Mobil schließt die Navigation nach Auswahl. App-owned Radix Dialog für Suche und Filter: Fokus hinein, Tab-Falle, Escape, Fokus zurück zum Auslöser. Der bestehende Radix-Sheet-Detailbereich bleibt ein dokumentierter nichtmodaler Drawer ohne Fokusfalle; ab 1280px wird daneben Platz reserviert. Explizites Schließen und Escape schließen Details. Tastaturkürzel N und Ctrl/Cmd+K fokussieren weiterhin die zentrale Erfassung. Shift+Enter fügt dort einen Zeilenumbruch ein; Enter während IME-Komposition speichert nicht vorzeitig.

## Async and resilience

Bestehende optimistische In-Memory-Entwürfe, serialisierte Mutationen je Datensatz, erwartete Versionen und idempotente Erfassung unverändert verwenden. Textdebounce 500ms, Flush bei Blur/Unmount. Konflikte zeigen lokale und aktuelle Serverdaten, Retry ist explizit. Polling 7 Sekunden, zusätzlich Fokus/Reconnect. Beim Verlassen mit offenen Entwürfen bleibt der beforeunload-Schutz. Keine zusätzliche dauerhafte Offline-Speicherung. Servervalidierung und Berechtigungen bleiben unverändert.

## Verification

TypeScript, Format/Lint, Produktionsbuild und Playwright. Browsermatrix: 1440/820/390px, helle/dunkle Systemeinstellung bei festem Workspace-Thema, reduzierte Bewegung, lange Inhalte, leere Treffer, Erstellen/Ändern/Erledigen, Konflikt/Offline-Retry, Team-Synchronisierung, Papierkorb und Kalender/Jahresplan. Vergleichsworkflow: Projekte. Statischer Premium-Audit ergänzt die Laufzeitprüfungen.
