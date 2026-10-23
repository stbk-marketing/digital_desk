<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        foreach (['tasks', 'projects'] as $table) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->text('search_text')->default(''));
            foreach (DB::table($table)->cursor() as $row) {
                $text = $table === 'tasks' ? $row->title."\n".$row->notes : $row->name."\n".$row->description;
                DB::table($table)->where('id', $row->id)->update(['search_text' => mb_strtolower($text, 'UTF-8')]);
            }
        }
    }

    public function down(): void
    {
        foreach (['tasks', 'projects'] as $table) {
            Schema::table($table, fn (Blueprint $blueprint) => $blueprint->dropColumn('search_text'));
        }
    }
};
