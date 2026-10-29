<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Exceptions\BookingActionRefused;
use App\Mail\BookingCancelled;
use App\Mail\BookingConfirmed;
use App\Models\BlockedPeriod;
use App\Models\Booking;
use App\Services\BookingManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/** The owner's decisions on a booking (BookingManager), and closed dates on the website. */
class BookingManagementTest extends TestCase
{
    use RefreshDatabase;

    private function manager(): BookingManager
    {
        return app(BookingManager::class);
    }

    public function test_confirming_a_request_marks_it_and_emails_the_customer(): void
    {
        Mail::fake();
        config(['rental.owner_email' => 'owner@example.com']);
        $booking = Booking::factory()->for($this->charger())->between('2026-10-20', '2026-10-23')->create(['email' => 'jordan@example.com']);

        $this->manager()->confirm($booking);

        $booking->refresh();
        $this->assertSame(BookingStatus::Confirmed, $booking->status);
        $this->assertNotNull($booking->confirmed_at);
        Mail::assertSent(BookingConfirmed::class, fn (BookingConfirmed $mail) => $mail->hasTo('jordan@example.com') && $mail->hasReplyTo('owner@example.com'));
    }

    public function test_the_customer_email_can_be_skipped(): void
    {
        Mail::fake();
        $booking = Booking::factory()->for($this->charger())->create();

        $this->manager()->confirm($booking, notifyCustomer: false);

        Mail::assertNothingSent();
    }

    public function test_a_request_cannot_be_confirmed_over_another_booking(): void
    {
        $car = $this->charger();
        Booking::factory()->for($car)->between('2026-10-22', '2026-10-25')->status(BookingStatus::Confirmed)->create(['name' => 'Alex Kim']);
        $booking = Booking::factory()->for($car)->between('2026-10-20', '2026-10-23')->create();

        try {
            $this->manager()->confirm($booking);
            $this->fail('The overlapping booking was confirmed.');
        } catch (BookingActionRefused $refused) {
            $this->assertStringContainsString('Alex Kim', $refused->getMessage());
        }

        $this->assertSame(BookingStatus::PendingDeposit, $booking->refresh()->status);
    }

    public function test_a_request_cannot_be_confirmed_over_closed_dates(): void
    {
        $car = $this->charger();
        BlockedPeriod::factory()->for($car)->create(['starts_on' => '2026-10-23', 'ends_on' => '2026-10-24', 'note' => 'Service']);
        $booking = Booking::factory()->for($car)->between('2026-10-20', '2026-10-23')->create();

        $this->expectException(BookingActionRefused::class);
        $this->expectExceptionMessage('Service');

        $this->manager()->confirm($booking);
    }

    public function test_a_request_whose_hold_ran_out_can_still_be_confirmed_if_the_dates_are_free(): void
    {
        config(['rental.hold_hours' => 24]);
        $booking = Booking::factory()->for($this->charger())->create();
        $this->travel(2)->days();

        $this->assertTrue($booking->refresh()->holdExpired());
        $this->manager()->confirm($booking, notifyCustomer: false);

        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);
    }

    public function test_cancelled_and_confirmed_bookings_cannot_be_confirmed_again(): void
    {
        $car = $this->charger();
        $confirmed = Booking::factory()->for($car)->status(BookingStatus::Confirmed)->create();
        $cancelled = Booking::factory()->for($car)->status(BookingStatus::Cancelled)->create();

        foreach ([$confirmed, $cancelled] as $booking) {
            try {
                $this->manager()->confirm($booking);
                $this->fail("A {$booking->status->value} booking was confirmed again.");
            } catch (BookingActionRefused) {
                $this->addToAssertionCount(1);
            }
        }
    }

    public function test_cancelling_frees_the_dates_and_passes_the_owners_message_on(): void
    {
        Mail::fake();
        $car = $this->charger();
        $booking = Booking::factory()->for($car)->between('2026-10-20', '2026-10-23')->status(BookingStatus::Confirmed)->create();

        $this->manager()->cancel($booking, '  The car needs a repair that week.  ');

        $this->assertSame(BookingStatus::Cancelled, $booking->refresh()->status);
        $this->assertNotNull($booking->cancelled_at);
        $this->postJson('/api/availability', ['carSlug' => $car->slug, 'pickupDate' => '2026-10-20', 'returnDate' => '2026-10-23', 'pickupTime' => '10:00', 'returnTime' => '10:00'])
            ->assertJsonPath('available', true);
        Mail::assertSent(BookingCancelled::class, function (BookingCancelled $mail) {
            $mail->assertSeeInHtml('The car needs a repair that week.');

            return $mail->ownerMessage === 'The car needs a repair that week.';
        });
    }

    public function test_marking_the_deposit_paid_keeps_the_dates_held(): void
    {
        config(['rental.hold_hours' => 24]);
        $car = $this->charger();
        $booking = Booking::factory()->for($car)->between('2026-10-20', '2026-10-23')->create();

        $this->manager()->markDepositPaid($booking);
        $this->travel(3)->days();

        $this->assertSame(BookingStatus::DepositPaid, $booking->refresh()->status);
        $this->assertNotNull($booking->deposit_paid_at);
        $this->postJson('/api/availability', ['carSlug' => $car->slug, 'pickupDate' => '2026-10-21', 'returnDate' => '2026-10-22', 'pickupTime' => '10:00', 'returnTime' => '10:00'])
            ->assertJsonPath('available', false);
    }

    public function test_marking_the_deposit_paid_on_a_confirmed_booking_keeps_it_confirmed(): void
    {
        $booking = Booking::factory()->for($this->charger())->status(BookingStatus::Confirmed)->create();

        $this->manager()->markDepositPaid($booking);

        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);
        $this->assertNotNull($booking->deposit_paid_at);
        $this->expectException(BookingActionRefused::class);
        $this->manager()->markDepositPaid($booking);
    }

    public function test_closed_dates_are_not_available_on_the_website(): void
    {
        $car = $this->charger();
        BlockedPeriod::factory()->for($car)->create(['starts_on' => '2026-10-23', 'ends_on' => '2026-10-23']);

        $this->postJson('/api/availability', ['carSlug' => $car->slug, 'pickupDate' => '2026-10-20', 'returnDate' => '2026-10-23', 'pickupTime' => '10:00', 'returnTime' => '10:00'])
            ->assertJsonPath('available', false);
        $this->postJson('/api/availability', ['carSlug' => $car->slug, 'pickupDate' => '2026-10-24', 'returnDate' => '2026-10-26', 'pickupTime' => '10:00', 'returnTime' => '10:00'])
            ->assertJsonPath('available', true);
        $this->post('/api/bookings', $this->bookingPayload(), ['Accept' => 'application/json'])
            ->assertConflict();
    }
}
