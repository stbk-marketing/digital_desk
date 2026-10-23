<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

foreach (['disable' => false, 'enable' => true] as $action => $active) {
    Artisan::command('workspace:user:'.$action.' {email}', function () use ($active) {
        $user = \App\Models\User::where('email', $this->argument('email'))->firstOrFail();
        \Illuminate\Support\Facades\DB::transaction(function () use ($user, $active) {
            $user->forceFill(['is_active' => $active, 'remember_token' => null])->save();
            \Illuminate\Support\Facades\DB::table('sessions')->where('user_id', $user->id)->delete();
        });
        $this->info($active ? 'Konto aktiviert.' : 'Konto und bestehende Sitzungen deaktiviert.');
    });
}
