<?php

namespace App\Services\Deposits;

use Carbon\CarbonImmutable;

/**
 * The outcome of an authorisation or a charge on a saved card.
 *
 * `status`: "held" (authorised, capturable until `expiresAt`), "succeeded" (charged),
 * "failed" (declined, or the bank wants the customer: `failureCode` says which),
 * "canceled" (released or expired), "pending" (still with the customer or the bank).
 */
final readonly class HoldResult
{
    public function __construct(
        public string $status,
        public ?string $intentId = null,
        public ?CarbonImmutable $expiresAt = null,
        public ?string $failureCode = null,
        public ?string $failureMessage = null,
        public ?string $paymentMethodId = null,
        public ?string $cardLabel = null,
    ) {}

    public function ok(): bool
    {
        return in_array($this->status, ['held', 'succeeded'], true);
    }

    /** What the owner and the customer read about a failure. */
    public function reason(): string
    {
        return match ($this->failureCode) {
            'authentication_required' => 'The bank wants the customer to confirm the hold (3D Secure).',
            'insufficient_funds' => 'Insufficient funds on the card.',
            'expired_card' => 'The card has expired.',
            'card_declined', 'generic_decline', 'do_not_honor' => 'The card was declined.',
            default => $this->failureMessage ?: 'The card was declined.',
        };
    }
}
