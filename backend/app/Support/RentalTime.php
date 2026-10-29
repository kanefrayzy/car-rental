<?php

namespace App\Support;

use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;

/**
 * Pick-up and return times: the half-hour slots in business hours, how a time is shown, and
 * how many days a period is charged. Times are "HH:MM" in the business time zone
 * (rental.timezone, New York). The site has the same rules in frontend/lib/time.ts.
 */
final class RentalTime
{
    /** @return list<string> "07:00", "07:30" … "23:00" */
    public static function slots(): array
    {
        ['open' => $open, 'close' => $close, 'slot_minutes' => $step] = config('rental.hours');
        $slots = [];
        for ($minutes = self::minutes($open); $minutes <= self::minutes($close); $minutes += $step) {
            $slots[] = sprintf('%02d:%02d', intdiv($minutes, 60), $minutes % 60);
        }

        return $slots;
    }

    /** A date and a slot as a moment in the business time zone. */
    public static function at(string $date, string $time): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m-d H:i', "{$date} {$time}", config('rental.timezone'));
    }

    /** "13:30" as "1:30 PM". */
    public static function label(string $time): string
    {
        return CarbonImmutable::createFromFormat('!H:i', $time)->format('g:i A');
    }

    /**
     * Days charged: every started 24 hours from the pick-up time, at least one. Counted on the
     * wall clock, so a period across a daylight-saving change is not a day longer or shorter.
     */
    public static function billedDays(CarbonInterface $pickup, CarbonInterface $return): int
    {
        // Calendar days between the two dates, counted in UTC where every day has 24 hours.
        $dates = (int) round(CarbonImmutable::parse($pickup->toDateString(), 'UTC')
            ->diffInDays(CarbonImmutable::parse($return->toDateString(), 'UTC')));
        $minutes = $dates * 1440 + self::minutes($return->format('H:i')) - self::minutes($pickup->format('H:i'));

        return max(1, (int) ceil($minutes / 1440));
    }

    private static function minutes(string $time): int
    {
        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return $hours * 60 + $minutes;
    }
}
