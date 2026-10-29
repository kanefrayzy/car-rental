<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Pick-up and return times (user, 2026-10-16): half-hour slots in business hours, New York
 * time, as "HH:MM". Bookings made before have no time; they get 10:00, the site's default.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('pickup_time', 5)->default('10:00')->after('pickup_date');
            $table->string('return_time', 5)->default('10:00')->after('return_date');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['pickup_time', 'return_time']);
        });
    }
};
