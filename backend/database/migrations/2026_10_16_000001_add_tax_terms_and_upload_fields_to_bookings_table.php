<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/*
 * Booking requests no longer carry the documents: the customer uploads them afterwards
 * through a signed link, so the booking records when that happened. The tax is stored with
 * the booking, at the rate in force when it was made.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->decimal('tax_rate', 6, 3)->default(0)->after('total_usd');
            $table->decimal('tax_usd', 10, 2)->default(0)->after('tax_rate');
            $table->timestamp('terms_accepted_at')->nullable()->after('email');
            $table->timestamp('documents_uploaded_at')->nullable()->after('terms_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('bookings', function (Blueprint $table) {
            $table->dropColumn(['tax_rate', 'tax_usd', 'terms_accepted_at', 'documents_uploaded_at']);
        });
    }
};
