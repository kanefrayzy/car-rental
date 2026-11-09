<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * The deposit as a card hold (owner, 2026-11-10): the request saves the card, a hold is placed
 * before pick-up and released or partly captured after the return; extra charges go to the
 * saved card. Bookings made before keep deposit_mode "charge" and work as they did.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->string('deposit_mode', 10)->default('charge')->after('deposit_usd');

            $table->string('stripe_customer_id')->nullable()->after('stripe_payment_intent_id');
            $table->string('stripe_setup_intent_id')->nullable()->after('stripe_customer_id');
            $table->string('stripe_payment_method_id')->nullable()->after('stripe_setup_intent_id');
            $table->string('card_label', 60)->nullable()->after('stripe_payment_method_id');
            $table->timestamp('card_saved_at')->nullable()->after('card_label');
            // When the customer ticked "I authorize a $500 hold..." before saving the card.
            $table->timestamp('hold_authorized_at')->nullable()->after('card_saved_at');

            $table->string('hold_status', 20)->nullable()->after('hold_authorized_at');
            // The authorisation that can be captured now, and a failed one waiting for the
            // customer to finish it on their booking page.
            $table->string('hold_payment_intent_id')->nullable()->after('hold_status');
            $table->string('hold_pending_intent_id')->nullable()->after('hold_payment_intent_id');
            $table->unsignedSmallInteger('hold_attempts')->default(0)->after('hold_pending_intent_id');
            $table->timestamp('hold_placed_at')->nullable()->after('hold_attempts');
            // Stripe's capture_before for the current hold.
            $table->timestamp('hold_expires_at')->nullable()->after('hold_placed_at');
            $table->timestamp('hold_failed_at')->nullable()->after('hold_expires_at');
            $table->string('hold_failure', 255)->nullable()->after('hold_failed_at');
            $table->timestamp('hold_released_at')->nullable()->after('hold_failure');
            $table->decimal('hold_captured_usd', 10, 2)->nullable()->after('hold_released_at');
            $table->timestamp('hold_captured_at')->nullable()->after('hold_captured_usd');
            $table->string('hold_capture_reason', 500)->nullable()->after('hold_captured_at');
            $table->timestamp('hold_reminded_at')->nullable()->after('hold_capture_reason');

            $table->index('hold_status');
        });

        // Charges to the saved card on top of the hold: tolls that arrive weeks later, damage,
        // a late cancellation fee. One row per charge, failed ones too.
        Schema::create('booking_charges', function (Blueprint $table) {
            $table->id();
            $table->foreignId('booking_id')->constrained()->cascadeOnDelete();
            $table->string('reason', 30);
            $table->string('note', 500)->nullable();
            $table->decimal('amount_usd', 10, 2);
            $table->string('status', 20);
            $table->string('stripe_payment_intent_id')->nullable();
            $table->string('failure', 255)->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('booking_charges');

        Schema::table('bookings', function (Blueprint $table) {
            $table->dropIndex(['hold_status']);
            $table->dropColumn([
                'deposit_mode', 'stripe_customer_id', 'stripe_setup_intent_id', 'stripe_payment_method_id',
                'card_label', 'card_saved_at', 'hold_authorized_at', 'hold_status', 'hold_payment_intent_id',
                'hold_pending_intent_id', 'hold_attempts', 'hold_placed_at', 'hold_expires_at', 'hold_failed_at',
                'hold_failure', 'hold_released_at', 'hold_captured_usd', 'hold_captured_at', 'hold_capture_reason',
                'hold_reminded_at',
            ]);
        });
    }
};
