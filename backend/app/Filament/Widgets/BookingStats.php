<?php

namespace App\Filament\Widgets;

use App\Enums\BookingStatus;
use App\Filament\Pages\Calendar;
use App\Filament\Resources\Bookings\BookingResource;
use App\Models\Booking;
use App\Support\RentalTime;
use Filament\Support\Icons\Heroicon;
use Filament\Widgets\StatsOverviewWidget;
use Filament\Widgets\StatsOverviewWidget\Stat;

/** The dashboard's first row: what needs the owner now, and what is coming. */
class BookingStats extends StatsOverviewWidget
{
    protected static ?int $sort = 1;

    protected ?string $pollingInterval = '60s';

    protected function getStats(): array
    {
        $today = today(config('rental.timezone'));
        $confirmed = Booking::where('status', BookingStatus::Confirmed);
        // Returned rentals still count as booked; they are just no longer out.
        $booked = Booking::whereIn('status', [BookingStatus::Confirmed, BookingStatus::Returned]);

        $waiting = Booking::whereIn('status', BookingStatus::awaitingOwner())->count();
        $out = (clone $confirmed)
            ->whereDate('pickup_date', '<=', $today->toDateString())
            ->whereDate('return_date', '>=', $today->toDateString())
            ->first();
        $next = (clone $confirmed)
            ->whereDate('pickup_date', '>', $today->toDateString())
            ->orderBy('pickup_date')
            ->first();
        $monthTotal = $booked
            ->whereDate('pickup_date', '>=', $today->copy()->startOfMonth()->toDateString())
            ->whereDate('pickup_date', '<=', $today->copy()->endOfMonth()->toDateString())
            ->sum('total_usd');

        return [
            Stat::make('Waiting for you', $waiting)
                ->description($waiting === 1 ? 'Request to confirm or decline' : 'Requests to confirm or decline')
                ->descriptionIcon(Heroicon::OutlinedInboxStack)
                ->color($waiting > 0 ? 'warning' : 'gray')
                ->url(BookingResource::getUrl('index')),
            Stat::make('The car today', $out ? 'Rented' : 'Free')
                ->description($out ? "{$out->name}, back {$out->return_date->format('M j')} at ".RentalTime::label($out->return_time) : 'Not out today')
                ->descriptionIcon(Heroicon::OutlinedKey)
                ->color($out ? 'success' : 'gray')
                ->url($out ? BookingResource::getUrl('view', ['record' => $out]) : Calendar::getUrl()),
            Stat::make('Next pickup', $next ? $next->pickup_date->format('M j').', '.RentalTime::label($next->pickup_time) : 'None booked')
                ->description($next ? "{$next->name}, {$next->days} ".str('day')->plural($next->days) : 'No confirmed bookings ahead')
                ->descriptionIcon(Heroicon::OutlinedCalendarDays)
                ->url($next ? BookingResource::getUrl('view', ['record' => $next]) : Calendar::getUrl()),
            Stat::make('Booked this month', '$'.number_format($monthTotal))
                ->description('Confirmed rentals starting in '.$today->format('F'))
                ->descriptionIcon(Heroicon::OutlinedBanknotes),
        ];
    }
}
