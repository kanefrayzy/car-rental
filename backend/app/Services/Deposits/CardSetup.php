<?php

namespace App\Services\Deposits;

/** What the booking page needs to save a card: Stripe's ids and the SetupIntent's client secret. */
final readonly class CardSetup
{
    public function __construct(
        public string $customerId,
        public string $setupIntentId,
        public string $clientSecret,
    ) {}
}
