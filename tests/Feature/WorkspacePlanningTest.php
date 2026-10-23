<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class WorkspacePlanningTest extends TestCase
{
    use RefreshDatabase;

    public function test_project_dates_are_validated_against_existing_dates(): void
    {
        $this->actingAs(User::factory()->create());
        $project = $this->postJson('/api/workspace/projects', ['name' => 'Firmen-Event', 'starts_on' => '2026-12-28', 'ends_on' => '2027-01-04'])->assertCreated()->json();
        $this->patchJson('/api/workspace/projects/'.$project['id'], ['ends_on' => '2026-12-27', 'expected_version' => 1])->assertUnprocessable();
        $this->assertDatabaseCount('activities', 1);
        $task = $this->postJson('/api/workspace/tasks', ['title' => 'Einzelfrist', 'project_id' => $project['id'], 'due_on' => '2026-10-25'])->assertCreated()->json();
        $this->patchJson('/api/workspace/tasks/'.$task['id'], ['due_on' => '2026-10-26', 'expected_version' => 1])->assertOk()->assertJsonPath('due_on', '2026-10-26');
        $this->assertDatabaseHas('projects', ['starts_on' => '2026-12-28', 'ends_on' => '2027-01-04']);
        $this->getJson('/api/workspace/projects')->assertJsonPath('0.open_tasks', 1);
        $this->getJson('/api/workspace/tasks?q=Firmen-Event')->assertJsonPath('tasks.total', 1);
    }

    public function test_weekcheck_keeps_old_overdue_and_unorganized_tasks_and_respects_snooze(): void
    {
        $this->travelTo(now()->setDate(2026, 10, 23));
        $this->actingAs(User::factory()->create());
        $this->travelBack();
        $this->travelTo(now()->setDate(2026, 9, 1));
        $old = $this->postJson('/api/workspace/tasks', ['title' => 'Seit Wochen offen', 'due_on' => '2026-09-02'])->json();
        $undated = $this->postJson('/api/workspace/tasks', ['title' => 'Ungeordnet'])->json();
        $this->travelTo(now()->setDate(2026, 10, 23));
        $this->getJson('/api/workspace/tasks?check=overdue')->assertJsonPath('tasks.total', 1);
        $this->getJson('/api/workspace/tasks?check=undated')->assertJsonPath('tasks.data.0.id', $undated['id']);
        $this->getJson('/api/workspace/tasks?check=unassigned')->assertJsonPath('tasks.total', 2);
        $this->patchJson('/api/workspace/tasks/'.$old['id'], ['snoozed_until' => '2026-10-30', 'expected_version' => 1])->assertOk();
        $this->getJson('/api/workspace/tasks?check=overdue')->assertJsonPath('tasks.total', 0);
        $this->getJson('/api/workspace/tasks?status=overdue')->assertJsonPath('tasks.total', 1);
    }

    public function test_pagination_and_calendar_filter_do_not_confuse_creation_and_due_dates(): void
    {
        $this->actingAs(User::factory()->create());
        $this->postJson('/api/workspace/tasks', ['title' => 'Ohne Datum']);
        $this->postJson('/api/workspace/tasks', ['title' => 'Sommerzeit', 'due_on' => '2026-03-29']);
        $this->postJson('/api/workspace/tasks', ['title' => 'Winterzeit', 'due_on' => '2026-10-25']);
        $this->getJson('/api/workspace/tasks?from=2026-10-01&to=2026-10-31')->assertJsonPath('tasks.total', 1)->assertJsonPath('tasks.data.0.due_on', '2026-10-25');
        $this->getJson('/api/workspace/tasks?from=2026-03-29&to=2026-03-29')->assertJsonPath('tasks.total', 1);
    }
}
