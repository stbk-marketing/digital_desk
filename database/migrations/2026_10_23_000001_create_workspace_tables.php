<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', fn (Blueprint $table) => $table->boolean('is_active')->default(true));
        Schema::create('projects', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name', 160);
            $table->text('description')->nullable();
            $table->date('starts_on')->nullable();
            $table->date('ends_on')->nullable();
            $table->string('status')->default('active')->index();
            $table->string('color')->nullable();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
        });
        Schema::create('tasks', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('title', 500);
            $table->text('notes')->nullable();
            $table->string('status')->default('open');
            $table->date('due_on')->nullable();
            $table->foreignUlid('project_id')->nullable()->constrained()->restrictOnDelete();
            $table->foreignId('assigned_to')->nullable()->constrained('users')->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('completed_at')->nullable();
            $table->foreignId('completed_by')->nullable()->constrained('users')->restrictOnDelete();
            $table->date('snoozed_until')->nullable();
            $table->unsignedInteger('version')->default(1);
            $table->integer('sort_index')->nullable();
            $table->timestamp('archived_at')->nullable()->index();
            $table->timestamps();
            $table->index(['status', 'due_on']);
        });
        Schema::create('activities', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->string('subject_type');
            $table->ulid('subject_id');
            $table->string('event');
            $table->json('before')->nullable();
            $table->json('after')->nullable();
            $table->timestamp('occurred_at');
            $table->index(['subject_type', 'subject_id']);
        });
        Schema::create('workspace_changes', function (Blueprint $table) {
            $table->id();
            $table->string('subject_type');
            $table->ulid('subject_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_changes');
        Schema::dropIfExists('activities');
        Schema::dropIfExists('tasks');
        Schema::dropIfExists('projects');
        Schema::table('users', fn (Blueprint $table) => $table->dropColumn('is_active'));
    }
};
