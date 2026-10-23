<?php

namespace App\Actions;

use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

class TrashWorkspace
{
    /** @return array{record: Task|Project|null, restored_links: int, skipped_links: int} */
    public function execute(string $type, string $id, string $operation, int $version, int $actor, bool $restoreLinks = true): array
    {
        return DB::transaction(function () use ($type, $id, $operation, $version, $actor, $restoreLinks) {
            $class = $type === 'task' ? Task::class : Project::class;
            $record = $class::withTrashed()->whereKey($id)->lockForUpdate()->firstOrFail();
            if ($record->version !== $version || ($operation === 'delete') === $record->trashed()) {
                throw new HttpResponseException(response()->json(['message' => 'Der Eintrag wurde zwischenzeitlich geändert. Bitte aktualisieren.', 'current' => $record], 409));
            }
            $restored = 0;
            $skipped = 0;
            if ($type === 'project' && $operation === 'delete') {
                foreach (Task::withTrashed()->where('project_id', $id)->orderBy('id')->lockForUpdate()->get() as $task) {
                    $expected = $task->version;
                    abort_unless(Task::withTrashed()->whereKey($task->id)->where('version', $expected)->update(['project_id' => null, 'version' => $expected + 1, 'updated_at' => now()]) === 1, 409);
                    DB::table('project_task_recoveries')->updateOrInsert(['project_id' => $id, 'task_id' => $task->id], ['detached_version' => $expected + 1, 'detached_at' => now()]);
                    $this->event('task', $task->id, 'project_detached', $actor, ['project_id' => $id], ['project_id' => null]);
                }
            }
            if ($type === 'project' && $operation === 'restore' && $restoreLinks) {
                foreach (DB::table('project_task_recoveries')->where('project_id', $id)->get() as $link) {
                    // Any intervening edit (including assignment away and back) makes recovery opt out.
                    $affected = Task::whereKey($link->task_id)->whereNull('project_id')->where('version', $link->detached_version)
                        ->update(['project_id' => $id, 'version' => $link->detached_version + 1, 'updated_at' => now()]);
                    if ($affected) {
                        $restored++;
                        $this->event('task', $link->task_id, 'project_reattached', $actor, ['project_id' => null], ['project_id' => $id]);
                        DB::table('project_task_recoveries')->where('id', $link->id)->delete();
                    } else {
                        $skipped++;
                    }
                }
            }
            if ($operation === 'purge') {
                // Deliberate, narrowly scoped exception to immutable audit: erase content,
                // retain only actor, time, subject identifier and event type.
                DB::table('activities')->where('subject_type', $type)->where('subject_id', $id)->update(['before' => null, 'after' => null]);
                $record->forceDelete();
            } else {
                $record->forceFill(['deleted_at' => $operation === 'delete' ? now() : null, 'deleted_by' => $operation === 'delete' ? $actor : null, 'version' => $version + 1])->save();
            }
            $this->event($type, $id, ['delete' => 'deleted', 'restore' => 'restored', 'purge' => 'purged'][$operation], $actor);

            return ['record' => $operation === 'purge' ? null : $record->fresh(), 'restored_links' => $restored, 'skipped_links' => $skipped];
        }, 3);
    }

    /** @param array<string, mixed>|null $before
     * @param  array<string, mixed>|null  $after
     */
    private function event(string $type, string $id, string $event, int $actor, ?array $before = null, ?array $after = null): void
    {
        Activity::create(['actor_id' => $actor, 'subject_type' => $type, 'subject_id' => $id, 'event' => $event, 'before' => $before, 'after' => $after, 'occurred_at' => now()]);
        DB::table('workspace_changes')->insert(['subject_type' => $type, 'subject_id' => $id]);
    }
}
