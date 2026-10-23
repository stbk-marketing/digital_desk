<?php

use App\Http\Controllers\ReportController;
use App\Http\Controllers\TrashController;
use App\Http\Controllers\WorkspaceController;
use Illuminate\Support\Facades\Route;

Route::redirect('/', '/workspace')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('workspace', [WorkspaceController::class, 'index'])->name('dashboard');
    Route::redirect('dashboard', '/workspace');
    Route::prefix('api/workspace')->controller(WorkspaceController::class)->group(function () {
        Route::get('tasks', 'tasks');
        Route::post('tasks', 'createTask');
        Route::patch('tasks/{task}', 'updateTask')->withTrashed();
        Route::get('projects', 'projects');
        Route::post('projects', 'createProject');
        Route::patch('projects/{project}', 'updateProject')->withTrashed();
        Route::get('activities', 'activities');
        Route::get('changes', 'changes');
        Route::get('trash', [TrashController::class, 'index']);
        Route::get('trash/links/{id}', [TrashController::class, 'links'])->whereUlid('id');
        Route::post('trash/{type}/{id}/{operation}', [TrashController::class, 'mutate'])->whereUlid('id');
        Route::get('year/{year}', [ReportController::class, 'json'])->whereNumber('year');
    });
    Route::get('reports/year/{year}/print', [ReportController::class, 'print'])->whereNumber('year');
    Route::get('reports/year/{year}.csv', [ReportController::class, 'yearCsv'])->whereNumber('year');
    Route::get('reports/activities.csv', [ReportController::class, 'activitiesCsv']);
    Route::get('reports/year/{year}', [ReportController::class, 'print'])->whereNumber('year');
});

require __DIR__.'/settings.php';
