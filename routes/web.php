<?php

use Illuminate\Support\Facades\Route;

Route::redirect('/', '/workspace')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('workspace', [\App\Http\Controllers\WorkspaceController::class, 'index'])->name('dashboard');
    Route::redirect('dashboard', '/workspace');
    Route::prefix('api/workspace')->controller(\App\Http\Controllers\WorkspaceController::class)->group(function () {
        Route::get('tasks', 'tasks');
        Route::post('tasks', 'createTask');
        Route::patch('tasks/{task}', 'updateTask');
        Route::get('projects', 'projects');
        Route::post('projects', 'createProject');
        Route::patch('projects/{project}', 'updateProject');
        Route::get('activities', 'activities');
        Route::get('changes', 'changes');
        Route::get('year/{year}', [\App\Http\Controllers\ReportController::class, 'json'])->whereNumber('year');
    });
    Route::get('reports/year/{year}/print', [\App\Http\Controllers\ReportController::class, 'print'])->whereNumber('year');
    Route::get('reports/year/{year}.csv', [\App\Http\Controllers\ReportController::class, 'yearCsv'])->whereNumber('year');
    Route::get('reports/activities.csv', [\App\Http\Controllers\ReportController::class, 'activitiesCsv']);
    Route::get('reports/year/{year}', [\App\Http\Controllers\ReportController::class, 'print'])->whereNumber('year');
});

require __DIR__.'/settings.php';
