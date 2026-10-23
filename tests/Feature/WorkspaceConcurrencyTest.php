<?php

namespace Tests\Feature;

use App\Actions\MutateWorkspace;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class WorkspaceConcurrencyTest extends TestCase
{
    public function test_two_php_processes_cannot_overwrite_each_other_and_backup_restores(): void
    {
        $path = storage_path('framework/testing-'.bin2hex(random_bytes(6)).'.sqlite');
        $backup = $path.'.backup';
        touch($path);
        config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => $path]);
        DB::purge('sqlite');
        try {
            $this->artisan('migrate', ['--force' => true])->assertSuccessful();
            $a = User::factory()->create();
            $b = User::factory()->create();
            $task = (new MutateWorkspace)->execute('task', ['title' => 'Original'], $a->id);
            $workers = [];
            foreach ([$a, $b] as $user) {
                $process = new Process([PHP_BINARY, base_path('tests/Support/concurrent-worker.php'), $path, $task->id, (string) $user->id, 'Änderung '.$user->id], base_path());
                $process->start();
                $workers[] = $process;
            }
            $results = [];
            foreach ($workers as $worker) {
                $worker->wait();
                $this->assertTrue($worker->isSuccessful(), $worker->getErrorOutput());
                $results[] = trim($worker->getOutput());
            }
            sort($results);
            $this->assertSame(['200', '409'], $results);
            $this->assertDatabaseCount('activities', 2);
            $this->assertSame(2, $task->fresh()->version);
            $this->assertSame('wal', DB::selectOne('PRAGMA journal_mode')->journal_mode);
            $this->artisan('workspace:backup', ['target' => $backup])->assertSuccessful();
            $restored = new \SQLite3($backup, SQLITE3_OPEN_READONLY);
            $this->assertSame('ok', $restored->querySingle('PRAGMA integrity_check'));
            $this->assertSame(2, $restored->querySingle('SELECT version FROM tasks LIMIT 1'));
            $this->assertSame(2, $restored->querySingle('SELECT count(*) FROM activities'));
            $restored->close();
        } finally {
            DB::disconnect('sqlite');
            foreach ([$path, $path.'-wal', $path.'-shm', $backup, $backup.'-wal', $backup.'-shm'] as $file) {
                if (is_file($file)) {
                    unlink($file);
                }
            }
        }
    }
}
