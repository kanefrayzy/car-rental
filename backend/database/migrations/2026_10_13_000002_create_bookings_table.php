<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookings', function (Blueprint $table) {
            $table->id();
            // The reference shown to the customer and used in URLs; the numeric id stays internal.
            $table->ulid('public_id')->unique();
            $table->foreignId('car_id')->constrained()->restrictOnDelete();
            $table->date('pickup_date');
            $table->date('return_date');
            $table->unsignedSmallInteger('days');
            // Price and totals are copied at booking time, so a later price change
            // never alters an existing booking. Whole US dollars.
            $table->unsignedInteger('price_per_day');
            $table->unsignedInteger('total_usd');
            $table->unsignedInteger('deposit_usd');
            $table->string('name');
            $table->string('phone', 32);
            $table->string('email');
            $table->string('status', 32)->index();
            $table->string('stripe_payment_intent_id')->nullable()->unique();
            $table->timestamp('deposit_paid_at')->nullable();
            $table->timestamps();

            $table->index(['car_id', 'pickup_date', 'return_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bookings');
    }
};
