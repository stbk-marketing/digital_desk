<?php

namespace App\Http\Controllers;

use App\Actions\YearReport;
use App\Models\Activity;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportController extends Controller
{
    /** @return array<string, mixed> */
    private function data(Request $request, int $year, YearReport $report): array
    {
        $data = $request->validate(['status' => ['nullable', 'in:active,completed,archived']]);

        return $report->data($year, $data['status'] ?? null);
    }

    public function json(Request $request, int $year, YearReport $report): JsonResponse
    {
        return response()->json($this->data($request, $year, $report));
    }

    public function print(Request $request, int $year, YearReport $report): Response
    {
        return response()->view('reports.year', $this->data($request, $year, $report));
    }

    /** @param iterable<array<mixed>> $rows */
    private function csv(string $filename, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows) {
            $stream = fopen('php://output', 'w');
            if ($stream === false) {
                throw new \RuntimeException('CSV-Ausgabe nicht verfügbar.');
            }
            fwrite($stream, "\xEF\xBB\xBF");
            foreach ($rows as $row) {
                $safe = array_map(function ($value) {
                    $value = (string) ($value ?? '');

                    return preg_match('/^[\s]*[=+\-@]|^[\t\r\n]/u', $value) ? "'".$value : $value;
                }, $row);
                fputcsv($stream, $safe, ';', '"', '', "\r\n");
            }
            fclose($stream);
        }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function yearCsv(Request $request, int $year, YearReport $report): StreamedResponse
    {
        $data = $this->data($request, $year, $report);
        $rows = [['Projekt', 'Start', 'Ende', 'Status', 'Beschreibung', 'Offene Aufgaben', 'Erledigte Aufgaben']];
        foreach ($data['scheduled']->concat($data['unscheduled']) as $p) {
            $rows[] = [$p['name'], $p['starts_on'], $p['ends_on'], ['active' => 'Aktiv', 'completed' => 'Abgeschlossen', 'archived' => 'Archiviert'][$p['status']], $p['description'], $p['open_tasks'], $p['done_tasks']];
        }

        return $this->csv('kuehl-jahresplan-'.$year.'.csv', $rows);
    }

    public function activitiesCsv(Request $request): StreamedResponse
    {
        $data = $request->validate(['from' => ['nullable', 'date_format:Y-m-d'], 'to' => ['nullable', 'date_format:Y-m-d']]);
        $activities = Activity::query()->join('users', 'users.id', '=', 'activities.actor_id')->select('activities.*', 'users.name as actor_name')
            ->when($data['from'] ?? null, fn ($q, $from) => $q->where('occurred_at', '>=', CarbonImmutable::parse($from, 'Europe/Berlin')->utc()))
            ->when($data['to'] ?? null, fn ($q, $to) => $q->where('occurred_at', '<', CarbonImmutable::parse($to, 'Europe/Berlin')->addDay()->utc()))->orderBy('activities.id')->cursor();
        $rows = (function () use ($activities) {
            yield ['Zeitpunkt UTC', 'Person', 'Objekttyp', 'Objekt-ID', 'Aktion', 'Vorher', 'Nachher'];
            foreach ($activities as $a) {
                yield [$a->occurred_at, $a->actor_name, $a->subject_type, $a->subject_id, $a->event, json_encode($a->before, JSON_UNESCAPED_UNICODE), json_encode($a->after, JSON_UNESCAPED_UNICODE)];
            }
        })();

        return $this->csv('kuehl-bedienhistorie.csv', $rows);
    }
}
