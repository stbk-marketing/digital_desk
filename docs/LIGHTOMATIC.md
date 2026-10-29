# Lightomatic – Integration und Prüfung

## Grundlage und Checkpoint

Vor dem Theme-Wechsel wurde der bestehende Stand einschließlich Papierkorb als Commit `bad1efa` gesichert: `Checkpoint before Lightomatic theme integration`.

Verbindliche Quelle: [Lightomatic auf tweakcn](https://tweakcn.com/themes/cmviycizo000004jv3p0zffxe), [Registry-Eintrag](https://tweakcn.com/r/themes/cmviycizo000004jv3p0zffxe). Installation mit `npx shadcn@latest add https://tweakcn.com/r/themes/cmviycizo000004jv3p0zffxe --yes`. Der unveränderte abgerufene Registry-Inhalt liegt zum Abgleich in `docs/themes/lightomatic.registry.json`.

Die Application-Demo wurde im Browser geöffnet und als visuelle Referenz gesichtet. Übernommen wurden ihre Trennung von Oberflächen, Rahmen, Typografie und kompakten Inhaltsbereichen. Aktien-, Chat- und andere Demofunktionen wurden nicht nachgebaut. Der lokale Referenz-Screenshot liegt unter `storage/test-results/lightomatic-reference.png`.

## Theme und technische Anpassungen

Die globale CSS-Datei enthält die Light-/Dark-Farben, Charts, Sidebar-Tokens, Radius, Schatten, Spacing und Tracking des Registry-Eintrags. Stone-/Emerald-Werte und Instrument Sans wurden ersetzt. Das bestehende Appearance-System, die shadcn-Komponenten und die vorhandene CLI-Konfiguration bleiben erhalten; `components.json` wurde nicht neu initialisiert. Dessen `baseColor` beschreibt weiterhin die Komponenten-Generatorbasis, nicht die jetzt verwendete Laufzeitpalette.

Die CLI erzeugte neben dem bestehenden `@theme` einen weiteren `@theme inline`-Block mit identischen beziehungsweise selbstreferenzierenden Variablen. Diese wurden zu einem konsistenten Tailwind-4-Block zusammengeführt. Farben verweisen auf die Modus-Tokens; Fontfamilien, Schatten und Spacing werden ohne Selbstreferenzen zugeordnet. Radius-Abstufungen entsprechen den von der CLI erzeugten Faktoren. `letter-spacing` verwendet das vorgesehene Tracking.

Die Schriften werden über lokale Fontsource-Pakete und lokale WOFF/WOFF2-Dateien ausgeliefert: Outfit variabel, Playfair Display variabel sowie Space Mono 400/700. Die Font-Face-Namen der variablen Pakete wurden als `Outfit` beziehungsweise `Playfair Display` registriert, damit die Theme-Variablen direkt auf die tatsächlichen Schriftdateien zeigen. Die unveränderten Font-Lizenzen liegen zusätzlich unter `public/fonts/LICENSES.txt`, damit sie auch ohne `node_modules` im ausgelieferten Projekt enthalten sind. Die bisherige Bunny-Font-Konfiguration und `@fonts` wurden entfernt; es gibt keine externen Font-Anfragen.

**Abweichung zur aktuellen Registry:** Dort ist `font-serif` als System-Serif-Fallback definiert. Entsprechend der ausdrücklichen Auftragsvorgabe wurde dieser Slot mit lokalem Playfair Display belegt. Die Oberfläche behält ihre im Theme vorgesehene Sans-Typografie; es wurden keine beliebigen Überschriften auf Serif umgestellt.

Die vorab eingeblendeten HTML-Hintergründe verwenden ebenfalls Lightomatic und vermeiden den bisherigen weißen beziehungsweise Stone-farbenen Ladehintergrund. Die Inertia-Fortschrittsanzeige verwendet `--primary`. Bestehende neutrale Sonderfarben in gemeinsam genutzten Profil-/Navigationskomponenten und das grüne Login-Icon wurden durch semantische Tokens ersetzt. Der Standardwert des nativen Projekt-Farbwählers entspricht nun dem Lightomatic-Primary `#d33682`; gespeicherte Projektfarben werden nicht verändert.

Ein zusätzlicher Lauf mit längeren Aufgabenlisten deckte ein Positionierungsproblem beim Wechsel zu Projekten auf: Automatisches Scrollen konnte ein Projektmenü unter die fixierte Schnellerfassung beziehungsweise aus dem sichtbaren Bereich verschieben. `scroll-pt-24` am HTML-Element reserviert dafür einen Scrollabstand von 6 rem, ohne Layout-Padding, zusätzlichen Klick oder Eingriff in die Navigation. Ein eigener Regressionstest prüft den normalen Menüklick nach Rückkehr aus einer langen Liste; er verwendet keine erzwungenen Klicks.

### Dokumentierte Kontrastkorrekturen

Die folgenden Originalwerte ergaben bei normal großer Schrift unzureichenden Kontrast. Als Schriftfarbe wird ausschließlich der bereits vorhandene originale Dark-Background-Ton `oklch(0.2673 0.0486 219.8169)` verwendet, keine zusätzliche Palette. Die Hintergründe bleiben original.

| Textrolle                 | Modus          | Original | Korrigiert |
| ------------------------- | -------------- | -------- | ---------- |
| Secondary-Foreground      | Light und Dark | 3,16:1   | 4,75:1     |
| Sidebar-Accent-Foreground | Light und Dark | 3,16:1   | 4,75:1     |
| Accent-Foreground         | Light          | 2,34:1   | 6,40:1     |

Die übrigen geprüften Textpaare bleiben unverändert: Body Light 12,05:1, Card Light 10,61:1, Body Dark 5,61:1, Card Dark 4,86:1, Primary 4,55:1 und Dark Accent 4,61:1. Messung: Browser-Canvas nach sRGB-Darstellung, relative Luminanz, auf zwei Stellen gerundet. Dies ist eine gezielte Prüfung der Theme-Textpaare, keine Behauptung einer vollständigen WCAG-Zertifizierung.

Das vorhandene Dropdown-Menü verwendete für destruktive Menüeinträge `text-destructive-foreground` ohne destruktiven Hintergrund. Mit dem Originaltheme wäre der Text weiß auf heller Popover-Fläche gewesen. Es verwendet dafür jetzt den semantisch passenden `text-destructive`-Token; die Destructive-Buttons behalten ihre vorgesehenen Vorder-/Hintergründe.

## Schreibtisch und unveränderte Bedienung

Die Schnellerfassung wird mit Primary-Rahmen, Theme-Schatten und Fokusmarkierung hervorgehoben. Suche und Filter stehen in einer eigenen, durch Abstände und Rahmen abgegrenzten Zeile. Die vorhandenen Aufgabengruppen behalten ihre Beschriftung und Auf-/Zuklappfunktion. Sie unterscheiden sich durch Card-Kopf, Zähler und einen eigenen Inhaltsbereich.

Aufgaben erhalten kompakte, dezente Container mit Hover-/Fokuszuständen. Titel sind stärker gewichtet; ihr Eingaberahmen tritt im Ruhezustand zurück und wird beim Bearbeiten wieder erkennbar. Frist, Zuständigkeit und Projekt bleiben unmittelbar bearbeitbar. Es gibt keine zusätzlichen Klicks, Dialoge oder Pflichtfelder. Überfälligkeitsregeln und Gruppierung wurden nicht verändert; die beschrifteten Gruppen vermitteln Status auch ohne Farbe.

Backend, Datenbank, Migrationen, API, Authentifizierung, Autosave, optimistische Updates, Audit, Synchronisierung, Kalenderberechnung/Drag-and-drop, Jahresplanung und Exportlogik wurden für diesen Auftrag nicht geändert. Die eigenständige druckoptimierte Jahresvorlage bleibt unverändert und lädt das Bildschirmtheme nicht.

## Geänderte Dateien

- `resources/css/app.css`: vollständiges Theme, Tailwind-Zuordnung und dokumentierte Kontrastkorrekturen.
- `resources/css/fonts.css`, `package.json`, `package-lock.json`, `vite.config.ts`: lokale Fonts und Entfernung der bisherigen Font-Anbindung.
- `public/fonts/LICENSES.txt`: originale Font-Lizenzen und Copyright-Hinweise.
- `resources/views/app.blade.php`, `resources/js/app.tsx`: rein visuelle Startfarben und Fortschrittsfarbe.
- `resources/js/pages/workspace.tsx`, `resources/js/workspace/task-section.tsx`: visuelle Aufgabenhierarchie.
- `resources/js/workspace/projects.tsx`: ausschließlich Theme-Fallback des Farbwidgets.
- `resources/js/layouts/auth/auth-simple-layout.tsx`: Theme-Farbe des Login-Icons.
- `resources/js/components/{app-header,appearance-tabs,nav-footer,text-link,user-info}.tsx`: semantische Theme-Farben.
- `resources/js/components/ui/dropdown-menu.tsx`: lesbare destruktive Menüeinträge.
- `tests/Browser/design.spec.ts`: Theme-, Font-, Darstellungs- und Druckprüfungen.
- `tests/Browser/menu-layout.spec.ts`: Regressionstest für erreichbare Projektmenüs bei längeren Aufgabenlisten.
- `docs/themes/lightomatic.registry.json`, dieses Protokoll: nachvollziehbare Quelle und Dokumentation. Das bestehende `docs/PAPIERKORB.md` wurde vom Formatter ausschließlich formatiert, nicht inhaltlich geändert.

Parallel vorgenommene Änderungen an Sidebar-Logo und Beschriftung wurden erhalten. Der dadurch ungenutzte Icon-Import wurde bereinigt; diese Branding-Änderungen sind keine eigenständige Theme-Neugestaltung.

## Qualitätssicherung

Der erweiterte Darstellungstest vergleicht alle Farb-Tokens mit der eingefrorenen Registry einschließlich der ausdrücklich dokumentierten Kontrastausnahmen. Minimale Rundungen durch CSS-Minifizierung werden mit einer Toleranz von 0,001 pro Farbkanal berücksichtigt. Radius und Schatten werden im Browser geprüft. Alle drei Fontfamilien müssen tatsächlich lokal laden; externe Font-Anfragen führen zum Fehler.

Screenshots und Überlaufprüfungen erfassen alle sechs Workspace-Ansichten bei 1440, 820 und 390 Pixeln, zusätzlich Wochenkalender, Detail-Sheet, Login, Registrierung und Profil-/Passwort-/Appearance-Seiten in beiden Modi. Die bestehenden funktionalen Browserfälle bleiben erhalten. Druck wird auch bei emuliertem Dark Mode auf fehlende Theme-/Schattenübernahme geprüft; die vorhandene Prüfung erzeugt weiterhin A3-/A4-Querformat-PDFs mit 40 langen Projektnamen.

### Abschlussprotokoll – 23. Oktober 2026

| Prüfung                                              | Ergebnis                                                                                                                                                                                  |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TypeScript `npm run types:check`                     | Bestanden                                                                                                                                                                                 |
| Lint und Format `npm run lint` / `npm run check:fix` | Bestanden, keine Lintwarnungen oder Lintfehler                                                                                                                                            |
| `npm run build:ssr`                                  | Client-Produktionsbuild und SSR-Build bestanden                                                                                                                                           |
| `composer test`                                      | Pint bestanden, PHPStan ohne Fehler; 69 Tests: 63 bestanden, 6 wie bisher übersprungen; 359 Assertions                                                                                    |
| `npm run test:browser`                               | Alle 13 Tests bestanden, 4,8 Minuten                                                                                                                                                      |
| Ergänzender visueller Lauf                           | Alle 3 Design-/Menütests bestanden, 2,1 Minuten; stabile Screenshots ohne laufende Animationen, Dropdowns und Dialoge in beiden Modi                                                      |
| Light/Dark, responsive                               | Alle sechs Workspace-Ansichten ohne horizontalen Seitenüberlauf bei 1440, 820 und 390 Pixeln; lokale Fonts tatsächlich geladen, keine externen Font-Anfragen                              |
| Jahresdruck                                          | Bestehende Geometrieprüfung mit 40 langen Projektnamen bestanden, A3-/A4-Querformat-PDFs erzeugt; Druckdarstellung auch bei Dark-Mode-Präferenz ohne Bildschirmtheme und Schatten geprüft |
| Scope und Whitespace                                 | `git diff --check` bestanden; keine Änderungen unter `app`, `database` oder `routes`                                                                                                      |

Die Screenshots für Aufgaben verwenden gefüllte Gruppen mit überfälligen, heutigen, künftigen und unterminierten Aufgaben sowie Projektzuordnung und Zuständigkeit. Sie wurden in Light/Dark auf Desktop, Tablet und Smartphone gesichtet. Authentifizierung, Profilseiten, Details, Dropdowns, Dialoge, Kalender, Projekte und Druckdarstellung wurden ebenfalls anhand der erzeugten Bilder geprüft. Browserbasis ist das konfigurierte lokale Chrome; ein physischer Drucker wurde nicht verwendet.

Lokale, nicht versionierte Prüfartefakte:

- `storage/test-results/browser-report/index.html`: vollständiger Bericht mit 13 erfolgreichen Tests. Der anschließende fokussierte Lauf verwendete ausschließlich den Listenreporter und einen getrennten Ausgabeordner `visual-check`.
- `storage/test-results/design-{light,dark}-{1440,820,390}-Schreibtisch.png`: Schreibtisch mit gefüllten Aufgabengruppen.
- Weitere `design-*.png`: alle Workspace-Ansichten, Wochenkalender, Details, Login/Registrierung, Profil/Passwort/Darstellung, Dropdowns, Dialoge und Druck.
- `storage/test-results/jahresplan-2026-A3.pdf` und `jahresplan-2026-A4.pdf`: erzeugte Druckdateien.

Zwischenläufe deckten die oben dokumentierten CSS-Serialisierungsunterschiede, ursprüngliche Theme-Kontrastprobleme und den reproduzierbaren Menü-Scrollfehler auf. Die abschließenden vollständigen und fokussierten Läufe bestehen; vorhandene funktionale Tests wurden nicht abgeschwächt. Das längere Zeitlimit der erweiterten Darstellungstests berücksichtigt zusätzliche Ansichten, Viewports, Fontprüfungen und Screenshots.
