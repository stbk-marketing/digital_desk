<?php

use App\Actions\MutateWorkspace;
use App\Actions\TrashWorkspace;
use App\Models\Project;
use App\Models\Task;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
config(['database.default' => 'sqlite', 'database.connections.sqlite.database' => $argv[1]]);
DB::purge('sqlite');
try {
    if (($argv[5] ?? '') === 'project-delete') {
        (new TrashWorkspace)->execute('project', $argv[2], 'delete', 1, (int) $argv[3]);
    } elseif (($argv[5] ?? '') === 'project-update') {
        (new MutateWorkspace)->execute('project', ['name' => $argv[4], 'expected_version' => 1], (int) $argv[3], Project::withTrashed()->findOrFail($argv[2]));
    } elseif (($argv[5] ?? '') === 'delete') {
        (new TrashWorkspace)->execute('task', $argv[2], 'delete', 1, (int) $argv[3]);
    } else {
        (new MutateWorkspace)->execute('task', ['title' => $argv[4], 'expected_version' => 1], (int) $argv[3], Task::withTrashed()->findOrFail($argv[2]));
    }
    echo '200';
} catch (HttpResponseException $e) {
    echo $e->getResponse()->getStatusCode();
}
