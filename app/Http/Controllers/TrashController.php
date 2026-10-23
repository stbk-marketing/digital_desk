<?php

namespace App\Http\Controllers;

use App\Actions\TrashWorkspace;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class TrashController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $request->validate(['tasks_page' => ['sometimes', 'integer', 'min:1'], 'projects_page' => ['sometimes', 'integer', 'min:1']]);

        return response()->json(['tasks' => Task::onlyTrashed()->orderByDesc('deleted_at')->paginate(40, ['*'], 'tasks_page'), 'projects' => Project::onlyTrashed()->orderByDesc('deleted_at')->paginate(40, ['*'], 'projects_page')]);
    }

    public function links(Request $request, string $id): JsonResponse
    {
        Project::withTrashed()->whereKey($id)->firstOrFail();
        $request->validate(['page' => ['sometimes', 'integer', 'min:1']]);

        return response()->json(DB::table('project_task_recoveries as recovery')->join('tasks', 'tasks.id', '=', 'recovery.task_id')->where('recovery.project_id', $id)
            ->select('tasks.id', 'tasks.title', 'tasks.project_id', 'tasks.deleted_at', 'recovery.detached_at')
            ->selectRaw('CASE WHEN tasks.deleted_at IS NULL AND tasks.project_id IS NULL AND tasks.version = recovery.detached_version THEN 1 ELSE 0 END as recoverable')
            ->orderBy('recovery.id')->paginate(40));
    }

    public function mutate(Request $request, string $type, string $id, string $operation, TrashWorkspace $action): JsonResponse
    {
        abort_unless(in_array($type, ['task', 'project']) && in_array($operation, ['delete', 'restore', 'purge']), 404);
        abort_unless($request->user()->can('write', $type === 'task' ? Task::class : Project::class), 403);
        $data = $request->validate(['expected_version' => ['required', 'integer', 'min:1'], 'confirmed' => [$operation === 'purge' ? 'required' : 'sometimes', 'accepted'], 'restore_links' => ['sometimes', 'boolean']]);

        return response()->json($action->execute($type, $id, $operation, $data['expected_version'], $request->user()->id, $data['restore_links'] ?? true));
    }
}
