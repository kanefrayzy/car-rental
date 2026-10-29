<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/* What came back of a Stripe deposit: all of it on a cancellation, the rest after deductions once the car is returned. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('deposit_refunded_usd', 10, 2)->nullable()->after('deposit_paid_at');
            $table->timestamp('deposit_refunded_at')->nullable()->after('deposit_refunded_usd');
            $table->string('deposit_refund_note', 500)->nullable()->after('deposit_refunded_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['deposit_refunded_usd', 'deposit_refunded_at', 'deposit_refund_note']);
        });
    }
};
