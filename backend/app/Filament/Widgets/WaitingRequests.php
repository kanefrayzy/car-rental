<?php

namespace App\Filament\Widgets;

use App\Enums\BookingStatus;
use App\Filament\Resources\Bookings\BookingActions;
use App\Filament\Resources\Bookings\BookingResource;
use App\Filament\Resources\Bookings\Tables\BookingsTable;
use App\Models\Booking;
use Filament\Tables\Table;
use Filament\Widgets\TableWidget;

/** Requests the owner has not answered yet, oldest first. */
class WaitingRequests extends TableWidget
{
    protected static ?int $sort = 2;

    protected int|string|array $columnSpan = 'full';

    protected static ?string $heading = 'Waiting for your answer';

    public function table(Table $table): Table
    {
        return $table
            ->query(Booking::query()->whereIn('status', BookingStatus::awaitingOwner()))
            ->defaultSort('created_at')
            ->columns(BookingsTable::columns())
            ->recordUrl(fn (Booking $record): string => BookingResource::getUrl('view', ['record' => $record]))
            ->recordActions([
                BookingActions::confirm()->button()->size('sm'),
                BookingActions::cancel()->button()->size('sm')->outlined(),
            ])
            ->paginated([5, 10, 25])
            ->defaultPaginationPageOption(5)
            ->emptyStateIcon('heroicon-o-check-circle')
            ->emptyStateHeading('All answered')
            ->emptyStateDescription('New requests from the website appear here.');
    }
}
