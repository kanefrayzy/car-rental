<?php

namespace App\Services\Deposits;

use App\Exceptions\BookingActionRefused;
use App\Models\Booking;

/**
 * Used while STRIPE_SECRET is not set. It takes no money: the site shows its
 * "we'll email you a payment link" message when the client secret is null.
 */
class UnconfiguredDepositGateway implements DepositGateway
{
    public function createIntent(Booking $booking): DepositIntent
    {
        return new DepositIntent(id: null, clientSecret: null);
    }

    public function refund(Booking $booking, int $amountCents): string
    {
        throw new BookingActionRefused('Card payments are not set up, so there is nothing to refund through Stripe.');
    }

    public function createRentalIntent(Booking $booking): DepositIntent
    {
        return new DepositIntent(id: null, clientSecret: null);
    }

    public function refundRental(Booking $booking, int $amountCents): string
    {
        return $this->refund($booking, $amountCents);
    }

    public function cancelIntent(string $intentId): bool
    {
        return true;
    }
}
