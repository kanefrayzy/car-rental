<?php

namespace Database\Factories;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Models\Car;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Booking>
 */
class BookingFactory extends Factory
{
    public function definition(): array
    {
        return [
            'car_id' => Car::factory(),
            'pickup_date' => now()->addDays(10)->toDateString(),
            'pickup_time' => '10:00',
            'pickup_time' => '10:00',
            'return_date' => now()->addDays(13)->toDateString(),
            'return_time' => '10:00',
            'return_time' => '10:00',
            'days' => 3,
            'price_per_day' => 499,
            'total_usd' => 1497,
            'deposit_usd' => 500,
            'name' => fake()->name(),
            'phone' => '6315550142',
            'email' => fake()->safeEmail(),
            'status' => BookingStatus::PendingDeposit,
        ];
    }

    /** The given dates, with days and total worked out to match. */
    public function between(string $pickup, string $return): static
    {
        return $this->state(function (array $attributes) use ($pickup, $return) {
            $days = (int) date_diff(date_create($pickup), date_create($return))->days;

            return [
                'pickup_date' => $pickup,
                'return_date' => $return,
                'days' => $days,
                'total_usd' => $days * $attributes['price_per_day'],
            ];
        });
    }

    public function status(BookingStatus $status): static
    {
        return $this->state(['status' => $status]);
    }
}
