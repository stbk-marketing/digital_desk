<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('legacy_import_runs', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('source');
            $table->string('dump_sha256', 64);
            $table->string('input_sha256', 64);
            $table->json('summary');
            $table->timestamp('imported_at');
        });
        Schema::create('legacy_records', function (Blueprint $table) {
            $table->id();
            $table->string('source');
            $table->string('source_table');
            $table->string('source_id');
            $table->string('content_sha256', 64);
            $table->string('target_table')->nullable();
            $table->ulid('target_id')->nullable();
            $table->json('payload');
            $table->foreignUlid('run_id')->constrained('legacy_import_runs')->restrictOnDelete();
            $table->unique(['source', 'source_table', 'source_id']);
            $table->index(['target_table', 'target_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('legacy_records');
        Schema::dropIfExists('legacy_import_runs');
    }
};
