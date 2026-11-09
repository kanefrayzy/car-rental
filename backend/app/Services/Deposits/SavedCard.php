<?php

namespace App\Services\Deposits;

/** A card saved for later charges: Stripe's payment method and "Visa •••• 4242" for people. */
final readonly class SavedCard
{
    public function __construct(
        public string $paymentMethodId,
        public string $label,
    ) {}
}
