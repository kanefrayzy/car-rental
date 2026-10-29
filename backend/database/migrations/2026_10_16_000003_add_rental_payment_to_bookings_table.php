<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/* The rental itself (price plus tax), paid online after the owner confirms the booking. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('rental_payment_intent_id')->nullable()->after('deposit_refund_note');
            $table->timestamp('rental_paid_at')->nullable()->after('rental_payment_intent_id');
            $table->decimal('rental_refunded_usd', 10, 2)->nullable()->after('rental_paid_at');
            $table->timestamp('rental_refunded_at')->nullable()->after('rental_refunded_usd');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['rental_payment_intent_id', 'rental_paid_at', 'rental_refunded_usd', 'rental_refunded_at']);
        });
    }
};
