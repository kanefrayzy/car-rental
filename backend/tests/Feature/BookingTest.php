<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Mail\BookingRequestConfirmation;
use App\Mail\BookingRequestReceived;
use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class BookingTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Mail::fake();
        config(['rental.owner_email' => 'owner@example.com', 'rental.deposit_usd' => 500]);
    }

    public function test_a_valid_request_is_saved_with_tax_and_the_terms_agreement(): void
    {
        config(['rental.tax_rate' => 8.625]);
        $car = $this->charger(['price_per_day' => 499]);

        $response = $this->post('/api/bookings', $this->bookingPayload(), ['Accept' => 'application/json']);

        $booking = Booking::sole();
        $response->assertCreated()->assertExactJson([
            'bookingId' => $booking->public_id,
            'status' => 'pending_deposit',
            'depositUsd' => 500,
            'link' => $booking->pageLink(),
        ]);

        $this->assertSame($car->id, $booking->car_id);
        $this->assertSame('2026-10-20', $booking->pickup_date->toDateString());
        $this->assertSame('2026-10-23', $booking->return_date->toDateString());
        $this->assertSame([3, 499, 1497, 500], [$booking->days, $booking->price_per_day, $booking->total_usd, $booking->deposit_usd]);
        $this->assertSame(BookingStatus::PendingDeposit, $booking->status);
        // Stored tidy: one format for phones, lower-case email.
        $this->assertSame('+16315550142', $booking->phone);
        $this->assertSame('jordan@example.com', $booking->email);

        // 8.625% of $1,497, rounded to the cent.
        $this->assertSame([8.625, 129.12, 1626.12], [$booking->tax_rate, $booking->tax_usd, $booking->totalWithTax()]);
        $this->assertNotNull($booking->terms_accepted_at);
        // The documents come later, through the upload link.
        $this->assertCount(0, $booking->documents);
        $this->assertFalse($booking->hasAllDocuments());
    }

    public function test_the_price_comes_from_the_database_not_from_the_request(): void
    {
        $this->charger(['price_per_day' => 499]);

        $this->post('/api/bookings', $this->bookingPayload(['pricePerDay' => 1, 'totalUsd' => 3, 'depositUsd' => 0]), ['Accept' => 'application/json'])
            ->assertCreated();

        $this->assertSame(1497, Booking::sole()->total_usd);
        $this->assertSame(500, Booking::sole()->deposit_usd);
    }

    public function test_the_owner_and_the_customer_are_emailed(): void
    {
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload(), ['Accept' => 'application/json'])->assertCreated();

        Mail::assertSent(BookingRequestReceived::class, fn ($mail) => $mail->hasTo('owner@example.com') && $mail->hasReplyTo('jordan@example.com'));
        Mail::assertSent(BookingRequestConfirmation::class, fn ($mail) => $mail->hasTo('jordan@example.com'));
    }

    public function test_without_an_owner_address_only_the_customer_is_emailed(): void
    {
        config(['rental.owner_email' => null]);
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload(), ['Accept' => 'application/json'])->assertCreated();

        Mail::assertNotSent(BookingRequestReceived::class);
        Mail::assertSent(BookingRequestConfirmation::class);
    }

    public function test_the_occasion_is_saved_and_shown_in_both_emails(): void
    {
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload(['occasion' => 'music-video']), ['Accept' => 'application/json'])
            ->assertCreated();

        $booking = Booking::sole();
        $this->assertSame(['music-video', 'Music video'], [$booking->occasion, $booking->occasionLabel()]);
        Mail::assertSent(BookingRequestReceived::class, fn ($mail) => str_contains($mail->render(), 'Occasion')
            && str_contains($mail->render(), 'Music video'));
        Mail::assertSent(BookingRequestConfirmation::class, fn ($mail) => str_contains($mail->render(), 'Music video'));
    }

    public function test_the_occasion_is_optional(): void
    {
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload(), ['Accept' => 'application/json'])->assertCreated();

        $this->assertNull(Booking::sole()->occasion);
        Mail::assertSent(BookingRequestReceived::class, fn ($mail) => ! str_contains($mail->render(), 'Occasion'));
    }

    public function test_taken_dates_are_refused_and_nothing_is_left_behind(): void
    {
        $car = $this->charger();
        Booking::factory()->for($car)->between('2026-10-22', '2026-10-25')->status(BookingStatus::Confirmed)->create();

        $this->post('/api/bookings', $this->bookingPayload(), ['Accept' => 'application/json'])
            ->assertConflict()
            ->assertJsonPath('message', 'Those dates are already booked. Try different dates.');

        $this->assertSame(1, Booking::count());
        $this->assertSame([], Storage::disk('local')->allFiles());
        Mail::assertNothingSent();
    }

    public function test_a_second_request_for_the_same_dates_is_refused(): void
    {
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload(), ['Accept' => 'application/json'])->assertCreated();
        $this->post('/api/bookings', $this->bookingPayload(['email' => 'other@example.com']), ['Accept' => 'application/json'])
            ->assertConflict();

        $this->assertSame(1, Booking::count());
    }

    #[DataProvider('invalidFields')]
    public function test_invalid_details_are_rejected(string $field, mixed $value, string $message): void
    {
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload([$field => $value]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath("errors.{$field}.0", $message);

        $this->assertSame(0, Booking::count());
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public static function invalidFields(): array
    {
        return [
            'one-word name' => ['name', 'Jordan', 'Enter your first and last name, as on your license.'],
            'short phone' => ['phone', '555-0142', 'Enter a 10-digit US phone number.'],
            'foreign phone' => ['phone', '+44 20 7946 0958', 'Enter a 10-digit US phone number.'],
            'bad email' => ['email', 'jordan@', 'Enter a valid email address.'],
            'past pick-up' => ['pickupDate', '2026-10-01', 'Pick-up can’t be in the past.'],
            'unknown occasion' => ['occasion', 'funeral', 'Choose an occasion from the list.'],
        ];
    }

    public function test_a_us_number_with_country_code_is_accepted(): void
    {
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload(['phone' => '+1 631-555-0142']), ['Accept' => 'application/json'])
            ->assertCreated();

        $this->assertSame('+16315550142', Booking::sole()->phone);
    }

    public function test_the_rental_terms_must_be_accepted(): void
    {
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload(['acceptTerms' => false]), ['Accept' => 'application/json'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.acceptTerms.0', 'Agree to the Rental Terms to send your request.');
        $this->assertSame(0, Booking::count());
    }

    public function test_booking_requests_are_rate_limited(): void
    {
        config(['rental.rate_limits.bookings_per_minute' => 2]);
        $this->charger();

        // Invalid requests count too: the limit is on attempts.
        $this->postJson('/api/bookings', [])->assertUnprocessable();
        $this->postJson('/api/bookings', [])->assertUnprocessable();
        $this->postJson('/api/bookings', [])->assertTooManyRequests();
    }
}
