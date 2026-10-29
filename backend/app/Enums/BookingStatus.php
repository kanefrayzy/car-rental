<?php

namespace App\Enums;

use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasLabel;

enum BookingStatus: string implements HasColor, HasLabel
{
    /** Request received; the dates are held for a limited time while the deposit is unpaid. */
    case PendingDeposit = 'pending_deposit';

    /** Deposit received; waiting for the owner to confirm. */
    case DepositPaid = 'deposit_paid';

    case Confirmed = 'confirmed';

    /** The car is back. Set by the owner; a few hours later the customer is asked for a review. */
    case Returned = 'returned';

    case Cancelled = 'cancelled';

    /** As the owner sees it in the admin panel. */
    public function getLabel(): string
    {
        return match ($this) {
            self::PendingDeposit => 'New request',
            self::DepositPaid => 'Deposit paid',
            self::Confirmed => 'Confirmed',
            self::Returned => 'Returned',
            self::Cancelled => 'Cancelled',
        };
    }

    public function getColor(): string
    {
        return match ($this) {
            self::PendingDeposit => 'warning',
            self::DepositPaid => 'info',
            self::Confirmed => 'success',
            // Registered in AdminPanelProvider: the built-in colours are all taken.
            self::Returned => 'violet',
            self::Cancelled => 'gray',
        };
    }

    /** Statuses the owner still has to act on. */
    public static function awaitingOwner(): array
    {
        return [self::PendingDeposit, self::DepositPaid];
    }
}
