<?php

namespace Tests\Feature;

use App\Filament\Pages\Settings;
use App\Models\Booking;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
        Filament::setCurrentPanel('admin');
        $this->actingAs(User::factory()->create());
        config(['rental.deposit_usd' => 1000]);
    }

    public function test_the_api_gives_the_defaults_until_the_owner_saves_something(): void
    {
        $this->getJson('/api/settings')->assertExactJson(['depositUsd' => 1000, 'instagramUrl' => null]);
    }

    public function test_the_owner_sets_the_deposit_and_instagram_and_new_requests_use_them(): void
    {
        $this->charger();
        // A request sent before the change keeps its deposit.
        $this->postJson('/api/bookings', $this->bookingPayload())->assertCreated();

        Livewire::test(Settings::class)
            ->assertSet('data.deposit_usd', 1000)
            ->set('data.deposit_usd', 1)
            ->set('data.instagram_url', 'https://www.instagram.com/buenoexotics')
            ->call('save')
            ->assertHasNoFormErrors();

        $this->getJson('/api/settings')
            ->assertExactJson(['depositUsd' => 1, 'instagramUrl' => 'https://www.instagram.com/buenoexotics']);

        $this->postJson('/api/bookings', $this->bookingPayload(['pickupDate' => '2026-11-10', 'returnDate' => '2026-11-12']))
            ->assertCreated()
            ->assertJsonPath('depositUsd', 1);
        $this->assertSame([1000, 1], Booking::orderBy('created_at')->orderBy('pickup_date')->pluck('deposit_usd')->all());
    }

    public function test_bad_values_are_refused(): void
    {
        Livewire::test(Settings::class)
            ->set('data.deposit_usd', 0)
            ->set('data.instagram_url', 'https://example.com/page')
            ->call('save')
            ->assertHasFormErrors(['deposit_usd', 'instagram_url']);

        $this->getJson('/api/settings')->assertJsonPath('depositUsd', 1000);
    }

    public function test_an_empty_instagram_link_hides_it(): void
    {
        Livewire::test(Settings::class)
            ->set('data.instagram_url', 'https://www.instagram.com/buenoexotics')
            ->call('save');
        Livewire::test(Settings::class)
            ->set('data.instagram_url', '')
            ->call('save')
            ->assertHasNoFormErrors();

        $this->getJson('/api/settings')->assertJsonPath('instagramUrl', null);
    }

    public function test_the_page_is_for_signed_in_owners_only(): void
    {
        auth()->logout();

        $this->get('/be/settings')->assertRedirect();
        $this->getJson('/api/settings')->assertOk();
    }
}
