<?php

use App\Models\User;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

foreach (['disable' => false, 'enable' => true] as $action => $active) {
    Artisan::command('workspace:user:'.$action.' {email}', function () use ($active) {
        $user = User::where('email', $this->argument('email'))->firstOrFail();
        DB::transaction(function () use ($user, $active) {
            $user->forceFill(['is_active' => $active, 'remember_token' => null])->save();
            DB::table('sessions')->where('user_id', $user->id)->delete();
        });
        $this->info($active ? 'Konto aktiviert.' : 'Konto und bestehende Sitzungen deaktiviert.');
    });
}
