<?php

namespace App\Services\Deposits;

/** What the site needs to collect a deposit. Both values are null while payments are off. */
final readonly class DepositIntent
{
    public function __construct(
        public ?string $id,
        public ?string $clientSecret,
    ) {}
}
