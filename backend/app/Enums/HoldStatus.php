<?php

namespace App\Enums;

use Filament\Support\Contracts\HasColor;
use Filament\Support\Contracts\HasLabel;

/** Where a booking's deposit hold stands (deposit_mode "hold"). Null: no card saved yet. */
enum HoldStatus: string implements HasColor, HasLabel
{
    /** The card is saved; the hold is placed before pick-up. */
    case Scheduled = 'scheduled';

    /** The card is authorised for the deposit. Nothing is charged. */
    case OnHold = 'on_hold';

    /** The bank refused the hold, or wants the customer to confirm it. The owner decides. */
    case Failed = 'failed';

    /** Cancelled by the owner (or with the booking): nothing taken. */
    case Released = 'released';

    /** Part or all of the hold was taken; the rest went back. */
    case Captured = 'captured';

    /** Stripe's capture deadline passed before anyone released or captured it. */
    case Expired = 'expired';

    public function getLabel(): string
    {
        return match ($this) {
            self::Scheduled => 'Scheduled',
            self::OnHold => 'On hold',
            self::Failed => 'Hold failed',
            self::Released => 'Released',
            self::Captured => 'Captured',
            self::Expired => 'Expired',
        };
    }

    public function getColor(): string
    {
        return match ($this) {
            self::Scheduled => 'gray',
            self::OnHold => 'success',
            self::Failed => 'danger',
            self::Released => 'info',
            self::Captured => 'warning',
            self::Expired => 'gray',
        };
    }

    /** A hold exists, or should: the owner still has to release or capture it. */
    public function isOpen(): bool
    {
        return in_array($this, [self::Scheduled, self::OnHold, self::Failed], true);
    }
}
