<?php

namespace App\Actions;

use App\Models\Project;
use App\Models\Task;
use Carbon\CarbonImmutable;

class YearReport
{
    /** @return array<string, mixed> */
    public function data(int $year, ?string $status = null): array
    {
        abort_unless($year >= 1900 && $year <= 2200, 404);
        $start = CarbonImmutable::create($year, 1, 1, 0, 0, 0, 'UTC');
        $end = $start->endOfYear()->startOfDay();
        $days = $start->daysInYear;
        $projects = Project::query()->when($status, fn ($q) => $q->where('status', $status))
            ->where(fn ($q) => $q->whereNull('starts_on')->orWhereNull('ends_on')->orWhere(fn ($q) => $q->where('starts_on', '<=', $end->toDateString())->where('ends_on', '>=', $start->toDateString())))
            ->select('projects.*')->selectSub(Task::selectRaw('count(*)')->whereColumn('project_id', 'projects.id')->where('status', 'open'), 'open_tasks')
            ->selectSub(Task::selectRaw('count(*)')->whereColumn('project_id', 'projects.id')->where('status', 'done'), 'done_tasks')
            ->orderBy('starts_on')->orderBy('name')->get()->map(function ($p) use ($start, $end, $days) {
                $row = $p->toArray();
                $row['left'] = null;
                $row['width'] = null;
                if ($p->starts_on && $p->ends_on) {
                    $from = CarbonImmutable::parse($p->starts_on, 'UTC')->max($start);
                    $to = CarbonImmutable::parse($p->ends_on, 'UTC')->min($end);
                    $row['left'] = $start->diffInDays($from) / $days * 100;
                    $row['width'] = ($from->diffInDays($to) + 1) / $days * 100;
                }

                return $row;
            });
        $months = [];
        for ($i = 1; $i <= 12; $i++) {
            $month = $start->month($i);
            $month->locale('de');
            $months[] = ['name' => $month->isoFormat('MMM'), 'width' => $month->daysInMonth / $days * 100];
        }

        return ['year' => $year, 'status' => $status, 'months' => $months, 'scheduled' => $projects->filter(fn ($p) => $p['left'] !== null)->values(), 'unscheduled' => $projects->filter(fn ($p) => $p['left'] === null)->values()];
    }
}
