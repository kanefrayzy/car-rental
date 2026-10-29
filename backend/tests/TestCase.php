<?php

namespace Tests;

use App\Models\Booking;
use App\Models\Car;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Http\UploadedFile;

abstract class TestCase extends BaseTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // A fixed "now": noon in New York on a known day, so date rules are predictable.
        $this->travelTo('2026-10-13 16:00:00');

        // Rate limits have their own test; everywhere else they would only get in the way.
        config([
            'rental.rate_limits.api_per_minute' => 1000,
            'rental.rate_limits.bookings_per_minute' => 1000,
        ]);
    }

    protected function charger(array $attributes = []): Car
    {
        return Car::factory()->create(['slug' => 'dodge-charger-widebody', ...$attributes]);
    }

    /** A complete, valid booking request; override any field. */
    protected function bookingPayload(array $overrides = []): array
    {
        return [
            'carSlug' => 'dodge-charger-widebody',
            'pickupDate' => '2026-10-20',
            'pickupTime' => '10:00',
            'returnDate' => '2026-10-23',
            'returnTime' => '10:00',
            'name' => 'Jordan Rivera',
            'phone' => '(631) 555-0142',
            'email' => 'Jordan@Example.com',
            'acceptTerms' => true,
            ...$overrides,
        ];
    }

    /** Both documents, as the upload page sends them; override either. */
    protected function documentFiles(array $overrides = []): array
    {
        return [
            'license' => UploadedFile::fake()->image('license.jpg', 800, 500),
            'insurance' => UploadedFile::fake()->create('insurance.pdf', 300, 'application/pdf'),
            ...$overrides,
        ];
    }

    /** The API path behind the customer's upload link (what the website's /upload page calls). */
    protected function uploadPath(Booking $booking): string
    {
        parse_str((string) parse_url($booking->pageUrl(), PHP_URL_QUERY), $query);

        return "/api/bookings/{$booking->public_id}/upload?".http_build_query([
            'expires' => $query['expires'],
            'signature' => $query['signature'],
        ]);
    }

    /** Makes a booking through the API and uploads both documents through its link. */
    protected function bookingWithDocuments(array $overrides = []): Booking
    {
        $this->post('/api/bookings', $this->bookingPayload($overrides), ['Accept' => 'application/json'])->assertCreated();
        $booking = Booking::latest('id')->firstOrFail();
        $this->post($this->uploadPath($booking), $this->documentFiles(), ['Accept' => 'application/json'])->assertOk();

        return $booking->refresh();
    }
}
