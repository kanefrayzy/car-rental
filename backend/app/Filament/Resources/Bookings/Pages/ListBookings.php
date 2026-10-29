<?php

namespace App\Filament\Resources\Bookings\Pages;

use App\Enums\BookingStatus;
use App\Filament\Resources\Bookings\BookingResource;
use App\Models\Booking;
use Filament\Resources\Pages\ListRecords;
use Filament\Schemas\Components\Tabs\Tab;
use Illuminate\Database\Eloquent\Builder;

class ListBookings extends ListRecords
{
    protected static string $resource = BookingResource::class;

    public function getTabs(): array
    {
        $today = today(config('rental.timezone'))->toDateString();

        return [
            'waiting' => Tab::make('Waiting for you')
                ->badge(fn () => Booking::whereIn('status', BookingStatus::awaitingOwner())->count() ?: null)
                ->badgeColor('warning')
                ->modifyQueryUsing(fn (Builder $query) => $query->whereIn('status', BookingStatus::awaitingOwner())),
            'upcoming' => Tab::make('Upcoming')
                ->modifyQueryUsing(fn (Builder $query) => $query
                    ->where('status', BookingStatus::Confirmed)
                    ->whereDate('return_date', '>=', $today)),
            // Returned rentals, and confirmed ones whose return date has gone by; the badge
            // counts those not marked returned yet (marking one sends the review request).
            'past' => Tab::make('Past')
                ->badge(fn () => Booking::where('status', BookingStatus::Confirmed)->whereDate('return_date', '<', $today)->count() ?: null)
                ->badgeColor('gray')
                ->modifyQueryUsing(fn (Builder $query) => $query->where(fn (Builder $query) => $query
                    ->where('status', BookingStatus::Returned)
                    ->orWhere(fn (Builder $query) => $query
                        ->where('status', BookingStatus::Confirmed)
                        ->whereDate('return_date', '<', $today)))),
            'cancelled' => Tab::make('Cancelled')
                ->modifyQueryUsing(fn (Builder $query) => $query->where('status', BookingStatus::Cancelled)),
            'all' => Tab::make('All'),
        ];
    }
}
