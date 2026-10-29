<?php

namespace App\Services\Deposits;

use App\Models\Booking;

/** Card payments for a booking: the deposit with the request, the rental after confirmation. */
interface DepositGateway
{
    /**
     * Start (or resume) collecting the deposit for a booking. Calling it again for the
     * same booking must return the same intent, never create a second charge.
     */
    public function createIntent(Booking $booking): DepositIntent;

    /** The same for the rental itself (price plus tax), once the owner has confirmed. */
    public function createRentalIntent(Booking $booking): DepositIntent;

    /**
     * Give back part or all of a paid deposit to the card it came from. Returns the
     * provider's refund id. A deposit is refunded once: the amount is final.
     */
    public function refund(Booking $booking, int $amountCents): string;

    /** The same for the rental payment (a cancelled booking). */
    public function refundRental(Booking $booking, int $amountCents): string;

    /**
     * Close a payment the customer started on the website but did not finish, because the
     * owner took the money another way (cash, Zelle). Returns false when the customer has
     * paid it after all; it is then recorded by the webhook.
     */
    public function cancelIntent(string $intentId): bool;
}
