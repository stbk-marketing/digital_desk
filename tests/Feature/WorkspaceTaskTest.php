<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspaceTaskTest extends TestCase
{
    use RefreshDatabase;

    public function test_capture_complete_reopen_and_search_with_two_accounts(): void
    {
        $a = User::factory()->create();
        $b = User::factory()->create();
        $task = $this->actingAs($a)->postJson('/api/workspace/tasks', ['title' => 'Klamotten Filiale 9100 Jarmen packen'])->assertCreated()->json();
        $this->assertNull($task['due_on']);
        $this->assertNull($task['project_id']);
        $this->actingAs($b)->patchJson('/api/workspace/tasks/'.$task['id'], ['status' => 'done', 'expected_version' => 1])->assertOk()->assertJsonPath('completed_by', $b->id);
        $this->actingAs($a)->patchJson('/api/workspace/tasks/'.$task['id'], ['status' => 'open', 'expected_version' => 2])->assertOk()->assertJsonPath('completed_by', null);
        $this->getJson('/api/workspace/tasks?q=Jarmen')->assertJsonPath('tasks.total', 1);
        $this->assertDatabaseHas('activities', ['subject_id' => $task['id'], 'event' => 'done', 'actor_id' => $b->id]);
        $this->assertDatabaseHas('activities', ['subject_id' => $task['id'], 'event' => 'open', 'actor_id' => $a->id]);
        $this->assertDatabaseCount('activities', 3);
    }

    public function test_stale_updates_conflict_without_audit_or_data_loss(): void
    {
        $this->actingAs(User::factory()->create());
        $task = $this->postJson('/api/workspace/tasks', ['title' => 'Original'])->json();
        $url = '/api/workspace/tasks/'.$task['id'];
        $this->patchJson($url, ['title' => 'Kollegin', 'expected_version' => 1])->assertOk();
        $this->patchJson($url, ['title' => 'Lokal', 'expected_version' => 1])->assertConflict()->assertJsonPath('current.title', 'Kollegin');
        $this->assertDatabaseCount('activities', 2);
        $this->assertDatabaseHas('tasks', ['title' => 'Kollegin', 'version' => 2]);
    }

    public function test_archived_old_done_tasks_remain_searchable_and_fields_are_validated(): void
    {
        $this->actingAs(User::factory()->create());
        $task = $this->postJson('/api/workspace/tasks', ['title' => 'Jarmen'])->json();
        $this->patchJson('/api/workspace/tasks/'.$task['id'], ['expected_version' => 1, 'status' => 'done', 'archived' => true])->assertOk();
        $this->getJson('/api/workspace/tasks?q=Jarmen&status=all')->assertJsonPath('tasks.total', 1);
        $this->getJson('/api/workspace/tasks?archive=current')->assertJsonPath('tasks.total', 0);
        $this->postJson('/api/workspace/tasks', ['title' => ''])->assertUnprocessable();
        $this->postJson('/api/workspace/tasks', ['title' => 'Datum', 'due_on' => '2026-02-30'])->assertUnprocessable();
        $this->getJson('/api/workspace/changes?since=0')->assertJsonPath('changed', true);
        $this->assertDatabaseCount('activities', 2);
    }

    public function test_workspace_routes_require_verified_active_user(): void
    {
        foreach (['/api/workspace/tasks', '/api/workspace/projects', '/api/workspace/activities?subject_id=01AAAAAAAAAAAAAAAAAAAAAAAA', '/api/workspace/changes?since=0'] as $url) {
            $this->getJson($url)->assertUnauthorized();
        }
        $this->actingAs(User::factory()->unverified()->create())->getJson('/api/workspace/tasks')->assertForbidden();
    }

    public function test_unicode_search_notes_and_idempotent_retries(): void
    {
        $this->actingAs(User::factory()->create());
        $data = ['title' => 'Äpfel für KÜHL', 'notes' => 'Überprüfung', 'request_id' => '0a7b2e56-75aa-4ba2-aad6-12bc07c6be71'];
        $task = $this->postJson('/api/workspace/tasks', $data)->assertCreated()->json();
        $this->postJson('/api/workspace/tasks', $data)->assertCreated()->assertJsonPath('id', $task['id']);
        $this->assertDatabaseCount('tasks', 1);
        $this->assertDatabaseCount('activities', 1);
        $this->getJson('/api/workspace/tasks?q='.urlencode('äPFEL'))->assertJsonPath('tasks.total', 1);
        $this->getJson('/api/workspace/tasks?q='.urlencode('überprüfung'))->assertJsonPath('tasks.total', 1);
        $this->patchJson('/api/workspace/tasks/'.$task['id'], ['notes' => null, 'expected_version' => 1])->assertOk();
        $this->getJson('/api/workspace/tasks?q='.urlencode('überprüfung'))->assertJsonPath('tasks.total', 0);
    }

    public function test_activity_is_append_only_and_transaction_rolls_back_on_audit_failure(): void
    {
        $this->actingAs(User::factory()->create());
        Activity::creating(fn () => throw new \RuntimeException('Audit unavailable'));
        $this->postJson('/api/workspace/tasks', ['title' => 'Nicht ohne Audit'])->assertServerError();
        $this->assertDatabaseCount('tasks', 0);
        Activity::flushEventListeners();
    }
}
