<?php

namespace App\Services\Deposits;

use App\Exceptions\BookingActionRefused;
use App\Models\Booking;

/** Used while STRIPE_SECRET is not set: no card is saved and nothing is held. */
class UnconfiguredHoldGateway implements HoldGateway
{
    public function enabled(): bool
    {
        return false;
    }

    public function startCardSetup(Booking $booking): CardSetup
    {
        throw $this->off();
    }

    public function savedCard(string $setupIntentId): ?SavedCard
    {
        return null;
    }

    public function placeHold(Booking $booking, int $cents, string $key): HoldResult
    {
        throw $this->off();
    }

    public function holdState(string $intentId): HoldResult
    {
        throw $this->off();
    }

    public function resumeHold(string $intentId): ?string
    {
        return null;
    }

    public function releaseHold(string $intentId): void
    {
        throw $this->off();
    }

    public function captureHold(string $intentId, int $cents): void
    {
        throw $this->off();
    }

    public function chargeSavedCard(Booking $booking, int $cents, string $description, string $key): HoldResult
    {
        throw $this->off();
    }

    private function off(): BookingActionRefused
    {
        return new BookingActionRefused('Card payments are not set up (no Stripe key), so there is no card hold.');
    }
}
