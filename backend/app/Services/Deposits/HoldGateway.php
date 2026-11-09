<?php

namespace App\Services\Deposits;

use App\Models\Booking;

/**
 * The card side of a deposit hold (deposit_mode "hold"): save the card with the request, place
 * an authorisation on it later without the customer, release or capture it, and charge the
 * saved card for extras. App\Services\DepositHolds holds the rules; this only talks to Stripe.
 */
interface HoldGateway
{
    /** False while payments are off: the booking page then says we will call about the deposit. */
    public function enabled(): bool;

    /**
     * Start saving the customer's card (a SetupIntent for off-session use), creating the
     * Stripe customer on first use. Calling it again resumes the same unfinished setup.
     */
    public function startCardSetup(Booking $booking): CardSetup;

    /** The saved card once the setup succeeded; null while it has not. */
    public function savedCard(string $setupIntentId): ?SavedCard;

    /**
     * Authorise `$cents` on the saved card without the customer (capture later). Declines and
     * banks that want the customer to confirm come back as a failed HoldResult, not an exception.
     * The same `$key` never authorises twice.
     */
    public function placeHold(Booking $booking, int $cents, string $key): HoldResult;

    /** The current state of a hold, e.g. after the customer finished it on their page. */
    public function holdState(string $intentId): HoldResult;

    /**
     * Let the customer finish a failed hold on their booking page (confirm with their bank, or
     * use another card, which is then saved too). Returns the client secret, or null when the
     * hold can no longer be finished.
     */
    public function resumeHold(string $intentId): ?string;

    /** Cancel an authorisation: the money is free again on the customer's card. */
    public function releaseHold(string $intentId): void;

    /** Take part or all of the hold; Stripe releases the rest. */
    public function captureHold(string $intentId, int $cents): void;

    /** Charge the saved card now, without the customer. Same failure handling as placeHold. */
    public function chargeSavedCard(Booking $booking, int $cents, string $description, string $key): HoldResult;
}
