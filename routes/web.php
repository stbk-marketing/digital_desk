<?php

use Illuminate\Support\Facades\Route;

Route::redirect('/', '/workspace')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('workspace', 'dashboard')->name('dashboard');
    Route::redirect('dashboard', '/workspace');
});

require __DIR__.'/settings.php';
