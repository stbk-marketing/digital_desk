<?php

namespace App\Actions;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use RuntimeException;

/** Import an explicitly prepared, credential-free snapshot. No model events or historical activities. */
class ImportLegacyWorkspace
{
    private const TABLES = ['departments', 'department_user', 'media', 'projects', 'ticket_assignees', 'ticket_categories', 'ticket_comments', 'ticket_series', 'tickets', 'users'];

    /** @var array<string, array<int, array<string, mixed>>> */
    private array $tables;

    /** @var array<string, bool> */
    private array $excluded = [];

    /** @param array<string, mixed> $input
     * @param  array<int, int>  $userMap  Explicit old user ID => verified active Workspace user ID.
     * @return array<string, mixed>
     */
    public function execute(array $input, string $inputHash, bool $apply, array $userMap = []): array
    {
        $this->validate($input);
        $this->tables = $input['tables'];
        $this->excluded = [];
        foreach ($input['excluded'] as $entry) {
            $this->excluded[$entry['table'].':'.$entry['id']] = true;
        }
        $this->validateRelations();
        $this->validateExclusions();
        foreach ($userMap as $old => $new) {
            if (! collect($this->tables['users'])->contains('id', $old) || ! DB::table('users')->where('id', $new)->where('is_active', true)->whereNotNull('email_verified_at')->exists()) {
                throw new RuntimeException('Ungültige explizite Benutzerzuordnung.');
            }
        }

        return DB::transaction(function () use ($input, $inputHash, $apply, $userMap) {
            $summary = ['projects' => 0, 'tasks' => 0, 'comments' => 0, 'metadata' => 0, 'already_imported' => 0,
                'excluded' => count($this->excluded), 'uncertain' => count($input['uncertain']), 'missing_completed_at' => 0,
                'multiple_assignees' => 0, 'unmapped_assignees' => 0, 'mode' => $apply ? 'import' : 'dry-run'];
            $run = (string) Str::ulid();
            $actor = null;
            // Never claim that a source user performed an import. This account cannot log in.
            if ($apply) {
                $actor = DB::table('users')->where('email', 'legacy-import@workspace.invalid')->first();
                if ($actor && ($actor->is_active || $actor->name !== 'Technischer Altdatenimport')) {
                    throw new RuntimeException('Importaccount kollidiert mit einem bestehenden Benutzer.');
                }
                if (! $actor) {
                    $id = DB::table('users')->insertGetId(['name' => 'Technischer Altdatenimport', 'email' => 'legacy-import@workspace.invalid',
                        'password' => password_hash(Str::random(80), PASSWORD_BCRYPT), 'is_active' => false,
                        'email_verified_at' => null, 'created_at' => now(), 'updated_at' => now()]);
                    $actor = DB::table('users')->where('id', $id)->first();
                }
                DB::table('legacy_import_runs')->insert(['id' => $run, 'source' => 'aufgabenplaner', 'dump_sha256' => $input['sha256'],
                    'input_sha256' => $inputHash, 'summary' => '{}', 'imported_at' => now()]);
            }
            $projectIds = [];
            foreach (self::TABLES as $table) {
                foreach ($this->tables[$table] as $row) {
                    $sourceId = $this->sourceId($row);
                    if (isset($this->excluded[$table.':'.$sourceId])) {
                        continue;
                    }
                    $payload = json_encode($row, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
                    $hash = hash('sha256', $payload);
                    $existing = DB::table('legacy_records')->where(['source' => 'aufgabenplaner', 'source_table' => $table, 'source_id' => $sourceId])->first();
                    if ($existing) {
                        if (! hash_equals($existing->content_sha256, $hash)) {
                            throw new RuntimeException("Geänderter Quelldatensatz {$table}:{$sourceId}; kein Überschreiben erlaubt.");
                        }
                        if ($table === 'projects') {
                            $projectIds[$row['id']] = $existing->target_id;
                        }
                        $summary['already_imported']++;

                        continue;
                    }
                    $targetTable = null;
                    $targetId = null;
                    if ($table === 'projects') {
                        $targetTable = 'projects';
                        $targetId = (string) Str::ulid();
                        $projectIds[$row['id']] = $targetId;
                        $status = $row['archived_at'] ? 'archived' : ['geplant' => 'active', 'aktiv' => 'active', 'abgeschlossen' => 'completed', 'abgebrochen' => 'archived'][$row['status']];
                        $description = $this->projectNotes($row);
                        if ($apply) {
                            DB::table('projects')->insert(['id' => $targetId, 'name' => $row['title'], 'description' => $description,
                                'starts_on' => $row['start_date'], 'ends_on' => $row['end_date'], 'status' => $status, 'color' => $row['color'],
                                'created_by' => $actor->id, 'created_at' => $row['created_at'], 'updated_at' => $row['updated_at'],
                                'search_text' => mb_strtolower($row['title']."\n".$description, 'UTF-8')]);
                        }
                        $summary['projects']++;
                    } elseif ($table === 'tickets') {
                        $targetTable = 'tasks';
                        $targetId = (string) Str::ulid();
                        $projectId = $row['project_id'] ? ($projectIds[$row['project_id']] ?? null) : null;
                        if ($row['project_id'] && ! $projectId) {
                            throw new RuntimeException("Nicht importierbare Projektbeziehung tickets:{$sourceId}.");
                        }
                        if ($apply && $projectId && ! DB::table('projects')->where('id', $projectId)->whereNull('deleted_at')->exists()) {
                            throw new RuntimeException('Das zugeordnete Importprojekt wurde gelöscht.');
                        }
                        $assignees = array_values(array_filter($this->tables['ticket_assignees'], fn ($a) => $a['ticket_id'] === $row['id']));
                        $assigned = count($assignees) === 1 ? ($userMap[$assignees[0]['user_id']] ?? null) : null;
                        $summary['multiple_assignees'] += count($assignees) > 1 ? 1 : 0;
                        $summary['unmapped_assignees'] += count($assignees) === 1 && ! $assigned ? 1 : 0;
                        $done = in_array($row['status'], ['erledigt', 'abgebrochen'], true);
                        $summary['missing_completed_at'] += $done && ! $row['closed_at'] ? 1 : 0;
                        $notes = $this->taskNotes($row, $assignees);
                        if ($apply) {
                            DB::table('tasks')->insert(['id' => $targetId, 'title' => $row['title'], 'notes' => $notes,
                                'status' => $done ? 'done' : 'open', 'due_on' => $row['deadline_at'] ? substr($row['deadline_at'], 0, 10) : null,
                                'project_id' => $projectId, 'assigned_to' => $assigned, 'created_by' => $actor->id,
                                'completed_at' => $row['closed_at'], 'completed_by' => null, 'archived_at' => $row['archived_at'],
                                'created_at' => $row['created_at'], 'updated_at' => $row['updated_at'],
                                'search_text' => mb_strtolower($row['title']."\n".$notes, 'UTF-8')]);
                        }
                        $summary['tasks']++;
                    } elseif ($table === 'ticket_comments') {
                        $summary['comments']++;
                    } else {
                        $summary['metadata']++;
                    }
                    if ($apply) {
                        DB::table('legacy_records')->insert(['source' => 'aufgabenplaner', 'source_table' => $table, 'source_id' => $sourceId,
                            'content_sha256' => $hash, 'target_table' => $targetTable, 'target_id' => $targetId, 'payload' => $payload, 'run_id' => $run]);
                        if ($targetTable) {
                            DB::table('workspace_changes')->insert(['subject_type' => $targetTable === 'tasks' ? 'task' : 'project', 'subject_id' => $targetId]);
                        }
                    }
                }
            }
            if ($apply) {
                DB::table('legacy_import_runs')->where('id', $run)->update(['summary' => json_encode($summary, JSON_THROW_ON_ERROR)]);
                if (DB::select('PRAGMA foreign_key_check') !== []) {
                    throw new RuntimeException('Fremdschlüsselprüfung fehlgeschlagen.');
                }
            }

            return $summary;
        }, 3);
    }

    /** @param array<string, mixed> $input */
    private function validate(array $input): void
    {
        $rules = ['format' => 'required|in:1', 'source' => 'required|in:aufgabenplaner', 'sha256' => 'required|regex:/^[a-f0-9]{64}$/',
            'tables' => 'required|array:'.implode(',', self::TABLES), 'excluded' => 'present|array', 'uncertain' => 'present|array',
            'excluded.*.table' => 'required|in:'.implode(',', self::TABLES), 'excluded.*.id' => 'required', 'excluded.*.reason' => 'required|string'];
        foreach (self::TABLES as $table) {
            $rules['tables.'.$table] = 'present|array';
            if (! in_array($table, ['department_user', 'ticket_assignees'], true)) {
                $rules['tables.'.$table.'.*.id'] = 'required|integer|min:1|distinct';
            }
        }
        foreach (['projects' => 'geplant,aktiv,abgeschlossen,abgebrochen', 'tickets' => 'offen,in_bearbeitung,erledigt,abgebrochen'] as $table => $statuses) {
            $rules["tables.{$table}.*.title"] = 'required|string|max:'.($table === 'projects' ? '160' : '500');
            $rules["tables.{$table}.*.status"] = 'required|in:'.$statuses;
            $rules["tables.{$table}.*.description"] = 'present|nullable|string';
            foreach (['created_at', 'updated_at', 'archived_at'] as $field) {
                $rules["tables.{$table}.*.{$field}"] = 'present|nullable|date_format:Y-m-d H:i:s';
            }
        }
        foreach (['start_date', 'end_date'] as $field) {
            $rules['tables.projects.*.'.$field] = 'present|nullable|date_format:Y-m-d';
        }
        $rules['tables.projects.*.color'] = 'present|nullable|regex:/^#[a-fA-F0-9]{6}$/';
        foreach (['closed_at', 'deadline_at', 'planned_start_at', 'planned_end_at'] as $field) {
            $rules['tables.tickets.*.'.$field] = 'present|nullable|date_format:Y-m-d H:i:s';
        }
        $rules['tables.tickets.*.data'] = 'present|nullable|json';
        $rules['tables.ticket_comments.*.body'] = 'required|string';
        foreach (['created_at', 'updated_at'] as $field) {
            $rules['tables.ticket_comments.*.'.$field] = 'present|nullable|date_format:Y-m-d H:i:s';
        }
        $rules['tables.users.*'] = 'array:id,name,email,created_at,updated_at';
        $rules['tables.users.*.name'] = 'required|string';
        $rules['tables.users.*.email'] = 'required|email';
        Validator::make($input, $rules)->validate();
        if ($input['uncertain'] !== []) {
            throw new RuntimeException('Ungeklärte Zuordnungen vor dem Import auflösen.');
        }
        foreach ($input['tables']['projects'] as $row) {
            if ($row['start_date'] && $row['end_date'] && $row['start_date'] > $row['end_date']) {
                throw new RuntimeException('Umgekehrter Projektzeitraum projects:'.$row['id']);
            }
        }
    }

    private function validateRelations(): void
    {
        $links = ['department_user' => ['department_id' => 'departments', 'user_id' => 'users'],
            'projects' => ['department_id' => 'departments', 'created_by' => 'users', 'archived_by' => 'users'],
            'tickets' => ['department_id' => 'departments', 'ticket_category_id' => 'ticket_categories', 'created_by' => 'users',
                'archived_by' => 'users', 'project_id' => 'projects', 'ticket_series_id' => 'ticket_series'],
            'ticket_comments' => ['ticket_id' => 'tickets', 'user_id' => 'users'],
            'ticket_assignees' => ['ticket_id' => 'tickets', 'user_id' => 'users', 'assigned_by' => 'users'],
            'ticket_categories' => ['department_id' => 'departments'],
            'ticket_series' => ['department_id' => 'departments', 'ticket_category_id' => 'ticket_categories', 'created_by' => 'users']];
        foreach ($this->tables as $table => $rows) {
            $seen = [];
            foreach ($rows as $row) {
                $id = $this->sourceId($row);
                if (isset($seen[$id])) {
                    throw new RuntimeException('Doppelte Quell-ID: '.$table.':'.$id);
                }
                $seen[$id] = true;
                foreach ($links[$table] ?? [] as $column => $target) {
                    if (! array_key_exists($column, $row) || ($row[$column] !== null && ! collect($this->tables[$target])->containsStrict('id', $row[$column]))) {
                        throw new RuntimeException('Ungültige Quellrelation '.$table.':'.$id.'.'.$column);
                    }
                }
            }
        }
    }

    private function validateExclusions(): void
    {
        $expected = [];
        foreach ($this->tables as $table => $rows) {
            foreach ($rows as $row) {
                if (preg_match('/filial(?:e|en)[\s_-]*(?:des[\s_-]*)?monat(?:s)?|\bfdm\b/iu', implode("\n", array_filter($row, 'is_scalar')))) {
                    $expected[$table.':'.$this->sourceId($row)] = true;
                }
            }
        }
        do {
            $before = count($expected);
            foreach ($this->tables['ticket_comments'] as $row) {
                if (isset($expected['ticket_comments:'.$row['id']])) {
                    $expected['tickets:'.$row['ticket_id']] = true;
                }
            }
            foreach (['tickets' => ['project_id' => 'projects', 'ticket_category_id' => 'ticket_categories', 'ticket_series_id' => 'ticket_series'],
                'ticket_comments' => ['ticket_id' => 'tickets'], 'ticket_assignees' => ['ticket_id' => 'tickets']] as $table => $links) {
                foreach ($this->tables[$table] as $row) {
                    foreach ($links as $column => $parent) {
                        if (isset($expected[$parent.':'.$row[$column]])) {
                            $expected[$table.':'.$this->sourceId($row)] = true;
                        }
                    }
                }
            }
            foreach ($this->tables['media'] as $row) {
                $parent = ['Ticket' => 'tickets', 'Project' => 'projects', 'TicketComment' => 'ticket_comments'][class_basename($row['model_type'])] ?? '';
                if (isset($expected[$parent.':'.$row['model_id']])) {
                    $expected['media:'.$row['id']] = true;
                }
            }
        } while ($before !== count($expected));
        if (array_diff_key($expected, $this->excluded) || array_diff_key($this->excluded, $expected)) {
            throw new RuntimeException('Die Ausschlussliste für Filiale des Monats ist unvollständig oder verändert.');
        }
    }

    /** @param array<string, mixed> $row */
    private function sourceId(array $row): string
    {
        return (string) ($row['id'] ?? (($row['ticket_id'] ?? $row['department_id']).':'.$row['user_id']));
    }

    /** @param array<string, mixed> $row */
    private function projectNotes(array $row): string
    {
        $notes = ($row['description'] ?? '')."\n\n[Altdaten projects:{$row['id']}; Status: {$row['status']}; Ersteller: ".$this->userName($row['created_by']).']'.
            ($row['archive_reason'] ? "\nArchivgrund: ".$row['archive_reason'] : '');
        if (mb_strlen($notes) > 50000) {
            throw new RuntimeException('Beschreibung überschreitet das Workspace-Limit: projects:'.$row['id']);
        }

        return $notes;
    }

    /** @param array<string, mixed> $row
     * @param  array<int, array<string, mixed>>  $assignees
     */
    private function taskNotes(array $row, array $assignees): string
    {
        $notes = ($row['description'] ?? '')."\n\n[Altdaten tickets:{$row['id']}; Status: {$row['status']}; Ersteller: ".$this->userName($row['created_by']).']';
        if ($assignees) {
            $notes .= "\nUrsprünglich zugeordnet: ".implode(', ', array_map(fn ($a) => $this->userName($a['user_id']), $assignees));
        }
        foreach (['planned_start_at' => 'Geplanter Beginn', 'planned_end_at' => 'Geplantes Ende', 'deadline_at' => 'Ursprüngliche Frist', 'archive_reason' => 'Archivgrund', 'priority' => 'Priorität'] as $key => $label) {
            if ($row[$key] !== null && $row[$key] !== '') {
                $notes .= "\n{$label}: {$row[$key]}";
            }
        }
        if ($row['data']) {
            foreach (json_decode($row['data'], true, 512, JSON_THROW_ON_ERROR) as $key => $value) {
                if ($value !== null && $value !== '') {
                    $notes .= "\n{$key}: ".(is_scalar($value) ? (string) $value : json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE));
                }
            }
        }
        foreach ($this->tables['ticket_comments'] as $comment) {
            if ($comment['ticket_id'] === $row['id']) {
                $notes .= "\n\n[Originalkommentar ticket_comments:{$comment['id']}; ".($comment['created_at'] ?? 'Zeitpunkt unbekannt').'; '.$this->userName($comment['user_id'])."]\n".$comment['body'];
            }
        }
        foreach ($this->tables['media'] as $media) {
            if (class_basename($media['model_type']) === 'Ticket' && $media['model_id'] === $row['id']) {
                $notes .= "\n\n[Anhang media:{$media['id']}] {$media['name']} ({$media['file_name']}); Datei ist im SQL-Dump nicht enthalten.";
            }
        }
        if (mb_strlen($notes) > 50000) {
            throw new RuntimeException('Notiz überschreitet das Workspace-Limit: tickets:'.$row['id']);
        }

        return $notes;
    }

    private function userName(int $id): string
    {
        return collect($this->tables['users'])->firstWhere('id', $id)['name'].' (Alt-ID '.$id.')';
    }
}
