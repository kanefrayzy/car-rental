<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Filament\Resources\Bookings\Tables\BookingsTable;
use App\Mail\BookingRequestConfirmation;
use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class AvailabilityTest extends TestCase
{
    use RefreshDatabase;

    private function check(array $overrides = [])
    {
        return $this->postJson('/api/availability', [
            'carSlug' => 'dodge-charger-widebody',
            'pickupDate' => '2026-10-20',
            'pickupTime' => '10:00',
            'returnDate' => '2026-10-23',
            'returnTime' => '10:00',
            ...$overrides,
        ]);
    }

    public function test_free_dates_are_available_and_priced_from_the_database(): void
    {
        $this->charger(['price_per_day' => 450]);

        $this->check()->assertOk()->assertExactJson([
            'available' => true,
            'days' => 3,
            'pricePerDay' => 450,
            'totalUsd' => 1350,
            'taxRate' => 8.625,
            'taxUsd' => 116.44,
            'totalWithTaxUsd' => 1466.44,
        ]);
    }

    public function test_a_confirmed_booking_blocks_overlapping_dates(): void
    {
        $car = $this->charger();
        Booking::factory()->for($car)->between('2026-10-22', '2026-10-25')->status(BookingStatus::Confirmed)->create();

        $this->check()->assertOk()->assertJsonPath('available', false);
    }

    public function test_the_return_day_of_one_booking_cannot_be_the_pickup_day_of_the_next(): void
    {
        $car = $this->charger();
        Booking::factory()->for($car)->between('2026-10-17', '2026-10-20')->status(BookingStatus::Confirmed)->create();

        $this->check(['pickupDate' => '2026-10-20'])->assertJsonPath('available', false);
        $this->check(['pickupDate' => '2026-10-21'])->assertJsonPath('available', true);
    }

    public function test_an_unpaid_request_holds_the_dates_only_for_the_hold_period(): void
    {
        config(['rental.hold_hours' => 24]);
        $car = $this->charger();
        Booking::factory()->for($car)->between('2026-10-20', '2026-10-23')->create();

        $this->check()->assertJsonPath('available', false);

        $this->travel(25)->hours();

        $this->check()->assertJsonPath('available', true);
    }

    public function test_a_paid_deposit_keeps_the_dates_after_the_hold_period(): void
    {
        $car = $this->charger();
        Booking::factory()->for($car)->between('2026-10-20', '2026-10-23')->status(BookingStatus::DepositPaid)->create();

        $this->travel(3)->days();

        $this->check()->assertJsonPath('available', false);
    }

    public function test_cancelled_bookings_and_other_cars_do_not_block(): void
    {
        $car = $this->charger();
        Booking::factory()->for($car)->between('2026-10-20', '2026-10-23')->status(BookingStatus::Cancelled)->create();
        Booking::factory()->between('2026-10-20', '2026-10-23')->status(BookingStatus::Confirmed)->create();

        $this->check()->assertJsonPath('available', true);
    }

    #[DataProvider('invalidPeriods')]
    public function test_invalid_requests_are_rejected(array $overrides, string $field, string $message): void
    {
        $this->charger();

        $this->check($overrides)
            ->assertUnprocessable()
            ->assertJsonPath("errors.{$field}.0", $message);
    }

    public static function invalidPeriods(): array
    {
        return [
            'pick-up in the past' => [['pickupDate' => '2026-10-12'], 'pickupDate', 'Pick-up can’t be in the past.'],
            'return before pick-up' => [['returnDate' => '2026-10-19'], 'returnDate', 'Return must be after pick-up.'],
            'return at the pick-up time' => [['returnDate' => '2026-10-20'], 'returnTime', 'Return must be after pick-up.'],
            'return earlier the same day' => [['returnDate' => '2026-10-20', 'returnTime' => '09:30'], 'returnTime', 'Return must be after pick-up.'],
            'time outside business hours' => [['pickupTime' => '06:30'], 'pickupTime', 'Choose a pick-up time from 7:00 AM to 11:00 PM.'],
            'time off the half hour' => [['returnTime' => '10:15'], 'returnTime', 'Choose a return time from 7:00 AM to 11:00 PM.'],
            'missing time' => [['pickupTime' => ''], 'pickupTime', 'Choose a pick-up time.'],
            'not a date' => [['pickupDate' => '20/10/2026'], 'pickupDate', 'Choose a pick-up date.'],
            'missing return' => [['returnDate' => ''], 'returnDate', 'Choose a return date.'],
            'too long' => [['returnDate' => '2026-12-20'], 'returnDate', 'The longest rental is 30 days. Call us for a longer one.'],
            'too far ahead' => [['pickupDate' => '2028-01-10', 'returnDate' => '2028-01-12'], 'pickupDate', 'That pick-up date is too far ahead.'],
            'unknown car' => [['carSlug' => 'no-such-car'], 'carSlug', 'We couldn’t find that car.'],
        ];
    }

    public function test_today_is_the_business_day_not_the_server_day(): void
    {
        $this->charger();
        // 02:30 UTC on the 14th is still 22:30 on the 13th in New York.
        $this->travelTo('2026-10-14 02:30:00');

        $this->check(['pickupDate' => '2026-10-13', 'pickupTime' => '23:00', 'returnDate' => '2026-10-15'])->assertOk();
        $this->check(['pickupDate' => '2026-10-13', 'pickupTime' => '22:30', 'returnDate' => '2026-10-15'])
            ->assertJsonPath('errors.pickupTime.0', 'That pick-up time has passed. Choose a later one.');
    }

    /** Charged per started 24 hours from the pick-up time. */
    #[DataProvider('billedPeriods')]
    public function test_days_are_counted_from_the_pick_up_time(array $period, int $days): void
    {
        $this->charger(['price_per_day' => 499]);

        $this->check($period)->assertOk()->assertJsonPath('days', $days)->assertJsonPath('totalUsd', $days * 499);
    }

    public static function billedPeriods(): array
    {
        return [
            'exactly three days' => [['pickupTime' => '10:00', 'returnTime' => '10:00'], 3],
            'half an hour over' => [['pickupTime' => '10:00', 'returnTime' => '10:30'], 4],
            'back earlier in the day' => [['pickupTime' => '18:00', 'returnTime' => '09:00'], 3],
            'same day' => [['returnDate' => '2026-10-20', 'pickupTime' => '09:00', 'returnTime' => '21:00'], 1],
            'overnight' => [['returnDate' => '2026-10-21', 'pickupTime' => '20:00', 'returnTime' => '08:00'], 1],
            // Clocks go back on Nov 1, 2026: still one day on the wall clock.
            'across daylight saving' => [['pickupDate' => '2026-10-31', 'returnDate' => '2026-11-01'], 1],
        ];
    }

    public function test_a_booking_keeps_its_times_and_shows_them_to_the_customer(): void
    {
        $this->charger();

        $this->post('/api/bookings', $this->bookingPayload(['pickupTime' => '07:30', 'returnTime' => '23:00']), ['Accept' => 'application/json'])
            ->assertCreated();

        $booking = Booking::sole();
        $this->assertSame(['07:30', '23:00', 4], [$booking->pickup_time, $booking->return_time, $booking->days]);
        $this->assertSame('Tue, Oct 20, 2026 at 7:30 AM', $booking->pickupLabel());
        $this->assertSame('Fri, Oct 23, 2026 at 11:00 PM', $booking->returnLabel());

        // In the customer's email, on their booking page and in the admin panel.
        $html = (new BookingRequestConfirmation($booking->load('car')))->render();
        $this->assertStringContainsString('Tue, Oct 20, 2026 at 7:30 AM', $html);
        $this->assertStringContainsString('Fri, Oct 23, 2026 at 11:00 PM', $html);
        $this->getJson($this->uploadPath($booking))->assertJson(['pickupTime' => '07:30', 'returnTime' => '23:00']);
        $this->assertSame('Oct 20, 7:30 AM – Oct 23, 2026, 11:00 PM', BookingsTable::dates($booking));
    }

    public function test_an_inactive_car_cannot_be_checked(): void
    {
        $this->charger(['is_active' => false]);

        $this->check()->assertUnprocessable()->assertJsonValidationErrorFor('carSlug');
    }
}
