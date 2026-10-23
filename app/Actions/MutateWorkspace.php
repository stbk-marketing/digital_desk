<?php

namespace App\Actions;

use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class MutateWorkspace
{
    public function execute(string $type, array $data, int $actor, ?Model $record = null): Model
    {
        return DB::transaction(function () use ($type, $data, $actor, $record) {
            $expected = $data['expected_version'] ?? null;
            unset($data['expected_version']);
            $record = $record?->fresh();
            $before = $record?->getAttributes();
            if ($record && (int) $record->version !== (int) $expected) {
                throw new HttpResponseException(response()->json(['message' => 'Zwischenzeitlich geändert. Ihr Entwurf bleibt erhalten.', 'current' => $record], 409));
            }
            if ($type === 'task') {
                if (array_key_exists('archived', $data)) {
                    $data['archived_at'] = $data['archived'] ? now()->toDateTimeString() : null;
                    unset($data['archived']);
                }
                if (isset($data['status']) && $data['status'] !== ($record?->status ?? 'open')) {
                    $data['completed_at'] = $data['status'] === 'done' ? now()->toDateTimeString() : null;
                    $data['completed_by'] = $data['status'] === 'done' ? $actor : null;
                }
            } else {
                $start = array_key_exists('starts_on', $data) ? $data['starts_on'] : $record?->starts_on;
                $end = array_key_exists('ends_on', $data) ? $data['ends_on'] : $record?->ends_on;
                if ($start && $end && $end < $start) {
                    throw ValidationException::withMessages(['ends_on' => 'Ende muss am oder nach dem Start liegen.']);
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
                $class = $type === 'task' ? Task::class : Project::class;
                $record = $class::create($data + ['created_by' => $actor]);
                $record->refresh();
            }
            $after = $record->getAttributes();
            $changedBefore = [];
            $changedAfter = [];
            foreach ($after as $field => $value) {
                if (! in_array($field, ['updated_at', 'version']) && (! $before || ($before[$field] ?? null) !== $value)) {
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
