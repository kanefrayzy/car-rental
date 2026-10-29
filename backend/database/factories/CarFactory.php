<?php

namespace Database\Factories;

use App\Models\Car;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Car>
 */
class CarFactory extends Factory
{
    public function definition(): array
    {
        return [
            'slug' => fake()->unique()->slug(3),
            'name' => 'Dodge Charger Widebody',
            'full_name' => '2023 Dodge Charger SRT Hellcat Widebody Jailbreak',
            'category' => 'American Muscle',
            'price_per_day' => 499,
            'specs' => [
                ['icon' => 'horsepower', 'value' => '717 HP', 'label' => 'Horsepower'],
            ],
            'gallery' => [],
            'is_active' => true,
            'position' => 0,
        ];
    }
}
