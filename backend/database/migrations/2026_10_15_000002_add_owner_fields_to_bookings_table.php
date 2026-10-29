<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** What the owner does with a request in the admin panel. */
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->timestamp('confirmed_at')->nullable()->after('deposit_paid_at');
            $table->timestamp('cancelled_at')->nullable()->after('confirmed_at');
            // Private to the owner; never shown to the customer.
            $table->text('owner_notes')->nullable()->after('cancelled_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['confirmed_at', 'cancelled_at', 'owner_notes']);
        });
    }
};
