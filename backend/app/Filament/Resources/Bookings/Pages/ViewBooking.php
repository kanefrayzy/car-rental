<?php

namespace App\Filament\Resources\Bookings\Pages;

use App\Filament\Resources\Bookings\BookingActions;
use App\Filament\Resources\Bookings\BookingResource;
use Filament\Resources\Pages\ViewRecord;
use Illuminate\Contracts\Support\Htmlable;

class ViewBooking extends ViewRecord
{
    protected static string $resource = BookingResource::class;

    public function getTitle(): string|Htmlable
    {
        return $this->getRecord()->name;
    }

    protected function getHeaderActions(): array
    {
        return [
            BookingActions::confirm(),
            BookingActions::markDepositPaid(),
            BookingActions::refundDeposit(),
            BookingActions::markRentalPaid(),
            BookingActions::markReturned(),
            BookingActions::sendReviewRequest(),
            BookingActions::editNotes(),
            BookingActions::cancel(),
        ];
    }
}
