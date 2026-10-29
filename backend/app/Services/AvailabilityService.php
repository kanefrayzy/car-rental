<?php

namespace App\Services;

use App\Models\BlockedPeriod;
use App\Models\Booking;
use App\Models\Car;
use App\Support\RentalTime;
use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Collection;

class AvailabilityService
{
    /**
     * Whether the car is free for the whole period.
     *
     * Both end days count as taken: a car coming back on the 14th cannot go out again
     * on the 14th, which leaves the owner time to check and clean it. Dates the owner
     * closed by hand are taken too.
     *
     * $ignore leaves one booking out, so a booking can be checked against all the others.
     */
    public function isAvailable(Car $car, CarbonInterface $pickup, CarbonInterface $return, ?Booking $ignore = null): bool
    {
        return $this->conflictingBookings($car, $pickup, $return, $ignore)->isEmpty()
            && $this->blockedPeriods($car, $pickup, $return)->isEmpty();
    }

    /**
     * Bookings that hold any of the dates.
     *
     * @return Collection<int, Booking>
     */
    public function conflictingBookings(Car $car, CarbonInterface $pickup, CarbonInterface $return, ?Booking $ignore = null)
    {
        return Booking::query()
            ->where('car_id', $car->id)
            ->blocking()
            ->overlapping($pickup, $return)
            ->when($ignore, fn ($query) => $query->whereKeyNot($ignore->getKey()))
            ->orderBy('pickup_date')
            ->get();
    }

    /**
     * Dates the owner closed that fall in the period.
     *
     * @return Collection<int, BlockedPeriod>
     */
    public function blockedPeriods(Car $car, CarbonInterface $pickup, CarbonInterface $return)
    {
        return BlockedPeriod::query()
            ->where('car_id', $car->id)
            ->whereDate('starts_on', '<=', $return->toDateString())
            ->whereDate('ends_on', '>=', $pickup->toDateString())
            ->orderBy('starts_on')
            ->get();
    }

    /**
     * Days and price for a period, from the price stored on the car. Days are charged per
     * started 24 hours from the pick-up time (RentalTime::billedDays).
     *
     * @return array{days: int, pricePerDay: int, totalUsd: int}
     */
    public function quote(Car $car, CarbonInterface $pickup, CarbonInterface $return): array
    {
        $days = RentalTime::billedDays($pickup, $return);
        $rental = $days * $car->price_per_day;
        $taxRate = (float) config('rental.tax_rate');
        $tax = round($rental * $taxRate / 100, 2);

        return [
            'days' => $days,
            'pricePerDay' => $car->price_per_day,
            // The rental alone. Tax comes on top; delivery beyond the free radius is quoted by
            // the owner, and the deposit is separate.
            'totalUsd' => $rental,
            'taxRate' => $taxRate,
            'taxUsd' => $tax,
            'totalWithTaxUsd' => round($rental + $tax, 2),
        ];
    }
}
