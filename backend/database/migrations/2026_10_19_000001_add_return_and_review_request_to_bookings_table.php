<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * When the owner marked the car returned, and when the customer was sent the review request
 * that follows (user, 2026-10-19). The second one is also the guard that it goes out once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('returned_at')->nullable()->after('cancelled_at');
            $table->timestamp('review_requested_at')->nullable()->after('returned_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['returned_at', 'review_requested_at']);
        });
    }
};
