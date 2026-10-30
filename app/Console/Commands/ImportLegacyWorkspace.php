<?php

namespace App\Console\Commands;

use App\Actions\ImportLegacyWorkspace as ImportAction;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use SQLite3;
use Throwable;

class ImportLegacyWorkspace extends Command
{
    protected $signature = 'workspace:import-legacy
        {input : Aufbereitete migration.json, niemals ein SQL-Skript}
        {--sha256= : Erwartete SHA-256-Prüfsumme der JSON-Datei}
        {--database-file= : Explizite SQLite-Zieldatei}
        {--dry-run : Nur prüfen, Standard ohne --apply}
        {--apply : Transaktionssicher importieren}
        {--backup= : Neue private Sicherungsdatei; Pflicht bei --apply}
        {--report= : Neues privates JSON-Protokoll}
        {--user-map= : Optionale JSON-Datei mit expliziten Alt-ID/Neu-ID-Zuordnungen}
        {--production-approved : Nur nach ausdrücklicher Freigabe für die konfigurierte/produktive Datenbank}';

    protected $description = 'Prüft/importiert historische Aufgabenplaner-Daten ohne Überschreiben; Filiale des Monats bleibt ausgeschlossen';

    public function handle(ImportAction $action): int
    {
        $originalConnection = DB::getDefaultConnection();
        $reportPath = null;
        $committed = false;
        try {
            if (app()->configurationIsCached()) {
                throw new RuntimeException('Vor dem Import Konfigurationscache auflösen, damit das Ziel eindeutig ist.');
            }
            if ($this->option('apply') && $this->option('dry-run')) {
                throw new RuntimeException('--apply und --dry-run schließen sich aus.');
            }
            $input = realpath($this->argument('input'));
            $target = realpath((string) $this->option('database-file'));
            if (! $input || ! $target || ! is_file($target) || ! $this->privatePath($input) || ! $this->privatePath($target)) {
                throw new RuntimeException('Vorhandene private Eingabe- und SQLite-Zieldatei explizit angeben.');
            }
            $hash = hash_file('sha256', $input);
            if ($hash === false) {
                throw new RuntimeException('Eingabedatei konnte nicht gelesen werden.');
            }
            if (! is_string($this->option('sha256')) || ! hash_equals($hash, strtolower($this->option('sha256')))) {
                throw new RuntimeException('Eingabe-Prüfsumme fehlt oder stimmt nicht überein.');
            }
            $apply = (bool) $this->option('apply');
            $configured = realpath((string) config('database.connections.sqlite.database'));
            if ($apply && (app()->isProduction() || $configured === $target) && ! $this->option('production-approved')) {
                throw new RuntimeException('Konfigurierte/produktive Datenbank erfordert separate Freigabe und --production-approved.');
            }
            $report = $this->option('report');
            if ($report && (! $this->privatePath($report) || file_exists($report))) {
                throw new RuntimeException('Protokoll benötigt einen neuen privaten Dateinamen.');
            }
            $reportPath = $report ?: null;
            $data = $this->readJson($input);
            $userMap = $this->option('user-map') ? $this->readJson($this->option('user-map')) : [];
            if (! is_array($data) || ! is_array($userMap)) {
                throw new RuntimeException('JSON-Objekt erwartet.');
            }
            foreach ($userMap as $old => $new) {
                if (! ctype_digit((string) $old) || ! is_int($new) || $new < 1) {
                    throw new RuntimeException('Benutzermapping benötigt positive ganzzahlige IDs.');
                }
            }
            config(['database.connections.legacy_import' => array_replace(config('database.connections.sqlite'), [
                'database' => $target, 'url' => null, 'foreign_key_constraints' => true,
                // Connecting for validation must not change the database journal/header.
                'journal_mode' => null, 'synchronous' => null,
                'transaction_mode' => $apply ? 'IMMEDIATE' : 'DEFERRED',
                'options' => $apply ? [] : [\PDO::SQLITE_ATTR_OPEN_FLAGS => \PDO::SQLITE_OPEN_READONLY],
            ])]);
            DB::purge('legacy_import');
            DB::setDefaultConnection('legacy_import');
            if (DB::select('PRAGMA integrity_check')[0]->integrity_check !== 'ok' || DB::select('PRAGMA foreign_key_check') !== []) {
                throw new RuntimeException('Die Zieldatenbank ist nicht integer.');
            }
            if ($apply) {
                $backup = $this->option('backup');
                if (! $backup || ! $this->privatePath($backup) || file_exists($backup)) {
                    throw new RuntimeException('--backup benötigt einen neuen privaten Dateinamen.');
                }
                $source = new SQLite3($target, SQLITE3_OPEN_READONLY);
                $destination = new SQLite3($backup, SQLITE3_OPEN_READWRITE | SQLITE3_OPEN_CREATE);
                $source->busyTimeout(5000);
                if (! $source->backup($destination) || $destination->querySingle('PRAGMA integrity_check') !== 'ok') {
                    throw new RuntimeException('Konsistentes Onlinebackup fehlgeschlagen.');
                }
                $destination->close();
                $source->close();
                if (PHP_OS_FAMILY !== 'Windows') {
                    chmod($backup, 0600);
                }
            }
            $summary = $action->execute($data, $hash, $apply, $userMap);
            $committed = $apply;
            $result = ['input_sha256' => $hash, 'dump_sha256' => $data['sha256'], 'database' => $target,
                'backup_sha256' => $apply ? hash_file('sha256', $this->option('backup')) : null, 'result' => $summary];
            $json = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            if ($report) {
                if (file_put_contents($report, $json, LOCK_EX) === false) {
                    throw new RuntimeException('Protokoll konnte nicht geschrieben werden; Datenbankprotokoll prüfen.');
                }
                if (PHP_OS_FAMILY !== 'Windows') {
                    chmod($report, 0600);
                }
            }
            $this->line($json);

            return self::SUCCESS;
        } catch (Throwable $error) {
            $message = ($committed ? 'Datenbankimport abgeschlossen, nachgelagerter Protokollfehler: ' : 'Import abgebrochen: ').$error->getMessage();
            if ($reportPath && ! file_exists($reportPath)) {
                file_put_contents($reportPath, json_encode(['status' => $committed ? 'imported_report_error' : 'failed', 'error' => $message], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), LOCK_EX);
            }
            $this->error($message);

            return self::FAILURE;
        } finally {
            DB::setDefaultConnection($originalConnection);
            DB::purge('legacy_import');
        }
    }

    private function privatePath(string $path): bool
    {
        $directory = realpath(dirname($path));
        if (! $directory) {
            return false;
        }
        $resolved = realpath($path) ?: $directory.DIRECTORY_SEPARATOR.basename($path);
        $normal = strtolower(str_replace('\\', '/', $resolved));
        foreach ([public_path(), storage_path('app/public')] as $public) {
            $public = strtolower(str_replace('\\', '/', realpath($public) ?: $public));
            if ($normal === $public || str_starts_with($normal, $public.'/')) {
                return false;
            }
        }

        return true;
    }

    private function readJson(string $path): mixed
    {
        $contents = file_get_contents($path);
        if ($contents === false) {
            throw new RuntimeException('JSON-Datei konnte nicht gelesen werden.');
        }

        return json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
    }
}
