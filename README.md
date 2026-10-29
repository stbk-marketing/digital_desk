# Kühl Workspace

Neues internes Laravel-/React-Projekt nach `../UMSETZUNG.md`, ohne Übernahme alter Daten oder Filament. Fünf Perspektiven: Schreibtisch, eigener Monats-/Wochenkalender, Projekte, grafischer Jahresplan mit A3-Druck/CSV und Wochencheck. Aufgaben brauchen nur einen Titel. Änderungen werden automatisch gespeichert und mit Account/Zeitpunkt nachvollziehbar protokolliert.

Laravel 13 · React 19 · TypeScript · Inertia 3 · Fortify · Tailwind 4 · SQLite. Alle fachlichen Daten liegen auf dem eigenen Server. Kein KI-Dienst, Redis, Reverb, FullCalendar oder zusätzlicher Hostinganbieter erforderlich.

## Lokal starten (Windows / PowerShell)

Voraussetzungen: PHP >= 8.3 einschließlich SQLite/SQLite3, Composer, Node 24 und npm. Im Ordner `kuehl-workspace`:

```powershell
composer install --no-interaction
npm.cmd ci
Copy-Item .env.example .env
php artisan key:generate
php artisan migrate
npm.cmd run build
php artisan serve --host=127.0.0.1 --port=8000
```

`.env` nur bei der Erstinstallation kopieren. Aufruf: `http://localhost:8000`. Für HMR zusätzlich `npm.cmd run dev` in einem zweiten Terminal. Ohne gesetztes `DB_DATABASE` verwendet Laravel `database/database.sqlite`, außerhalb public.

Registrierung ist standardmäßig gesperrt. In `.env` `WORKSPACE_REGISTRATION_ENABLED=true` und einen zufälligen `WORKSPACE_REGISTRATION_CODE` mit mindestens 24 Zeichen setzen. Beispielsweise einmalig `php -r "echo bin2hex(random_bytes(24));"` ausführen; den ausgegebenen Wert vertraulich halten. Danach `php artisan config:clear`. `MAIL_MAILER=log` schreibt lokale Verifikations-/Reset-Mails in `storage/logs/laravel.log`; für SMTP/Mailpit siehe Betriebsdoku. Produktiv ist echtes SMTP zwingend.

## Mit zwei Accounts prüfen

1. Zwei getrennte Browserprofile öffnen und je ein Konto mit Anzeigename, E-Mail, Passwort und internem Code registrieren.
2. Beide E-Mail-Adressen über die jeweiligen Links bestätigen. Unbestätigte Accounts dürfen keine Workspace-Daten öffnen.
3. A erfasst `Klamotten Filiale 9100 Jarmen packen` mit Enter. B sieht die Aufgabe bei Fokus bzw. spätestens nach dem nächsten 7-Sekunden-Poll.
4. B hakt sie ab; A sucht `9100`, öffnet sie wieder und prüft im Detail den Verlauf mit beiden Namen.
5. Ein Projekt mit Start/Ende anlegen, darin eine Aufgabe erfassen, ihre separate Frist ändern. Jahresplan → Druckansicht → „Drucken / Als PDF speichern“.
6. Vor Produktivfreigabe echte Verifikations-/Reset-Mails, abgelaufene Links, HTTPS, Kontodeaktivierung, Excel-DE und Firmenbackup-Restore abnehmen.

## Prüfungen

```powershell
composer test
npm.cmd run types:check
npm.cmd run lint
npm.cmd run build
npm.cmd run build:ssr
npm.cmd run test:browser
```

Die Browserprüfung nutzt installiertes Google Chrome, Port 8123 und ausschließlich `storage/framework/browser.sqlite`. Sie erstellt dort zwei verifizierte Testkonten und 40 Drucktest-Projekte neu; die lokale Workspace-Datenbank wird nicht angefasst. Testdaten-/Mailkonfiguration gilt nur im Testserver-Prozess. Bei fehlendem Chrome den Playwright-Channel bewusst auf einen lokal vorhandenen Browser anpassen. Screenshots, PDF, Trace und Browserreport liegen unter `storage/test-results/` und werden nicht committed.

`composer test` führt PHP-Lint, PHPStan (1 GB Speicherlimit) und die Backendtests aus. Die bewusst ausgeschalteten 2FA-/Passkey-Funktionen des offiziellen Starters sind kein MVP-Bestandteil; zugehörige Startertests können übersprungen werden. Die detaillierten tatsächlichen Ergebnisse und offenen Vor-Ort-Prüfungen stehen in [docs/TESTCHECKLISTE.md](docs/TESTCHECKLISTE.md).

## Dokumentation

- [Architektur, Datenintegrität, Synchronisierung und spätere KI-Phase](docs/ARCHITEKTUR.md)
- [Windows-/Linux-Installation, interner Firmenhost, SMTP, Backup/Restore und Rollback](docs/BETRIEB.md)
- [Abnahmematrix und Testprotokoll](docs/TESTCHECKLISTE.md)

Fehlgeschlagene Änderungen bleiben sichtbar und lassen sich erneut senden. Entwürfe bleiben im Arbeitsspeicher des offenen Tabs; beim Verlassen mit ungespeicherten Änderungen warnt der Browser. Es gibt keine dauerhafte Offline-Speicherung sensibler Workspace-Inhalte. Geplante Projektzeiträume und protokollierte Bedienaktionen sind keine Nachweise geleisteter Arbeitszeit.

Basis: [offizielles Laravel React Starter Kit](https://github.com/laravel/react-starter-kit), MIT-Lizenz.
# digital_desk
