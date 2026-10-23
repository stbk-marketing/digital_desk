# Installation und Betrieb

## Interner Host

Bestehende Linux-VM/vHost der Stadtbäckerei Kühl; kein zusätzlicher netcup-Server. Planungsgröße: 2–4 vCPU, 4–8 GB RAM, 30–40 GB lokale SSD, Linux-Updates, PHP >= 8.3, PHP-FPM und Nginx/Apache. Erforderliche Extensions insbesondere PDO_SQLite, sqlite3 (Onlinebackup), mbstring, intl, DOM/XML, curl, zip, fileinfo, openssl. Getestete Entwicklungsumgebung: PHP 8.4.23, Node 24.18.0, npm 11.16.0, Composer 2.9.3. Node ist für Builds nötig, kein dauerhafter Frontend-Server im Betrieb.

Ein Server, Datenbank auf lokalem SSD-Filesystem, kein NFS/SMB-Netzlaufwerk mit WAL. HTTPS-Hostname intern/VPN, funktionsfähiges SMTP-Relay, tägliches verschlüsseltes externes Backup und benannte Betriebsverantwortliche sind Voraussetzungen. Webroot ausschließlich `kuehl-workspace/public`. `.env`, `storage`, `vendor`, `.git` und `database` dürfen niemals öffentlich gemappt sein.

## Lokal unter Windows / PowerShell

Im Projektordner:

```powershell
composer install --no-interaction
npm.cmd ci
Copy-Item .env.example .env
php artisan key:generate
php artisan migrate
npm.cmd run build
php artisan serve --host=127.0.0.1 --port=8000
```

`Copy-Item` nur bei der Erstinstallation ausführen; vorhandene `.env` nicht ersetzen. Ohne `DB_DATABASE` verwendet Laravel `database/database.sqlite`. Die Datei wird bei der ersten Migration lokal angelegt. Für Entwicklung mit Live-Frontend in einem zweiten Terminal `npm.cmd run dev` starten. In `.env` `APP_URL=http://localhost:8000` setzen. Bei Zugriff über 127.0.0.1 statt localhost APP_URL entsprechend angleichen.

Registrierung lokal aktivieren: zufälligen Code mit `php -r "echo bin2hex(random_bytes(24));"` erzeugen und ausschließlich in `.env` als `WORKSPACE_REGISTRATION_CODE` eintragen; `WORKSPACE_REGISTRATION_ENABLED=true`. Keine echten Codes in Quellcode, Screenshots, Tickets oder VITE-Variablen kopieren. `php artisan config:clear` nach Änderungen.

Für lokale Mailtests `MAIL_MAILER=log` verwenden; Bestätigungs-/Reset-Mails stehen dann ausschließlich lokal in `storage/logs/laravel.log`. Besser Mailpit: `MAIL_MAILER=smtp`, `MAIL_HOST=127.0.0.1`, `MAIL_PORT=1025`, `MAIL_SCHEME=null`. Mailpit muss separat durch die IT/Entwicklung bereitgestellt sein. Log-Transport prüft keinen echten Mailversand. Niemals Tokens aus lokalen Mail-Logs veröffentlichen.

## Linux-Deployment

In einem neuen Release-Verzeichnis aus dem freigegebenen Stand installieren:

```sh
composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
npm ci
npm run build
php artisan migrate --force
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

Die `.env` und eine beschreibbare `database/database.sqlite` müssen vorher existieren. Bei Release-Verzeichnissen `DB_DATABASE` als absoluten Pfad auf eine gemeinsame, lokale Datenbank setzen (z. B. `/srv/kuehl/shared/database/workspace.sqlite`), nicht auf die Datenbank im neuen Release. Den bestehenden `APP_KEY` beibehalten. `storage` für Logs/Sessions und `bootstrap/cache` müssen für den PHP-FPM-User beschreibbar sein; DB-Verzeichnis einschließlich WAL-/SHM-Dateien ebenfalls. Nur Deploy-/PHP-User erhalten Schreibrechte; Backups restriktiv behandeln. Node-/Composer-Installation und Builds können in einer CI erfolgen; dann das vollständige Build-Artefakt deployen.

Produktive Konfiguration (Werte durch interne IT setzen):

```dotenv
APP_ENV=production
APP_DEBUG=false
APP_URL=https://workspace.intern.example
DB_CONNECTION=sqlite
DB_DATABASE=/srv/kuehl/shared/database/workspace.sqlite
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_HTTP_ONLY=true
SESSION_SAME_SITE=lax
SESSION_ENCRYPT=true
QUEUE_CONNECTION=sync
WORKSPACE_REGISTRATION_ENABLED=true
WORKSPACE_REGISTRATION_CODE=
MAIL_MAILER=smtp
MAIL_HOST=smtp.intern.example
MAIL_PORT=587
MAIL_SCHEME=smtp
MAIL_USERNAME=
MAIL_PASSWORD=
MAIL_FROM_ADDRESS=workspace@intern.example
MAIL_FROM_NAME="Kühl Workspace"
```

Die leeren Geheimnisse sind Platzhalter: starken Code (mindestens 24 zufällige Zeichen), Relay-Zugang und echten Absender einsetzen. TLS-Parameter anhand des Relays prüfen: Port 587 normalerweise smtp/STARTTLS, 465 smtps. Login/Verifikation dürfen bei Mailproblemen nicht durch Entfernen der verified-Middleware umgangen werden. Synchrone Systemmails benötigen keinen Queue-Worker. Kein Redis/Reverb nötig. `APP_KEY` nie neu generieren, nachdem Daten/Sitzungen existieren.

Nginx-Beispiel innerhalb des von der IT konfigurierten internen TLS-vHosts:

```nginx
root /srv/kuehl/current/public;
index index.php;
location / { try_files $uri $uri/ /index.php?$query_string; }
location ~ ^/index\.php(/|$) {
    include fastcgi_params;
    fastcgi_param SCRIPT_FILENAME $document_root/index.php;
    fastcgi_pass unix:/run/php/php8.4-fpm.sock;
    fastcgi_hide_header X-Powered-By;
}
location ~ \.php$ { return 404; }
location ~ /\. { deny all; }
```

PHP-Socket/Release-Pfade, Zertifikat, DNS/VPN und Host-Firewall an den Server anpassen. Nur tatsächlich bekannte Proxy-Adressen als vertrauenswürdig konfigurieren; HTTPS muss bis zur Anwendung korrekt erkennbar sein. Nach dem Deployment ausdrücklich HTTP-Zugriffe auf `/.env`, `/database/database.sqlite`, `/storage/logs/laravel.log` prüfen: keine Dateiinhalte.

## Codewechsel und Accounts

Code in der serverseitigen `.env` ersetzen, `php artisan config:cache`, neuen Registrierungsversuch prüfen. Registrierung abschalten: `WORKSPACE_REGISTRATION_ENABLED=false`, Configcache erneuern. Die Registrierungsseite erklärt bei Eingabe eine neutrale Ablehnung; bestehende Logins und Passwort-Reset funktionieren weiterhin.

```sh
php artisan workspace:user:disable email@example.org
php artisan workspace:user:enable email@example.org
```

Deaktivierung setzt `is_active=false`, löscht bestehende Datenbanksitzungen und widerruft Remember-me. Jede weitere authentifizierte Anfrage prüft den aktiven DB-Stand. Keine persönlichen API-Tokens werden im MVP ausgegeben. Audit-Referenzen bleiben bestehen. Reaktivierung erlaubt eine neue Anmeldung; alte Remember-me-Cookies gelten nicht erneut.

## Backup und Restore

Täglich unter dem berechtigten Betriebsaccount eine **neue** Datei außerhalb public erzeugen:

```sh
php artisan workspace:backup /srv/kuehl/backups/workspace-2026-10-23.sqlite
```

Der Befehl verwendet die SQLite3-Online-Backup-API, berücksichtigt WAL-Inhalte und prüft `PRAGMA integrity_check`. Er überschreibt keine vorhandene Datei. Der Zielordner muss existieren. Alternativ das geprüfte sqlite3 `.backup`-Verfahren nutzen. Kein einfaches Live-Kopieren der DB bei WAL. Auch `APP_KEY`/Konfiguration und künftige Dateien in ein separat geschütztes Backupkonzept aufnehmen. Die lokale Kopie mit dem unternehmensüblichen Verfahren verschlüsseln und auf einen getrennten Backuphost übertragen; Transfer/Zugang und Aufbewahrungsrotation verantwortet die IT. Keine Zugangsdaten in Cron-Argumenten.

Täglichen Lauf z. B. per systemd-Timer organisieren; Datum für den Dateinamen durch ein kontrolliertes Betriebsskript einsetzen. Erfolg/Plattenplatz überwachen. Aufbewahrungsfristen und Zugriff schriftlich vereinbaren; Backup darf keine stillschweigende unbegrenzte Aufbewahrung schaffen.

Restore zuerst isoliert testen:

1. Neue Testinstanz ohne Produktivzugriff und ohne echten Mailversand bereitstellen.
2. Backup entschlüsseln und unter neuem Dateinamen in ein lokales, nicht öffentliches Verzeichnis legen.
3. `DB_DATABASE` der Testinstanz auf diese Datei richten und `php artisan config:clear` ausführen.
4. `sqlite3 /pfad/restore.sqlite 'PRAGMA integrity_check; PRAGMA foreign_key_check;'` (integrity: `ok`, keine FK-Zeilen), Anmeldung mit Testaccounts, Aufgaben und Audit prüfen.
5. Ergebnis, Zeitpunkt, Dateihash und verantwortliche Person protokollieren. Mindestens vor Go-live und nach relevanten Änderungen wiederholen.

Automatisierter Nachweis im Projekt: `WorkspaceConcurrencyTest` erstellt eine eigene Dateidatenbank, führt parallele Änderungen aus, erzeugt ein Onlinebackup und öffnet dieses unabhängig als Restore. Er prüft Integrität, Versionsstand und Audit-Anzahl. Das ersetzt keinen verschlüsselten Offsite-Restore mit dem konkreten Firmenbackupdienst.

## Update und Rückfall

Vor jedem Update: Onlinebackup, Release-/Lockdateien und Konfiguration sichern. Neues Release testen, kurze Wartung mit `php artisan down`, Migration und Umschaltung des vHost-Symlinks, Config-/Route-/Viewcache erneuern, `php artisan up`, Smoke-Test mit zwei Accounts. Bei Fehlern altes Release zurückschalten. Rückwärtsmigrationen können Daten löschen; stattdessen nur nach geprüftem Wartungs-/Restoreplan eine gesicherte Datenbank wiederherstellen. Nach Restore verlorene Änderungen seit Backup explizit kommunizieren. Vor Ablösung des alten Projektmanagements vollständiges separates Backup und nachgewiesene Rückfallmöglichkeit vorhalten; keine anderen Dienste entfernen.

## Datenschutz und Go-live

Vor Inbetriebnahme Informationspflichten für Mitarbeitende, Zugriff, Lösch-/Aufbewahrungsfristen, Auskunfts-/Berichtigungsabläufe und ggf. Mitbestimmung klären. Keine Leistungsrankings; Audit beschreibt Bedienaktionen. Fachliche Daten werden nicht automatisch gelöscht. Aufbewahrung muss kontrolliert durch die zuständigen Verantwortlichen umgesetzt werden; der MVP enthält bewusst keinen allgemeinen Löschjob.

Echte Endabnahme auf dem Firmenhost: zwei Konten mit internem Code registrieren, beide Mails empfangen und bestätigen, unbestätigten Account prüfen, Reset-Mail empfangen, Passwort ändern, abgelaufenen Reset-Link ablehnen, neu anmelden, Konto deaktivieren und bestehende Sitzung testen. Ohne funktionierende Mails und erfolgreichen Firmen-Restore kein Go-live.
