<?php

namespace Tests\Feature;

use App\Actions\ImportLegacyWorkspace;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use Tests\TestCase;

class LegacyImportTest extends TestCase
{
    use RefreshDatabase;

    /** @return array<string, mixed> */
    private function snapshot(): array
    {
        $dates = ['created_at' => '2025-11-03 09:15:00', 'updated_at' => '2026-02-04 10:00:00'];
        $ticket = $dates + ['department_id' => 1, 'ticket_category_id' => 1, 'created_by' => 7,
            'description' => 'Ursprüngliche Beschreibung', 'data' => '{"notiz":"Äpfel für Kühl","anzahl":0}',
            'status' => 'offen', 'priority' => null, 'closed_at' => null, 'planned_start_at' => '2026-03-01 08:00:00',
            'planned_end_at' => '2026-03-01 10:00:00', 'deadline_at' => null, 'archived_at' => null,
            'archived_by' => null, 'archive_reason' => null, 'project_id' => 4, 'ticket_series_id' => null];

        return ['format' => 1, 'source' => 'aufgabenplaner', 'sha256' => str_repeat('a', 64), 'uncertain' => [],
            'excluded' => [['table' => 'tickets', 'id' => 3, 'reason' => 'Bezeichnung im Datensatz'],
                ['table' => 'ticket_comments', 'id' => 6, 'reason' => 'Relation']],
            'tables' => ['departments' => [['id' => 1, 'name' => 'Team']], 'department_user' => [], 'media' => [],
                'users' => [['id' => 7, 'name' => 'Altperson', 'email' => 'alt@example.test'] + $dates],
                'ticket_categories' => [['id' => 1, 'name' => 'Sonstiges', 'department_id' => 1]], 'ticket_series' => [],
                'projects' => [['id' => 4, 'title' => 'Historisches Projekt', 'description' => 'Projektwissen',
                    'department_id' => 1, 'created_by' => 7, 'start_date' => '2026-03-10', 'end_date' => '2026-04-25',
                    'status' => 'abgeschlossen', 'color' => '#123456', 'archived_at' => null, 'archived_by' => null, 'archive_reason' => null] + $dates],
                'tickets' => [['id' => 1, 'title' => 'Historisch erledigt', 'status' => 'erledigt', 'deadline_at' => '2026-03-12 14:00:00'] + $ticket,
                    ['id' => 2, 'title' => 'Offen ohne Frist', 'status' => 'in_bearbeitung'] + $ticket,
                    ['id' => 3, 'title' => 'Filiale des Monats'] + $ticket],
                'ticket_comments' => [['id' => 5, 'ticket_id' => 1, 'user_id' => 7, 'body' => 'Originalwissen im Kommentar'] + $dates,
                    ['id' => 6, 'ticket_id' => 3, 'user_id' => 7, 'body' => 'Sonderbereich'] + $dates],
                'ticket_assignees' => [['ticket_id' => 1, 'user_id' => 7, 'assigned_by' => 7] + $dates]]];
    }

    public function test_dry_run_has_no_database_side_effects_and_import_is_idempotent(): void
    {
        $action = new ImportLegacyWorkspace;
        $input = $this->snapshot();
        $dry = $action->execute($input, str_repeat('b', 64), false);
        $this->assertSame(1, $dry['projects']);
        $this->assertSame(2, $dry['tasks']);
        foreach (['users', 'projects', 'tasks', 'activities', 'workspace_changes', 'legacy_records', 'legacy_import_runs'] as $table) {
            $this->assertDatabaseCount($table, 0);
        }
        $result = $action->execute($input, str_repeat('b', 64), true);
        $this->assertSame(2, $result['tasks']);
        $this->assertDatabaseCount('activities', 0);
        $this->assertDatabaseCount('workspace_changes', 3);
        $this->assertDatabaseHas('projects', ['starts_on' => '2026-03-10', 'ends_on' => '2026-04-25', 'status' => 'completed']);
        $this->assertDatabaseHas('tasks', ['title' => 'Historisch erledigt', 'status' => 'done', 'completed_at' => null,
            'completed_by' => null, 'due_on' => '2026-03-12', 'created_at' => '2025-11-03 09:15:00', 'assigned_to' => null]);
        $this->assertDatabaseHas('tasks', ['title' => 'Offen ohne Frist', 'status' => 'open', 'due_on' => null]);
        $this->assertDatabaseMissing('tasks', ['title' => 'Filiale des Monats']);
        $this->assertDatabaseMissing('legacy_records', ['source_table' => 'ticket_comments', 'source_id' => '6']);
        $this->assertStringContainsString('Originalwissen im Kommentar', Task::where('title', 'Historisch erledigt')->first()->notes);
        $this->assertStringContainsString('anzahl: 0', Task::where('title', 'Historisch erledigt')->first()->notes);
        $again = $action->execute($input, str_repeat('b', 64), true);
        $this->assertSame(0, $again['tasks']);
        $this->assertDatabaseCount('tasks', 2);
        $this->assertDatabaseCount('workspace_changes', 3);
        $this->assertDatabaseCount('users', 1);
        $this->assertSame([], DB::select('PRAGMA foreign_key_check'));
    }

    public function test_imported_records_work_in_search_year_plan_calendar_weekly_check_and_trash(): void
    {
        (new ImportLegacyWorkspace)->execute($this->snapshot(), str_repeat('b', 64), true);
        $user = User::factory()->create();
        $this->actingAs($user);
        $this->getJson('/api/workspace/tasks?q='.urlencode('äPFEL'))->assertOk()->assertJsonPath('tasks.total', 2);
        $this->getJson('/api/workspace/tasks?status=done')->assertJsonPath('tasks.total', 1);
        $this->getJson('/api/workspace/tasks?from=2026-03-01&to=2026-03-31')->assertJsonPath('tasks.total', 1);
        $this->getJson('/api/workspace/tasks?check=undated')->assertOk()->assertJsonPath('tasks.total', 1);
        $this->getJson('/api/workspace/year/2026')->assertOk()->assertJsonCount(1, 'scheduled')->assertJsonPath('scheduled.0.starts_on', '2026-03-10');
        $task = Task::where('title', 'Historisch erledigt')->first();
        $this->postJson('/api/workspace/trash/task/'.$task->id.'/delete', ['expected_version' => 1])->assertOk();
        $this->postJson('/api/workspace/trash/task/'.$task->id.'/restore', ['expected_version' => 2])->assertOk();
        $this->assertDatabaseHas('tasks', ['id' => $task->id, 'status' => 'done', 'version' => 3, 'deleted_at' => null]);
        $this->assertDatabaseCount('activities', 2);
    }

    public function test_changed_source_rolls_back_new_records_and_preserves_user_edits(): void
    {
        $action = new ImportLegacyWorkspace;
        $input = $this->snapshot();
        $action->execute($input, str_repeat('b', 64), true);
        DB::table('tasks')->where('title', 'Offen ohne Frist')->update(['title' => 'Aktuelle Bearbeitung']);
        $action->execute($input, str_repeat('b', 64), true);
        $this->assertDatabaseHas('tasks', ['title' => 'Aktuelle Bearbeitung']);
        $input['tables']['projects'][] = array_replace($input['tables']['projects'][0], ['id' => 99, 'title' => 'Rollback']);
        $input['tables']['tickets'][0]['description'] = 'Geänderte Quelle';
        try {
            $action->execute($input, str_repeat('c', 64), true);
            $this->fail('Changed source must fail');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Geänderter Quelldatensatz', $e->getMessage());
        }
        $this->assertDatabaseMissing('projects', ['name' => 'Rollback']);
        $this->assertDatabaseCount('legacy_import_runs', 2);
        $this->assertDatabaseCount('tasks', 2);
    }

    public function test_missing_exclusion_is_rejected_before_writes(): void
    {
        $input = $this->snapshot();
        $input['excluded'] = [];
        try {
            (new ImportLegacyWorkspace)->execute($input, str_repeat('b', 64), true);
            $this->fail('Missing exclusion must fail');
        } catch (RuntimeException $e) {
            $this->assertStringContainsString('Ausschlussliste', $e->getMessage());
        }
        $this->assertDatabaseCount('users', 0);
        $this->assertDatabaseCount('tasks', 0);
    }

    public function test_only_explicit_active_verified_user_mapping_is_used(): void
    {
        $user = User::factory()->create();
        (new ImportLegacyWorkspace)->execute($this->snapshot(), str_repeat('b', 64), true, [7 => $user->id]);
        $this->assertDatabaseHas('tasks', ['title' => 'Historisch erledigt', 'assigned_to' => $user->id]);
        $this->assertDatabaseHas('users', ['email' => 'legacy-import@workspace.invalid', 'is_active' => false, 'email_verified_at' => null]);
    }

    public function test_cli_requires_checksum_and_refuses_configured_database_without_approval(): void
    {
        $path = storage_path('framework/legacy-command-'.bin2hex(random_bytes(6)).'.sqlite');
        $input = $path.'.json';
        touch($path);
        file_put_contents($input, json_encode($this->snapshot(), JSON_THROW_ON_ERROR));
        try {
            $this->artisan('workspace:import-legacy', ['input' => $input, '--database-file' => $path])->assertFailed();
            config(['database.connections.sqlite.database' => $path]);
            $this->artisan('workspace:import-legacy', ['input' => $input, '--database-file' => $path, '--sha256' => hash_file('sha256', $input), '--apply' => true])->assertFailed();
            $this->assertSame(0, filesize($path));
        } finally {
            unlink($input);
            unlink($path);
        }
    }

    public function test_cli_dry_run_is_physically_read_only_even_for_a_non_wal_database(): void
    {
        $path = storage_path('framework/legacy-read-only-'.bin2hex(random_bytes(6)).'.sqlite');
        $input = $path.'.json';
        $sqlite = new \SQLite3($path);
        $sqlite->exec('CREATE TABLE legacy_records (source TEXT, source_table TEXT, source_id TEXT)');
        $sqlite->close();
        file_put_contents($input, json_encode($this->snapshot(), JSON_THROW_ON_ERROR));
        $before = hash_file('sha256', $path);
        try {
            $this->artisan('workspace:import-legacy', ['input' => $input, '--database-file' => $path,
                '--sha256' => hash_file('sha256', $input), '--dry-run' => true])->assertSuccessful();
            $this->assertSame($before, hash_file('sha256', $path));
            $this->assertFileDoesNotExist($path.'-wal');
        } finally {
            unlink($input);
            unlink($path);
        }
    }
}
