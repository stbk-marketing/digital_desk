<?php

use App\Actions\MutateWorkspace;
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
    (new MutateWorkspace)->execute('task', ['title' => $argv[4], 'expected_version' => 1], (int) $argv[3], Task::findOrFail($argv[2]));
    echo '200';
} catch (HttpResponseException $e) {
    echo $e->getResponse()->getStatusCode();
}
