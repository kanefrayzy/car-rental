<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The scheduled blog agent (2026-11-09): which picture of the cover pool a post wears, so the
 * next one can take another, and whether the post came in through POST /api/blog/publish.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->string('cover_source', 64)->nullable()->after('cover_alt');
            $table->string('origin', 16)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('posts', function (Blueprint $table) {
            $table->dropColumn(['cover_source', 'origin']);
        });
    }
};
