<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use SQLite3;

class BackupWorkspace extends Command
{
    protected $signature = 'workspace:backup {target : Neue SQLite-Datei außerhalb des Webroots}';

    protected $description = 'Konsistentes SQLite-Onlinebackup einschließlich WAL-Inhalt';

    public function handle(): int
    {
        $target = $this->argument('target');
        $directory = realpath(dirname($target));
        $public = realpath(public_path());
        if (! $directory || ! $public || file_exists($target) || str_starts_with(strtolower(str_replace('\\', '/', $directory)).'/', strtolower(str_replace('\\', '/', $public)).'/')) {
            $this->error('Neuen Dateinamen in einem vorhandenen Verzeichnis außerhalb public verwenden.');

            return self::FAILURE;
        }
        if (config('database.default') !== 'sqlite') {
            $this->error('Dieser Befehl unterstützt SQLite.');

            return self::FAILURE;
        }
        $source = new SQLite3(config('database.connections.sqlite.database'), SQLITE3_OPEN_READONLY);
        $destination = new SQLite3($target);
        $source->busyTimeout(5000);
        if (! $source->backup($destination)) {
            $this->error('Backup fehlgeschlagen.');

            return self::FAILURE;
        }
        $integrity = $destination->querySingle('PRAGMA integrity_check');
        $destination->close();
        $source->close();
        if (PHP_OS_FAMILY !== 'Windows') {
            chmod($target, 0600);
        }
        $this->info($integrity === 'ok' ? 'Backup erstellt; integrity_check: ok' : 'Integritätsprüfung fehlgeschlagen.');

        return $integrity === 'ok' ? self::SUCCESS : self::FAILURE;
    }
}
