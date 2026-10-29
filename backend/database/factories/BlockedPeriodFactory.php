<?php

namespace Database\Factories;

use App\Models\BlockedPeriod;
use App\Models\Car;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<BlockedPeriod> */
class BlockedPeriodFactory extends Factory
{
    public function definition(): array
    {
        $start = now()->addDays(fake()->numberBetween(5, 60))->startOfDay();

        return [
            'car_id' => Car::factory(),
            'starts_on' => $start,
            'ends_on' => $start->copy()->addDays(2),
            'note' => 'Service',
        ];
    }
}
