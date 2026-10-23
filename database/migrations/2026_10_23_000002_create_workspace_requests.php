<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('workspace_requests', function (Blueprint $table) {
            $table->foreignId('actor_id')->constrained('users')->restrictOnDelete();
            $table->uuid('request_id');
            $table->string('subject_type');
            $table->ulid('subject_id');
            $table->primary(['actor_id', 'request_id', 'subject_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('workspace_requests');
    }
};
