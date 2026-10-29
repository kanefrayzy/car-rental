<?php

namespace Tests\Feature;

use App\Models\Car;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ApiBasicsTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_car_list_has_the_shape_the_site_expects(): void
    {
        $this->charger(['price_per_day' => 499]);
        Car::factory()->create(['is_active' => false]);

        $this->getJson('/api/cars')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0', [
                'slug' => 'dodge-charger-widebody',
                'name' => 'Dodge Charger Widebody',
                'fullName' => '2023 Dodge Charger SRT Hellcat Widebody Jailbreak',
                'category' => 'American Muscle',
                'pricePerDay' => 499,
                'currency' => 'USD',
                'specs' => [['icon' => 'horsepower', 'value' => '717 HP', 'label' => 'Horsepower']],
                'gallery' => [],
            ]);
    }

    public function test_seeding_twice_keeps_one_charger(): void
    {
        $this->seed(DatabaseSeeder::class);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(1, Car::where('slug', 'dodge-charger-widebody')->count());
        $this->assertCount(4, Car::sole()->specs);
    }

    public function test_only_the_site_may_call_the_api_from_a_browser(): void
    {
        config(['cors.allowed_origins' => ['https://rental.example', 'https://www.rental.example']]);

        $this->getJson('/api/cars', ['Origin' => 'https://rental.example'])
            ->assertHeader('Access-Control-Allow-Origin', 'https://rental.example');

        $this->getJson('/api/cars', ['Origin' => 'https://evil.example'])
            ->assertHeaderMissing('Access-Control-Allow-Origin');

        // With a single allowed site the header always names that site, never the caller.
        config(['cors.allowed_origins' => ['https://rental.example']]);

        $this->getJson('/api/cars', ['Origin' => 'https://evil.example'])
            ->assertHeader('Access-Control-Allow-Origin', 'https://rental.example');
    }

    public function test_errors_are_json_for_api_paths(): void
    {
        $this->get('/api/nothing-here')
            ->assertNotFound()
            ->assertHeader('Content-Type', 'application/json');
    }

    public function test_a_missing_booking_does_not_reveal_how_the_app_is_built(): void
    {
        config(['app.debug' => true]);

        $this->postJson('/api/bookings/01ARZ3NDEKTSV4RRFFQ69G5FAV/deposit')
            ->assertNotFound()
            ->assertExactJson(['message' => 'Not found.']);
    }

    public function test_the_root_says_this_is_an_api(): void
    {
        $this->getJson('/')->assertOk()->assertJsonPath('status', 'ok');
    }
}
