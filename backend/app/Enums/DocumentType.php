<?php

namespace App\Enums;

enum DocumentType: string
{
    case License = 'license';
    case Insurance = 'insurance';

    public function label(): string
    {
        return match ($this) {
            self::License => 'Driver’s license',
            self::Insurance => 'Proof of insurance',
        };
    }

    /** The document in a sentence: "Upload your driver’s license." */
    public function noun(): string
    {
        return match ($this) {
            self::License => 'driver’s license',
            self::Insurance => 'proof of insurance',
        };
    }
}
