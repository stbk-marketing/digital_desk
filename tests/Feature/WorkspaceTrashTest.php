<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Task;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\TestCase;

class WorkspaceTrashTest extends TestCase
{
    use RefreshDatabase;

    public function test_change_pages_keep_deletion_tombstones_after_a_large_backlog(): void
    {
        $this->actingAs(User::factory()->create());
        DB::table('workspace_changes')->insert(array_fill(0, 205, ['subject_type' => 'task', 'subject_id' => (string) Str::ulid()]));
        $task = $this->postJson('/api/workspace/tasks', ['title' => 'Late deletion'])->json();
        $deleted = $this->operation('task', $task, 'delete')->assertOk()->json('record');
        $this->operation('task', $deleted, 'purge', ['confirmed' => true])->assertOk();
        $first = $this->getJson('/api/workspace/changes?since=0')->assertOk()->assertJsonPath('more', true)->json();
        $this->getJson('/api/workspace/changes?since='.$first['cursor'])->assertOk()->assertJsonPath('more', false)->assertJsonFragment(['type' => 'task', 'id' => $task['id']]);
    }

    private function operation(string $type, array $record, string $operation, array $extra = [])
    {
        return $this->postJson('/api/workspace/trash/'.$type.'/'.$record['id'].'/'.$operation, ['expected_version' => $record['version']] + $extra);
    }

    public function test_soft_delete_restores_archive_state_and_records_actor_time_and_changes(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $this->actingAs($a);
        $task = $this->postJson('/api/workspace/tasks', ['title' => 'Privat', 'notes' => 'Notiz', 'archived' => true, 'due_on' => '2026-10-23'])->json();
        $this->actingAs($b);
        $deleted = $this->operation('task', $task, 'delete')->assertOk()->assertJsonPath('record.deleted_by', $b->id)->json('record');
        $this->assertNotNull($deleted['deleted_at']);
        foreach (['?q=Privat&archive=all', '?check=overdue', '?from=2026-01-01&to=2026-12-31'] as $filter) {
            $this->getJson('/api/workspace/tasks'.$filter)->assertJsonPath('tasks.total', 0);
        }
        $this->getJson('/api/workspace/trash')->assertJsonPath('tasks.total', 1)->assertJsonPath('tasks.data.0.deleted_by', $b->id);
        $this->getJson('/api/workspace/changes?since=1')->assertJsonFragment(['type' => 'task', 'id' => $task['id']]);
        $this->patchJson('/api/workspace/tasks/'.$task['id'], ['title' => 'Stale', 'expected_version' => 1])->assertConflict()->assertJsonPath('deleted', true);
        $this->operation('task', $task, 'restore')->assertConflict();
        $restored = $this->operation('task', $deleted, 'restore')->assertOk()->assertJsonPath('record.deleted_at', null)->json('record');
        $this->assertSame($task['archived_at'], $restored['archived_at']);
        $this->getJson('/api/workspace/tasks?archive=all')->assertJsonPath('tasks.total', 1);
        $this->getJson('/api/workspace/tasks?archive=current')->assertJsonPath('tasks.total', 0);
        foreach (['deleted', 'restored'] as $event) {
            $this->assertDatabaseHas('activities', ['subject_id' => $task['id'], 'actor_id' => $b->id, 'event' => $event]);
        }
    }

    public function test_project_detaches_all_tasks_and_only_recovers_unchanged_active_assignments(): void
    {
        $this->actingAs(User::factory()->create());
        $project = $this->postJson('/api/workspace/projects', ['name' => 'Plan', 'starts_on' => '2026-01-01', 'ends_on' => '2026-12-31'])->json();
        $other = $this->postJson('/api/workspace/projects', ['name' => 'Andere'])->json();
        $tasks = [];
        foreach (['Unverändert', 'Neu zugeordnet', 'Geändert', 'Gelöscht'] as $title) {
            $tasks[] = $this->postJson('/api/workspace/tasks', ['title' => $title, 'project_id' => $project['id']])->json();
        }
        $this->operation('task', $tasks[3], 'delete')->assertOk();
        $deleted = $this->operation('project', $project, 'delete')->assertOk()->json('record');
        $this->assertSame(0, Task::withTrashed()->where('project_id', $project['id'])->count());
        $this->getJson('/api/workspace/tasks')->assertJsonPath('tasks.total', 3);
        $this->getJson('/api/workspace/projects')->assertJsonCount(1);
        $this->getJson('/api/workspace/year/2026')->assertJsonCount(0, 'scheduled');
        $this->postJson('/api/workspace/tasks', ['title' => 'Invalid', 'project_id' => $project['id']])->assertUnprocessable();
        $this->patchJson('/api/workspace/tasks/'.$tasks[1]['id'], ['project_id' => $other['id'], 'expected_version' => 2])->assertOk();
        $this->patchJson('/api/workspace/tasks/'.$tasks[2]['id'], ['notes' => 'Zwischenzeitlich', 'expected_version' => 2])->assertOk();
        $this->operation('project', $deleted, 'restore')->assertOk()->assertJsonPath('restored_links', 1)->assertJsonPath('skipped_links', 3);
        $this->assertDatabaseHas('tasks', ['id' => $tasks[0]['id'], 'project_id' => $project['id'], 'version' => 3]);
        $this->assertDatabaseHas('tasks', ['id' => $tasks[1]['id'], 'project_id' => $other['id']]);
        $this->assertDatabaseHas('tasks', ['id' => $tasks[2]['id'], 'project_id' => null, 'notes' => 'Zwischenzeitlich']);
        $this->getJson('/api/workspace/trash/links/'.$project['id'])->assertJsonPath('total', 3);
        $this->assertDatabaseHas('activities', ['subject_id' => $tasks[0]['id'], 'event' => 'project_reattached']);
    }

    public function test_project_recovery_can_leave_tasks_unassigned_and_retains_trace(): void
    {
        $this->actingAs(User::factory()->create());
        $project = $this->postJson('/api/workspace/projects', ['name' => 'Plan', 'status' => 'archived'])->json();
        $task = $this->postJson('/api/workspace/tasks', ['title' => 'Arbeit', 'project_id' => $project['id']])->json();
        $deleted = $this->operation('project', $project, 'delete')->json('record');
        $this->operation('project', $deleted, 'restore', ['restore_links' => false])->assertOk()->assertJsonPath('restored_links', 0)->assertJsonPath('record.status', 'archived');
        $this->assertDatabaseHas('tasks', ['id' => $task['id'], 'project_id' => null]);
        $this->getJson('/api/workspace/trash/links/'.$project['id'])->assertJsonPath('data.0.title', 'Arbeit')->assertJsonPath('data.0.recoverable', 1);
    }

    public function test_purge_requires_confirmation_and_erases_content_search_and_audit_payloads(): void
    {
        $user = User::factory()->create();
        $this->actingAs($user);
        foreach (['task', 'project'] as $type) {
            $url = $type === 'task' ? 'tasks' : 'projects';
            $data = $type === 'task' ? ['title' => 'SensitiveTitle', 'notes' => 'SensitiveBody'] : ['name' => 'SensitiveTitle', 'description' => 'SensitiveBody'];
            $data['request_id'] = fake()->uuid();
            $record = $this->postJson('/api/workspace/'.$url, $data)->json();
            $this->operation($type, $record, 'purge', ['confirmed' => true])->assertConflict();
            $deleted = $this->operation($type, $record, 'delete')->assertOk()->json('record');
            $this->operation($type, $deleted, 'purge')->assertUnprocessable();
            $this->operation($type, $record, 'purge', ['confirmed' => true])->assertConflict();
            $this->operation($type, $deleted, 'purge', ['confirmed' => true])->assertOk();
            $this->assertDatabaseMissing($url, ['id' => $record['id']]);
            $events = Activity::where('subject_id', $record['id'])->get();
            $this->assertCount(3, $events);
            foreach ($events as $event) {
                $this->assertNull($event->before);
                $this->assertNull($event->after);
                $this->assertSame($user->id, $event->actor_id);
            }
            $this->postJson('/api/workspace/'.$url, $data)->assertNotFound();
            $this->operation($type, $deleted, 'restore')->assertNotFound();
            $this->assertStringNotContainsString('Sensitive', $this->get('/reports/activities.csv')->streamedContent());
        }
    }

    public function test_purge_project_keeps_tasks_and_purge_task_removes_recovery_references(): void
    {
        $this->actingAs(User::factory()->create());
        $p = $this->postJson('/api/workspace/projects', ['name' => 'ProjectSecret'])->json();
        $t = $this->postJson('/api/workspace/tasks', ['title' => 'TaskSecret', 'project_id' => $p['id']])->json();
        $deleted = $this->operation('project', $p, 'delete')->json('record');
        $this->operation('project', $deleted, 'purge', ['confirmed' => true])->assertOk();
        $this->assertDatabaseHas('tasks', ['id' => $t['id'], 'project_id' => null]);
        $this->assertDatabaseCount('project_task_recoveries', 0);
        $p = $this->postJson('/api/workspace/projects', ['name' => 'Second'])->json();
        $t = $this->postJson('/api/workspace/tasks', ['title' => 'TaskSecret2', 'project_id' => $p['id']])->json();
        $this->operation('project', $p, 'delete')->assertOk();
        $t['version'] = 2;
        $deleted = $this->operation('task', $t, 'delete')->json('record');
        $this->operation('task', $deleted, 'purge', ['confirmed' => true])->assertOk();
        $this->assertDatabaseCount('project_task_recoveries', 0);
        $this->assertDatabaseMissing('tasks', ['id' => $t['id']]);
    }

    public function test_stale_deletions_do_not_detach_tasks_or_emit_events_and_access_is_protected(): void
    {
        $this->getJson('/api/workspace/trash')->assertUnauthorized();
        $this->actingAs(User::factory()->unverified()->create())->getJson('/api/workspace/trash')->assertForbidden();
        $this->actingAs(User::factory()->create(['is_active' => false]))->getJson('/api/workspace/trash')->assertForbidden();
        $this->actingAs(User::factory()->create());
        $p = $this->postJson('/api/workspace/projects', ['name' => 'Original'])->json();
        $t = $this->postJson('/api/workspace/tasks', ['title' => 'Arbeit', 'project_id' => $p['id']])->json();
        $this->patchJson('/api/workspace/projects/'.$p['id'], ['name' => 'Geändert', 'expected_version' => 1])->assertOk();
        $count = DB::table('workspace_changes')->count();
        $this->operation('project', $p, 'delete')->assertConflict();
        $this->assertSame($count, DB::table('workspace_changes')->count());
        $this->assertDatabaseHas('tasks', ['id' => $t['id'], 'project_id' => $p['id'], 'version' => 1]);
        $this->assertDatabaseCount('project_task_recoveries', 0);
    }
}
