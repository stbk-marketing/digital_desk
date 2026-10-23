<?php

use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\Artisan;
use Symfony\Component\Process\Process;

$path = getenv('DB_DATABASE');
if (getenv('WORKSPACE_BROWSER_TEST') !== '1' || getenv('APP_ENV') !== 'local' || $path !== realpath(__DIR__.'/../../storage/framework').DIRECTORY_SEPARATOR.'browser.sqlite') {
    exit(1);
}
if (! file_exists($path)) {
    touch($path);
}
require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
Artisan::call('migrate:fresh', ['--force' => true]);
$process = new Process([PHP_BINARY, __DIR__.'/browser-fixtures.php']);
$process->mustRun();
