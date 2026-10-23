<?php

namespace App\Actions;

use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MutateWorkspace
{
    /** @param array<string, mixed> $data */
    public function execute(string $type, array $data, int $actor, Task|Project|null $record = null): Task|Project
    {
        return DB::transaction(function () use ($type, $data, $actor, $record) {
            $requestId = $data['request_id'] ?? null;
            unset($data['request_id']);
            $class = $type === 'task' ? Task::class : Project::class;
            if (! $record && $requestId) {
                $receipt = DB::table('workspace_requests')->where(['actor_id' => $actor, 'request_id' => $requestId, 'subject_type' => $type])->first();
                if ($receipt) {
                    return $class::query()->whereKey($receipt->subject_id)->firstOrFail();
                }
            }
            $expected = $data['expected_version'] ?? null;
            unset($data['expected_version']);
            if ($type === 'task' && ! empty($data['project_id'])) {
                // Serialize assignment against project deletion; validation alone can race.
                if (! Project::whereKey($data['project_id'])->lockForUpdate()->first()) {
                    throw ValidationException::withMessages(['project_id' => 'Das Projekt ist nicht mehr verfügbar.']);
                }
            }
            if ($record) {
                $record = $class::withTrashed()->whereKey($record->id)->first();
                if (! $record || $record->trashed()) {
                    throw new HttpResponseException(response()->json(['message' => 'Der Eintrag wurde gelöscht. Ihr Entwurf bleibt erhalten.', 'deleted' => true], 409));
                }
            }
            $before = $record?->getAttributes();
            if ($record && (int) $record->version !== (int) $expected) {
                throw new HttpResponseException(response()->json(['message' => 'Zwischenzeitlich geändert. Ihr Entwurf bleibt erhalten.', 'current' => $record], 409));
            }
            if ($type === 'task') {
                if (array_key_exists('archived', $data)) {
                    $data['archived_at'] = $data['archived'] ? now()->toDateTimeString() : null;
                    unset($data['archived']);
                }
                if (isset($data['status']) && $data['status'] !== ($record->status ?? 'open')) {
                    $data['completed_at'] = $data['status'] === 'done' ? now()->toDateTimeString() : null;
                    $data['completed_by'] = $data['status'] === 'done' ? $actor : null;
                }
            } else {
                $start = array_key_exists('starts_on', $data) ? $data['starts_on'] : ($record instanceof Project ? $record->starts_on : null);
                $end = array_key_exists('ends_on', $data) ? $data['ends_on'] : ($record instanceof Project ? $record->ends_on : null);
                if ($start && $end && $end < $start) {
                    throw ValidationException::withMessages(['ends_on' => 'Ende muss am oder nach dem Start liegen.']);
                }
            }
            if ($type === 'task') {
                $data['search_text'] = mb_strtolower(($data['title'] ?? ($record instanceof Task ? $record->title : ''))."\n".($data['notes'] ?? ($record instanceof Task ? $record->notes : '')), 'UTF-8');
                if (array_key_exists('notes', $data) && $data['notes'] === null) {
                    $data['search_text'] = mb_strtolower(($data['title'] ?? $record?->getAttribute('title'))."\n", 'UTF-8');
                }
            } else {
                $data['search_text'] = mb_strtolower(($data['name'] ?? ($record instanceof Project ? $record->name : ''))."\n".($data['description'] ?? ($record instanceof Project ? $record->description : '')), 'UTF-8');
                if (array_key_exists('description', $data) && $data['description'] === null) {
                    $data['search_text'] = mb_strtolower(($data['name'] ?? $record?->getAttribute('name'))."\n", 'UTF-8');
                }
            }
            if ($record) {
                $data['version'] = $record->version + 1;
                $data['updated_at'] = now()->toDateTimeString();
                $affected = $record->newQuery()->whereKey($record->id)->where('version', $expected)->update($data);
                if ($affected !== 1) {
                    throw new HttpResponseException(response()->json(['current' => $record->fresh()], 409));
                }
                $record->refresh();
            } else {
                $record = $class::create($data + ['created_by' => $actor]);
                $record->refresh();
                if ($requestId) {
                    DB::table('workspace_requests')->insert(['actor_id' => $actor, 'request_id' => $requestId, 'subject_type' => $type, 'subject_id' => $record->id]);
                }
            }
            $after = $record->getAttributes();
            $changedBefore = [];
            $changedAfter = [];
            foreach ($after as $field => $value) {
                if (! in_array($field, ['updated_at', 'version', 'search_text']) && (! $before || ($before[$field] ?? null) !== $value)) {
                    $changedBefore[$field] = $before[$field] ?? null;
                    $changedAfter[$field] = $value;
                }
            }
            Activity::create(['actor_id' => $actor, 'subject_type' => $type, 'subject_id' => $record->id,
                'event' => ! $before ? 'created' : (isset($changedAfter['status']) ? $changedAfter['status'] : 'updated'),
                'before' => $before ? $changedBefore : null, 'after' => $changedAfter, 'occurred_at' => now()]);
            DB::table('workspace_changes')->insert(['subject_type' => $type, 'subject_id' => $record->id]);

            return $record;
        }, 3);
    }
}
