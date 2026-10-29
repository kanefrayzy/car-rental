<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * What the car is for (user, 2026-10-16): a key from config('rental.occasions'), sent by the
 * Occasions cards on the site, or null when the customer did not say.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('occasion', 32)->nullable()->after('return_time');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn('occasion');
        });
    }
};
