# UI-Redesign – Prüfprotokoll

Referenz: vom Nutzer bereitgestelltes grünes Produktivitäts-Dashboard, 30.10.2026. Neue Tokens und Layoutregeln stehen in DESIGN.md, unveränderte fachliche Abläufe und gemeinsame UI-Eigentümer in UX-CONTRACT.md.

## Änderungen

- Dunkelgrüne Navigation mit lokaler SVG-Blattzeichnung, cremefarbene Arbeitsfläche und responsives Kartengitter.
- Mehrzeilige, mitwachsende Erfassung mit Enter/Shift+Enter sowie Termin-, Personen- und Projektzuordnung.
- Suche und Filter in Radix-Dialogen mit sichtbaren Labels, Escape und Fokusrückgabe.
- Bestehende direkte Titelbearbeitung und automatische Speicherung erhalten; weitere Felder und Aktionen im rechten Detailbereich.
- Vorhandene Browserprüfungen an die mehrzeiligen Titel und den neuen Zugang zu Details angepasst. Die veralteten Lightomatic-Registry-Vergleiche im Design-Test durch Prüfungen des angeforderten Workspace-Themas ersetzt; Auth-, Ansichts-, Druck- und Responsive-Screenshots bleiben enthalten.
- Überholte Polling-Antworten nach Wechsel des Detailkontexts werden ignoriert. Eine Wiederherstellung schließt den alten Detailbereich vor dem Nachladen, damit sie einen danach neu geöffneten Detailbereich nicht verspätet schließt.

## Nachweise

- `npm.cmd run types:check`: erfolgreich.
- `npm.cmd run build`: erfolgreich; SVG wird lokal mit dem Build gebündelt.
- `npm.cmd run build:ssr`: Client- und SSR-Build erfolgreich.
- Geänderte TypeScript-Dateien einschließlich Browserprüfungen: gezielter Vite+-Lint erfolgreich.
- `php artisan test --compact --filter='WorkspaceTaskTest|DashboardTest'`: 8 Tests, 42 Assertions erfolgreich.
- `designmd lint DESIGN.md`: 0 Fehler, 0 Warnungen.
- Playwright: Desktop-/Tablet-/Mobilansichten, helle und dunkle Systemeinstellung, reduzierte Bewegung, Erfassung und Zuordnung, Suche/Filter, Fokusrückgabe, Autosave, Offline-Retry, Versionskonflikt, Team-Synchronisierung, Papierkorb und Druckansicht. Tatsächliche Ergebnisse werden im Browserreport ausgegeben; Screenshots unter `storage/test-results/`.
- Im vollständigen Lauf bestanden 13 von 14 Fällen. Der dabei gefundene Fehler beim schnellen Wiederherstellen und erneuten Öffnen wurde behoben. Die fünf betroffenen Abläufe (Papierkorb, neues UI, Konflikt, Team-Synchronisierung, Offline-Retry) bestanden anschließend vollständig: 5/5 in 1,7 Minuten. Abschließende Desktop- und Mobil-Screenshots wurden visuell kontrolliert.

## Grenzen der Zusatzprüfungen

`npm.cmd run lint` formatiert alle Projektdateien erfolgreich, schlägt wegen einer vorhandenen Warnung in der nicht zum Redesign gehörenden Datei `tools/legacy/export-fdm.mjs:13` fehl (`no-control-regex`, Nullzeichen in einem regulären Ausdruck). Diese Importdatei wurde fachlich nicht geändert.

Der zusätzliche statische Premium-Audit erzeugt `storage/test-results/premium-audit.json` mit 0 ungeklärten Eigentümern und 15 Meldungen. Fünf Meldungen erkennen vorhandene delegierte Aktionen nicht: den DnD-Listener in `calendar.tsx`, den Radix-Collapsible-Trigger in `task-section.tsx` und drei `asChild`-Links in `year-plan.tsx`. Diese Elemente haben implementierte Aktionen; die Browserprüfung bestätigt die betroffenen Ansichten. Die weiteren zehn Meldungen betreffen unveränderte Formulare in Auth/Kontoeinstellungen/Projekten (fehlendes explizites `noValidate`) und die bestehende Projekt-Textarea (Resize-Regel). Deren Validierungsverhalten wird im Rahmen dieses visuellen Umbaus nicht verändert. Der statische Zusatz-Audit ist deshalb kein vollständig grüner Projektcheck.
