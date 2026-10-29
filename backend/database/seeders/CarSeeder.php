<?php

namespace Database\Seeders;

use App\Models\Car;
use Illuminate\Database\Seeder;

/**
 * The fleet. Mirrors frontend/config/cars.ts: the slug must match, because the site sends
 * it with every availability check and booking. The price here is the one bookings are
 * charged at; the site only displays its own copy.
 *
 * Safe to run on every deploy: it adds the car only if it is missing and never overwrites
 * a price or text that was changed in the database afterwards.
 */
class CarSeeder extends Seeder
{
    public function run(): void
    {
        Car::firstOrCreate(
            ['slug' => 'dodge-charger-widebody'],
            [
                'name' => 'Dodge Charger Widebody',
                'full_name' => '2023 Dodge Charger SRT Hellcat Widebody Jailbreak',
                'category' => 'American Muscle',
                'price_per_day' => 499, // confirmed by the client on 2026-10-14
                'specs' => [
                    ['icon' => 'horsepower', 'value' => '717 HP', 'label' => 'Horsepower'],
                    ['icon' => 'acceleration', 'value' => '3.6 s', 'label' => '0–60 mph'],
                    ['icon' => 'topSpeed', 'value' => '196 mph', 'label' => 'Top speed'],
                    ['icon' => 'seats', 'value' => '5 seats', 'label' => 'Seating'],
                ],
                'gallery' => [],
                'is_active' => true,
                'position' => 0,
            ],
        );
    }
}
