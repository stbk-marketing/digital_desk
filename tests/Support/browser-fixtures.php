<?php

use App\Actions\MutateWorkspace;
use App\Models\User;
use Illuminate\Contracts\Console\Kernel;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
if (getenv('WORKSPACE_BROWSER_TEST') !== '1' || ! app()->environment('local') || basename(config('database.connections.sqlite.database')) !== 'browser.sqlite') {
    exit(1);
}
foreach (['Anna', 'Britta'] as $name) {
    $user = User::create(['name' => $name, 'email' => strtolower($name).'@example.test', 'password' => 'Browser-test-123!']);
    $user->forceFill(['email_verified_at' => now()])->save();
}
$actor = User::first()->id;
for ($i = 1; $i <= 40; $i++) {
    (new MutateWorkspace)->execute('project', [
        'name' => 'Sehr langer Projektname der Stadtbäckerei Kühl für den visuellen Drucktest '.$i,
        'starts_on' => $i === 1 ? '2025-12-20' : '2026-'.str_pad(($i % 12) + 1, 2, '0', STR_PAD_LEFT).'-01',
        'ends_on' => $i === 1 ? '2026-01-04' : '2026-'.str_pad(($i % 12) + 1, 2, '0', STR_PAD_LEFT).'-28',
    ], $actor);
}
(new MutateWorkspace)->execute('project', ['name' => 'Noch nicht terminiert'], $actor);
