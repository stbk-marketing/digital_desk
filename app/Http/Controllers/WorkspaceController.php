<?php

namespace App\Http\Controllers;

use App\Actions\MutateWorkspace;
use App\Http\Requests\ProjectRequest;
use App\Http\Requests\TaskRequest;
use App\Models\Activity;
use App\Models\Project;
use App\Models\Task;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class WorkspaceController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('workspace', ['members' => User::where('is_active', true)->whereNotNull('email_verified_at')->get(['id', 'name']), 'people' => User::get(['id', 'name'])]);
    }

    public function tasks(Request $request): JsonResponse
    {
        $data = $request->validate([
            'q' => ['nullable', 'string', 'max:500'], 'status' => ['nullable', 'in:all,open,done,overdue'],
            'project_id' => ['nullable', 'string'], 'assigned_to' => ['nullable', 'integer'],
            'from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d'],
            'page' => ['nullable', 'integer', 'min:1'], 'archive' => ['nullable', 'in:all,archived,current'],
            'check' => ['nullable', 'in:overdue,undated,unassigned,recent'],
        ]);
        $query = Task::query();
        if (($data['archive'] ?? 'all') === 'current') {
            $query->whereNull('archived_at');
        }
        if (($data['archive'] ?? '') === 'archived') {
            $query->whereNotNull('archived_at');
        }
        $today = now('Europe/Berlin')->toDateString();
        if (in_array($data['status'] ?? '', ['open', 'done'])) {
            $query->where('status', $data['status']);
        }
        if (($data['status'] ?? '') === 'overdue') {
            $query->where('status', 'open')->where('due_on', '<', $today);
        }
        if (! empty($data['project_id'])) {
            $query->where('project_id', $data['project_id']);
        }
        if (! empty($data['assigned_to'])) {
            $query->where('assigned_to', $data['assigned_to']);
        }
        if (! empty($data['from'])) {
            $query->where('due_on', '>=', $data['from']);
        }
        if (! empty($data['to'])) {
            $query->where('due_on', '<=', $data['to']);
        }
        if (! empty($data['q'])) {
            $term = '%'.str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], mb_strtolower($data['q'], 'UTF-8')).'%';
            $query->where(function ($q) use ($term) {
                $q->whereRaw("search_text LIKE ? ESCAPE '\\'", [$term])
                    ->orWhereIn('project_id', Project::whereRaw("search_text LIKE ? ESCAPE '\\'", [$term])->select('id'));
            });
        }
        $summary = null;
        if (! empty($data['check'])) {
            $old = now('Europe/Berlin')->subDays(7)->utc();
            $summary = [
                'overdue' => (clone $query)->whereNull('archived_at')->where('status', 'open')->where('due_on', '<', $today)->count(),
                'unorganized' => (clone $query)->whereNull('archived_at')->where('status', 'open')->where('created_at', '<', $old)->where(fn ($q) => $q->whereNull('due_on')->orWhereNull('project_id'))->count(),
                'done' => (clone $query)->where('status', 'done')->where('completed_at', '>=', now('Europe/Berlin')->startOfWeek()->utc())->count(),
            ];
            $old = now('Europe/Berlin')->subDays(7)->utc();
            if ($data['check'] === 'recent') {
                $query->where('status', 'done')->where('completed_at', '>=', now('Europe/Berlin')->startOfWeek()->utc());
            } else {
                $query->where('status', 'open')->whereNull('archived_at')->where(fn ($q) => $q->whereNull('snoozed_until')->orWhere('snoozed_until', '<=', $today));
                if ($data['check'] === 'overdue') {
                    $query->where('due_on', '<', $today);
                }
                if ($data['check'] === 'undated') {
                    $query->whereNull('due_on')->where('created_at', '<', $old);
                }
                if ($data['check'] === 'unassigned') {
                    $query->whereNull('project_id')->where('created_at', '<', $old);
                }
            }
        }

        return DB::transaction(fn () => response()->json(['tasks' => $query->orderByRaw("CASE WHEN status = 'open' AND due_on IS NOT NULL THEN 0 WHEN status = 'open' THEN 1 ELSE 2 END")
            ->orderBy('due_on')->orderByDesc('created_at')->orderBy('id')->paginate(60), 'summary' => $summary, 'cursor' => DB::table('workspace_changes')->max('id') ?? 0]));
    }

    public function createTask(TaskRequest $request, MutateWorkspace $action): JsonResponse
    {
        return response()->json($action->execute('task', $request->validated(), $request->user()->id), 201);
    }

    public function updateTask(TaskRequest $request, Task $task, MutateWorkspace $action): JsonResponse
    {
        return response()->json($action->execute('task', $request->validated(), $request->user()->id, $task));
    }

    /** @return Collection<int, Project> */
    public function projects(): Collection
    {
        return Project::query()->select('projects.*')->selectSub(Task::selectRaw('count(*)')->whereColumn('project_id', 'projects.id')->where('status', 'open'), 'open_tasks')
            ->selectSub(Task::selectRaw('count(*)')->whereColumn('project_id', 'projects.id')->where('status', 'done'), 'done_tasks')->orderBy('name')->get();
    }

    public function createProject(ProjectRequest $request, MutateWorkspace $action): JsonResponse
    {
        return response()->json($action->execute('project', $request->validated(), $request->user()->id), 201);
    }

    public function updateProject(ProjectRequest $request, Project $project, MutateWorkspace $action): JsonResponse
    {
        return response()->json($action->execute('project', $request->validated(), $request->user()->id, $project));
    }

    /** @return LengthAwarePaginator<int, Activity> */
    public function activities(Request $request): LengthAwarePaginator
    {
        $data = $request->validate(['subject_id' => ['required', 'ulid'], 'page' => ['nullable', 'integer', 'min:1']]);

        return Activity::where('subject_id', $data['subject_id'])->orderByDesc('id')->paginate(40);
    }

    public function changes(Request $request): JsonResponse
    {
        $data = $request->validate(['since' => ['required', 'integer', 'min:0']]);

        return DB::transaction(function () use ($data) {
            $rows = DB::table('workspace_changes')->where('id', '>', $data['since'])->orderBy('id')->limit(200)->get();
            $removed = $rows->unique(fn ($row) => $row->subject_type.':'.$row->subject_id)->filter(function ($row) {
                $class = $row->subject_type === 'task' ? Task::class : Project::class;

                return ! $class::whereKey($row->subject_id)->exists();
            })->map(fn ($row) => ['type' => $row->subject_type, 'id' => $row->subject_id])->values();

            return response()->json(['cursor' => $rows->isEmpty() ? (int) $data['since'] : $rows->last()->id, 'changed' => $rows->isNotEmpty(), 'more' => $rows->count() === 200, 'removed' => $removed]);
        });
    }
}
