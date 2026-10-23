# Papierkorb und endgültiges Löschen

## Verhalten

Aufgaben und Projekte haben einen eigenen Soft-Delete-Status mit Löschdatum und ausführendem Benutzer. Archivierung und Löschung sind unabhängig. Wiederherstellung behält Archivstatus, Fristen, Abschlussstatus und Notizen bei. Reguläre Abfragen, Suche, Kalender, Wochencheck, Projektzähler und Jahresberichte schließen Soft Deletes aus. Der Papierkorb in der Navigation zeigt beide Objekttypen mit getrennten Seiten zu je 40 Einträgen. Es gibt keinen automatischen Löschjob.

Das Drei-Punkte-Menü bietet „Löschen“. Bei Projekten erläutert zuvor ein Dialog, dass Aufgaben erhalten bleiben. Nach erfolgreichem Verschieben erscheint ein zehn Sekunden sichtbarer Toast mit „Rückgängig“. Auch danach ist Wiederherstellung im Papierkorb möglich. Endgültiges Löschen benötigt einen ausdrücklichen Bestätigungsdialog; die API verlangt zusätzlich `confirmed=true` und die aktuelle Version. Aktive Einträge können nicht direkt endgültig gelöscht werden.

## Projektzuordnungen

Projektlöschung löst in derselben Transaktion alle zugehörigen Aufgaben, einschließlich bereits gelöschter Aufgaben. Die Aufgaben selbst werden nicht gelöscht. Jede gelöste Aufgabe bekommt eine neue Version, einen Audit-Eintrag und ein Synchronisierungsereignis. `project_task_recoveries` speichert ausschließlich Projekt-ID, Aufgaben-ID, Lösezeitpunkt und die Version direkt nach dem Lösen, keine Kopien von Titeln oder Notizen.

Bei Projektwiederherstellung kann die Wiederzuordnung abgewählt werden. Automatisch verbunden werden nur aktive, noch unzugeordnete Aufgaben mit exakt der vorgemerkten Version. Jede zwischenzeitliche Änderung verhindert diese automatische Wiederzuordnung; auch eine Zuordnung mit anschließendem erneutem Lösen wird nicht überschrieben. Erfolgreiche Zuordnungen erhalten neue Versionen und Audit-Ereignisse. Übersprungene Zuordnungen bleiben über „Frühere Zuordnungen“ im Papierkorb beziehungsweise am wiederhergestellten Projekt nachvollziehbar. Eine abweichende Zuordnung erfolgt bewusst über die bestehende Aufgabenverwaltung.

## Parallelität und Synchronisierung

Alle Lösch-, Wiederherstellungs- und endgültigen Löschoperationen prüfen `expected_version` und Zustand innerhalb einer Transaktion. Projektlöschung und Projektzuweisung verwenden dieselbe Projektsperre; Aufgabenänderungen prüfen zusätzlich atomar die Version. Fremdschlüssel bleiben erhalten. Veraltete Schreibversuche liefern einen Konflikt, statt gelöschte Einträge neu anzulegen. Wiederholungen alter Erfassungs-Requests erzeugen nach einer Löschung keine Ersatzkopie.

Der bestehende Änderungsstrom enthält zusätzlich IDs inzwischen entfernter Einträge. Weitere Änderungsseiten werden im selben Polling-Durchlauf abgearbeitet, damit ein großer Rückstand Löschereignisse nicht über mehrere Intervalle verzögert. Damit verschwinden Einträge auch bei anderen angemeldeten Personen, einschließlich offener Detailansichten. Lokale noch nicht gespeicherte Aufgaben- und Projektentwürfe werden nicht stillschweigend verworfen: Sie bleiben in einem getrennten Konflikthinweis zum Kopieren oder ausdrücklichen Verwerfen erhalten, erscheinen aber nicht als reguläre Datensätze. Die Erkennung ungespeicherter Entwürfe bleibt aktiv. Synchronisierung verwendet weiterhin das vorhandene Polling und Fokus-/Online-Refresh.

## Audit und Inhaltslöschung

Soft Delete, Wiederherstellung, endgültiges Löschen und Zuordnungsänderungen protokollieren Person, UTC-Zeitpunkt, Objekt-ID und Ereignis. Die Oberfläche zeigt Zeiten in Europe/Berlin.

Beim endgültigen Löschen werden sämtliche `before`-/`after`-Payloads aller Audit-Ereignisse des betroffenen Objekts auf NULL gesetzt, der vollständige Datensatz einschließlich Suchtext entfernt und ein inhaltsfreies `purged`-Ereignis angelegt. Das geschieht atomar. Diese gezielte Inhaltsbereinigung ist die dokumentierte Ausnahme von der ansonsten unveränderlichen Audit-Historie; die allgemeinen Model-Sperren für Audit-Updates und -Löschungen bleiben bestehen. Andere Objekte behalten ihre eigenen Inhalte. Ihre Zuordnungsereignisse enthalten lediglich Objekt-IDs, keine vollständigen Projektkopien. Recovery-Zeilen werden beim endgültigen Löschen des Projekts oder der Aufgabe per Fremdschlüssel entfernt. Technische Request-Belege und Änderungscursor enthalten nur IDs und bleiben gegen versehentliches Wiederanlegen erhalten.

## Backups und Betrieb

Löschen betrifft die aktive Anwendungsdatenbank. Bereits erzeugte Backups, exportierte CSV-/PDF-Dateien und externe Sicherungen werden dadurch nicht rückwirkend verändert. Für vorhandene Backups gelten weiterhin die getrennt festgelegten Aufbewahrungsfristen, Zugriffsbeschränkungen, Verschlüsselung und Rotation aus `BETRIEB.md`. Eine Löschung löst keine pauschale Backup-Löschung aus.

Vor einem Restore müssen seit dem Sicherungsstand erfolgte endgültige Löschungen anhand der inhaltsfreien Löschereignisse beziehungsweise des betrieblichen Löschprotokolls berücksichtigt und vor erneuter Freigabe nachgeführt werden, damit Inhalte nicht unbeabsichtigt wieder verfügbar werden. Physische Datenträger-, SQLite-Journal- und Sicherungsbereinigung unterliegen dem getrennten Betriebskonzept; die Anwendung verspricht keine forensische Datenträgerlöschung.

Auslieferung: vorhandenes Backup erstellen, Release einspielen und `php artisan migrate --force` im vorgesehenen Wartungsablauf ausführen. Die Migration ergänzt Löschspalten und Recovery-Metadaten, verändert keine bestehenden Archivzustände. Ein Rollback entfernt Papierkorb-Metadaten; produktiv daher den üblichen geprüften Release-/Restoreplan verwenden.

## Prüfungen

`WorkspaceTrashTest` prüft Soft Delete/Wiederherstellung, Archivierung, Akteur/Zeitpunkt, Such-/Kalenderausschluss, Jahresplanung, verknüpfte und bereits gelöschte Aufgaben, sichere/abgewählte Zuordnungswiederherstellung, Konflikte, Zugriffsschutz, Bestätigung, Audit-Payload-Bereinigung, Fremdschlüssel und verhinderte Wiederanlage.

`WorkspaceConcurrencyTest` prüft zusätzlich konkurrierendes Löschen und Bearbeiten jeweils für Aufgaben und Projekte in zwei PHP-Prozessen: genau ein Gewinner, keine Wiederbelebung, keine zusätzlichen Audit-Einträge. Ein weiterer Backendtest prüft Löschmarkierungen bei mehr als 200 ausstehenden Änderungsereignissen.

`tests/Browser/trash.spec.ts` prüft Aufgaben und Projekte einschließlich Undo, Papierkorb, Wiederherstellung, Sicherheitsbestätigung, verknüpfte Aufgaben, Verlauf, Löschen aus dem Detail-Sheet und Synchronisierung mit einer zweiten Browsersitzung. Zwei zusätzliche Fälle prüfen den Erhalt lokaler Aufgaben- und Projektentwürfe bei paralleler Löschung.

### Abschlussprotokoll vom 23. Oktober 2026

| Prüfung | Ergebnis |
| --- | --- |
| `composer test` | Pint bestanden; PHPStan ohne Fehler; 69 Tests: 63 bestanden, 6 wie bisher übersprungen; 359 Assertions |
| `npm run types:check` | Bestanden |
| `npm run lint` / `npm run check:fix` | Keine Lintfehler oder Lintwarnungen; Formatierung bestanden |
| `npm run build` | Produktionsbuild bestanden |
| `npm run build:ssr` | Client- und SSR-Produktionsbuild bestanden |
| `npm run test:browser` | Alle 12 Tests bestanden, 3,7 Minuten; 8 vorhandene Tests und 4 neue Papierkorb-/Synchronisierungstests |
| `php artisan migrate --no-interaction` | Lokale Papierkorb-Migration erfolgreich angewendet |
| `git diff --check` | Bestanden |

Darstellung: vorhandene Light-/Dark- und Responsive-Tests weiterhin bestanden; zusätzlich Papierkorb in Light Mode und bei 390 Pixeln im Dark Mode geprüft und Screenshots gesichtet. Die bestehenden Tests für Tastaturbedienung, Autosave, Konflikte, Registrierung/CSRF, zwei Sitzungen, Kalender und Jahresdruck bestehen. A3-/A4-PDFs mit 40 langen Projektnamen wurden erneut erzeugt; kein physischer Druckertest.

Lokale Artefakte: `storage/test-results/browser-report/index.html`, `trash-light.png`, `trash-dark-mobile.png`, bestehende `design-*.png` sowie `jahresplan-2026-A3.pdf` und `jahresplan-2026-A4.pdf`. Diese Testartefakte werden nicht versioniert. Browserprüfungen verwenden die isolierte Browser-Testdatenbank, Paralleltests jeweils eigene temporäre SQLite-Dateien.

Während der Entwicklung wurden eine Kollision neuer Testkonten mit dem vorhandenen Registrierungstest und ein nach Umbenennung ungültiger Testselektor korrigiert. Ein Zwischenlauf wurde durch einen gleichzeitig laufenden Build mit kurzzeitig fehlendem Manifest gestört. Der abschließende vollständige Browserlauf lief gegen den fertigen Build ohne parallele Builds und bestand vollständig; bestehende Browsertests und Timeouts wurden nicht abgeschwächt.
