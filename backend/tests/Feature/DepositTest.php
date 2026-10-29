<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Exceptions\BookingActionRefused;
use App\Filament\Resources\Bookings\Pages\ViewBooking;
use App\Mail\BookingCancelled;
use App\Mail\DepositRefunded;
use App\Models\Booking;
use App\Models\User;
use App\Services\BookingManager;
use App\Services\Deposits\DepositGateway;
use App\Services\Deposits\DepositIntent;
use App\Services\Deposits\StripeDepositGateway;
use App\Services\Deposits\UnconfiguredDepositGateway;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;
use Tests\TestCase;

class DepositTest extends TestCase
{
    use RefreshDatabase;

    private const WEBHOOK_SECRET = 'whsec_test_secret';

    /** A gateway that hands out a fixed intent and counts how often it is asked. */
    private function fakeGateway(): object
    {
        $gateway = new class implements DepositGateway
        {
            public int $calls = 0;

            /** @var array<int, array{booking: string, cents: int}> */
            public array $refunds = [];

            public function createIntent(Booking $booking): DepositIntent
            {
                $this->calls++;

                return new DepositIntent('pi_test_123', 'pi_test_123_secret_abc');
            }

            public function refund(Booking $booking, int $amountCents): string
            {
                $this->refunds[] = ['booking' => $booking->public_id, 'cents' => $amountCents];

                return 're_test_1';
            }

            public function createRentalIntent(Booking $booking): DepositIntent
            {
                $this->calls++;

                return new DepositIntent('pi_rental_123', 'pi_rental_123_secret_abc');
            }

            public function refundRental(Booking $booking, int $amountCents): string
            {
                $this->refunds[] = ['booking' => $booking->public_id, 'cents' => $amountCents, 'rental' => true];

                return 're_test_2';
            }

            /** @var array<int, string> */
            public array $cancelled = [];

            /** Intents the customer has "already paid". */
            public array $paid = [];

            public function cancelIntent(string $intentId): bool
            {
                if (in_array($intentId, $this->paid, true)) {
                    return false;
                }
                $this->cancelled[] = $intentId;

                return true;
            }
        };
        $this->app->instance(DepositGateway::class, $gateway);

        return $gateway;
    }

    private function stripeEvent(string $type, string $intentId, ?string $secret = self::WEBHOOK_SECRET, ?array $object = null)
    {
        $payload = json_encode([
            'id' => 'evt_test_1',
            'object' => 'event',
            'type' => $type,
            'data' => ['object' => $object ?? ['id' => $intentId, 'object' => 'payment_intent']],
        ]);
        $timestamp = time();
        $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", (string) $secret);

        return $this->call('POST', '/api/stripe/webhook', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_STRIPE_SIGNATURE' => "t={$timestamp},v1={$signature}",
        ], content: $payload);
    }

    public function test_payments_are_off_until_stripe_is_configured(): void
    {
        config(['services.stripe.secret' => null]);
        $booking = Booking::factory()->create(['deposit_usd' => 500]);

        $this->assertInstanceOf(UnconfiguredDepositGateway::class, app(DepositGateway::class));
        $this->postJson("/api/bookings/{$booking->public_id}/deposit")->assertOk()->assertExactJson([
            'bookingId' => $booking->public_id,
            'amountUsd' => 500,
            'clientSecret' => null,
        ]);
        $this->assertNull($booking->refresh()->stripe_payment_intent_id);
    }

    public function test_a_stripe_key_switches_the_stripe_gateway_on(): void
    {
        config(['services.stripe.secret' => 'sk_test_not_a_real_key']);

        $this->assertInstanceOf(StripeDepositGateway::class, app(DepositGateway::class));
    }

    public function test_the_payment_intent_is_remembered_on_the_booking(): void
    {
        $this->fakeGateway();
        $booking = Booking::factory()->create(['deposit_usd' => 500]);

        $this->postJson("/api/bookings/{$booking->public_id}/deposit")
            ->assertOk()
            ->assertJsonPath('clientSecret', 'pi_test_123_secret_abc')
            ->assertJsonPath('amountUsd', 500);

        $this->assertSame('pi_test_123', $booking->refresh()->stripe_payment_intent_id);
    }

    public function test_a_booking_that_is_not_waiting_for_a_deposit_cannot_start_one(): void
    {
        $gateway = $this->fakeGateway();
        $booking = Booking::factory()->status(BookingStatus::DepositPaid)->create();

        $this->postJson("/api/bookings/{$booking->public_id}/deposit")->assertConflict();
        $this->assertSame(0, $gateway->calls);
    }

    public function test_bookings_are_addressed_by_reference_never_by_numeric_id(): void
    {
        $this->fakeGateway();
        $booking = Booking::factory()->create();

        $this->postJson("/api/bookings/{$booking->id}/deposit")->assertNotFound();
        $this->postJson('/api/bookings/01ARZ3NDEKTSV4RRFFQ69G5FAV/deposit')->assertNotFound();
    }

    public function test_a_signed_stripe_event_marks_the_deposit_paid(): void
    {
        config(['services.stripe.webhook_secret' => self::WEBHOOK_SECRET]);
        $booking = Booking::factory()->create(['stripe_payment_intent_id' => 'pi_test_123']);
        $other = Booking::factory()->create(['stripe_payment_intent_id' => 'pi_other']);

        $this->stripeEvent('payment_intent.succeeded', 'pi_test_123')->assertOk()->assertExactJson(['received' => true]);

        $booking->refresh();
        $this->assertSame(BookingStatus::DepositPaid, $booking->status);
        $this->assertNotNull($booking->deposit_paid_at);
        $this->assertSame(BookingStatus::PendingDeposit, $other->refresh()->status);
    }

    public function test_a_card_hold_also_counts_as_a_paid_deposit(): void
    {
        config(['services.stripe.webhook_secret' => self::WEBHOOK_SECRET]);
        $booking = Booking::factory()->create(['stripe_payment_intent_id' => 'pi_test_123']);

        $this->stripeEvent('payment_intent.amount_capturable_updated', 'pi_test_123')->assertOk();

        $this->assertSame(BookingStatus::DepositPaid, $booking->refresh()->status);
    }

    public function test_other_stripe_events_are_acknowledged_and_ignored(): void
    {
        config(['services.stripe.webhook_secret' => self::WEBHOOK_SECRET]);
        $booking = Booking::factory()->create(['stripe_payment_intent_id' => 'pi_test_123']);

        $this->stripeEvent('payment_intent.payment_failed', 'pi_test_123')->assertOk();

        $this->assertSame(BookingStatus::PendingDeposit, $booking->refresh()->status);
    }

    public function test_a_cancelled_booking_is_not_revived_by_a_late_payment_event(): void
    {
        config(['services.stripe.webhook_secret' => self::WEBHOOK_SECRET]);
        $booking = Booking::factory()->status(BookingStatus::Cancelled)->create(['stripe_payment_intent_id' => 'pi_test_123']);

        $this->stripeEvent('payment_intent.succeeded', 'pi_test_123')->assertOk();

        $this->assertSame(BookingStatus::Cancelled, $booking->refresh()->status);
    }

    public function test_an_event_with_a_wrong_signature_is_refused(): void
    {
        config(['services.stripe.webhook_secret' => self::WEBHOOK_SECRET]);
        $booking = Booking::factory()->create(['stripe_payment_intent_id' => 'pi_test_123']);

        $this->stripeEvent('payment_intent.succeeded', 'pi_test_123', secret: 'whsec_someone_else')->assertBadRequest();

        $this->assertSame(BookingStatus::PendingDeposit, $booking->refresh()->status);
    }

    public function test_the_webhook_is_closed_until_its_secret_is_configured(): void
    {
        config(['services.stripe.webhook_secret' => null]);

        $this->stripeEvent('payment_intent.succeeded', 'pi_test_123')->assertServiceUnavailable();
    }

    /** A booking whose deposit was paid by card through the website. */
    private function paidByCard(array $attributes = []): Booking
    {
        return Booking::factory()->create([
            'status' => BookingStatus::DepositPaid,
            'deposit_usd' => 1000,
            'stripe_payment_intent_id' => 'pi_test_123',
            'deposit_paid_at' => now(),
            ...$attributes,
        ]);
    }

    public function test_the_owner_refunds_the_deposit_less_fees_once(): void
    {
        Mail::fake();
        $gateway = $this->fakeGateway();
        $booking = $this->paidByCard();

        app(BookingManager::class)->refundDeposit($booking, 950, '$50 kept: returned an hour late.');

        $this->assertSame([['booking' => $booking->public_id, 'cents' => 95000]], $gateway->refunds);
        $booking->refresh();
        $this->assertSame(950.0, $booking->deposit_refunded_usd);
        $this->assertNotNull($booking->deposit_refunded_at);
        Mail::assertSent(DepositRefunded::class, fn ($mail) => $mail->hasTo($booking->email));

        $this->expectException(BookingActionRefused::class);
        app(BookingManager::class)->refundDeposit($booking, 50);
    }

    public function test_a_refund_cannot_exceed_the_deposit_or_cover_a_deposit_paid_in_person(): void
    {
        $this->fakeGateway();

        try {
            app(BookingManager::class)->refundDeposit($this->paidByCard(), 1000.01);
            $this->fail('A refund over the deposit was accepted.');
        } catch (BookingActionRefused) {
        }

        $this->expectException(BookingActionRefused::class);
        app(BookingManager::class)->refundDeposit($this->paidByCard(['stripe_payment_intent_id' => null]), 100);
    }

    public function test_declining_a_paid_request_refunds_the_whole_deposit(): void
    {
        Mail::fake();
        $gateway = $this->fakeGateway();
        $booking = $this->paidByCard();

        app(BookingManager::class)->cancel($booking, 'Sorry, the car is in the shop.');

        $this->assertSame(100000, $gateway->refunds[0]['cents']);
        $this->assertSame(BookingStatus::Cancelled, $booking->refresh()->status);
        $this->assertSame(1000.0, $booking->deposit_refunded_usd);
    }

    public function test_a_late_cancellation_keeps_its_fee_from_the_deposit_and_refunds_the_rest(): void
    {
        Mail::fake();
        $gateway = $this->fakeGateway();
        $booking = $this->paidByCard();

        app(BookingManager::class)->cancel($booking, depositRefundUsd: 457.5);

        $this->assertSame([['booking' => $booking->public_id, 'cents' => 45750]], $gateway->refunds);
        $booking->refresh();
        $this->assertSame(BookingStatus::Cancelled, $booking->status);
        $this->assertSame(457.5, $booking->deposit_refunded_usd);
        Mail::assertSent(BookingCancelled::class, fn (BookingCancelled $mail) => (bool) $mail->assertSeeInText('We refunded $457.50 of your $1,000 deposit'));
        Mail::assertNotSent(DepositRefunded::class);
    }

    public function test_a_cancellation_can_keep_the_whole_deposit(): void
    {
        Mail::fake();
        $gateway = $this->fakeGateway();
        $booking = $this->paidByCard();

        app(BookingManager::class)->cancel($booking, depositRefundUsd: 0);

        $this->assertSame([], $gateway->refunds);
        $this->assertNull($booking->refresh()->deposit_refunded_at);
        $this->assertSame(BookingStatus::Cancelled, $booking->status);
        Mail::assertSent(BookingCancelled::class, fn (BookingCancelled $mail) => (bool) $mail->assertSeeInText('Your $1,000 deposit was kept under our Rental Terms.'));
    }

    public function test_a_full_refund_on_cancellation_reads_as_before(): void
    {
        Mail::fake();
        $this->fakeGateway();
        $booking = $this->paidByCard();

        app(BookingManager::class)->cancel($booking);

        Mail::assertSent(BookingCancelled::class, fn (BookingCancelled $mail) => (bool) $mail
            ->assertSeeInText('Your $1,000.00 deposit has been refunded to your card.')
            ->assertDontSeeInText('We refunded'));
    }

    public function test_a_cancellation_refund_over_the_deposit_changes_nothing(): void
    {
        $gateway = $this->fakeGateway();
        $booking = $this->paidByCard();

        try {
            app(BookingManager::class)->cancel($booking, notifyCustomer: false, depositRefundUsd: 1000.01);
            $this->fail('A refund over the deposit was accepted.');
        } catch (BookingActionRefused) {
        }

        $this->assertSame([], $gateway->refunds);
        $this->assertSame(BookingStatus::DepositPaid, $booking->refresh()->status);
    }

    public function test_the_owner_sets_the_refund_when_cancelling_in_the_admin_panel(): void
    {
        Mail::fake();
        $gateway = $this->fakeGateway();
        $booking = $this->paidByCard();
        Filament::setCurrentPanel('admin');
        $this->actingAs(User::factory()->create());

        // The full deposit is offered first.
        Livewire::test(ViewBooking::class, ['record' => $booking->getRouteKey()])
            ->mountAction('cancel')
            ->assertActionDataSet(['refundAmount' => 1000]);

        Livewire::test(ViewBooking::class, ['record' => $booking->getRouteKey()])
            ->callAction('cancel', ['refundAmount' => 600, 'notify' => false])
            ->assertHasNoActionErrors();

        $this->assertSame([['booking' => $booking->public_id, 'cents' => 60000]], $gateway->refunds);
        $this->assertSame(BookingStatus::Cancelled, $booking->refresh()->status);
        $this->assertSame(600.0, $booking->deposit_refunded_usd);
    }

    public function test_a_payment_that_arrives_after_a_cancellation_is_refunded_automatically(): void
    {
        Mail::fake();
        config(['services.stripe.webhook_secret' => self::WEBHOOK_SECRET]);
        $gateway = $this->fakeGateway();
        $booking = Booking::factory()->create(['stripe_payment_intent_id' => 'pi_test_123', 'status' => BookingStatus::Cancelled, 'deposit_usd' => 1000]);

        $this->stripeEvent('payment_intent.succeeded', 'pi_test_123')->assertOk();

        $this->assertSame(BookingStatus::Cancelled, $booking->refresh()->status);
        $this->assertSame(100000, $gateway->refunds[0]['cents']);
        $this->assertNotNull($booking->deposit_refunded_at);
    }

    public function test_a_refund_made_in_the_stripe_dashboard_is_recorded(): void
    {
        config(['services.stripe.webhook_secret' => self::WEBHOOK_SECRET]);
        $booking = $this->paidByCard();

        $this->stripeEvent('charge.refunded', 'ch_test_1', object: [
            'id' => 'ch_test_1',
            'object' => 'charge',
            'payment_intent' => 'pi_test_123',
            'amount_refunded' => 80000,
        ])->assertOk();

        $this->assertSame(800.0, $booking->refresh()->deposit_refunded_usd);
    }

    public function test_no_payment_for_dates_lost_after_the_hold_ran_out(): void
    {
        $this->fakeGateway();
        $car = $this->charger();
        $stale = Booking::factory()->for($car)->create([
            'pickup_date' => '2026-10-20',
            'return_date' => '2026-10-23',
            'created_at' => now()->subHours(config('rental.hold_hours') + 1),
        ]);
        Booking::factory()->for($car)->create([
            'pickup_date' => '2026-10-21',
            'return_date' => '2026-10-22',
            'status' => BookingStatus::Confirmed,
        ]);

        $this->postJson("/api/bookings/{$stale->public_id}/deposit")->assertConflict();
    }

    /** A confirmed booking: 3 days at $499 plus 8.625% tax = $1,626.12. */
    private function confirmedBooking(array $attributes = []): Booking
    {
        return Booking::factory()->create([
            'status' => BookingStatus::Confirmed,
            'days' => 3,
            'price_per_day' => 499,
            'total_usd' => 1497,
            'tax_rate' => 8.625,
            'tax_usd' => 129.12,
            ...$attributes,
        ]);
    }

    public function test_a_confirmed_booking_takes_the_rental_payment(): void
    {
        $this->fakeGateway();
        $booking = $this->confirmedBooking();

        $this->postJson("/api/bookings/{$booking->public_id}/rental-payment")
            ->assertOk()
            ->assertExactJson(['bookingId' => $booking->public_id, 'amountUsd' => 1626.12, 'clientSecret' => 'pi_rental_123_secret_abc']);
        $this->assertSame('pi_rental_123', $booking->refresh()->rental_payment_intent_id);
    }

    public function test_the_rental_is_not_taken_before_confirmation_or_twice(): void
    {
        $this->fakeGateway();

        $this->postJson('/api/bookings/'.Booking::factory()->create()->public_id.'/rental-payment')->assertConflict();
        $this->postJson('/api/bookings/'.$this->confirmedBooking(['rental_paid_at' => now()])->public_id.'/rental-payment')->assertConflict();
    }

    public function test_stripe_marks_the_rental_paid_and_not_the_deposit(): void
    {
        config(['services.stripe.webhook_secret' => self::WEBHOOK_SECRET]);
        $booking = $this->confirmedBooking(['rental_payment_intent_id' => 'pi_rental_123', 'stripe_payment_intent_id' => 'pi_test_123']);

        $this->stripeEvent('payment_intent.succeeded', 'pi_rental_123')->assertOk();

        $booking->refresh();
        $this->assertNotNull($booking->rental_paid_at);
        $this->assertNull($booking->deposit_paid_at);
        $this->assertSame(BookingStatus::Confirmed, $booking->status);
    }

    public function test_cancelling_a_paid_booking_refunds_the_rental_and_the_deposit(): void
    {
        Mail::fake();
        $gateway = $this->fakeGateway();
        $booking = $this->confirmedBooking([
            'deposit_usd' => 1000,
            'stripe_payment_intent_id' => 'pi_test_123',
            'deposit_paid_at' => now(),
            'rental_payment_intent_id' => 'pi_rental_123',
            'rental_paid_at' => now(),
        ]);

        app(BookingManager::class)->cancel($booking);

        $this->assertEqualsCanonicalizing([100000, 162612], array_column($gateway->refunds, 'cents'));
        $booking->refresh();
        $this->assertSame(1626.12, $booking->rental_refunded_usd);
        $this->assertSame(1000.0, $booking->deposit_refunded_usd);
    }

    public function test_the_owner_can_record_a_rental_paid_in_person(): void
    {
        $booking = $this->confirmedBooking();

        app(BookingManager::class)->markRentalPaid($booking);

        $this->assertNotNull($booking->refresh()->rental_paid_at);
        $this->assertFalse($booking->rentalDue());
    }

    public function test_a_deposit_taken_in_cash_closes_the_started_card_payment_and_is_not_refundable_by_card(): void
    {
        Mail::fake();
        $gateway = $this->fakeGateway();
        // The customer opened the booking page (a card payment was started), then paid cash.
        $booking = $this->confirmedBooking(['stripe_payment_intent_id' => 'pi_test_123', 'deposit_paid_at' => null]);

        app(BookingManager::class)->markDepositPaid($booking);

        $booking->refresh();
        $this->assertSame(['pi_test_123'], $gateway->cancelled);
        $this->assertNotNull($booking->deposit_paid_at);
        $this->assertNull($booking->stripe_payment_intent_id);
        $this->assertFalse($booking->depositRefundable());

        // Cancelling refunds nothing by card.
        app(BookingManager::class)->cancel($booking);
        $this->assertSame([], $gateway->refunds);
        $this->assertNull($booking->refresh()->deposit_refunded_at);
    }

    public function test_a_rental_taken_in_cash_closes_the_started_card_payment(): void
    {
        $gateway = $this->fakeGateway();
        $booking = $this->confirmedBooking(['rental_payment_intent_id' => 'pi_rental_123']);

        app(BookingManager::class)->markRentalPaid($booking);

        $booking->refresh();
        $this->assertSame(['pi_rental_123'], $gateway->cancelled);
        $this->assertNull($booking->rental_payment_intent_id);
        $this->assertFalse($booking->rentalRefundable());
    }

    public function test_cash_is_refused_when_the_customer_has_just_paid_by_card(): void
    {
        $gateway = $this->fakeGateway();
        $gateway->paid = ['pi_test_123'];
        $booking = $this->confirmedBooking(['stripe_payment_intent_id' => 'pi_test_123', 'deposit_paid_at' => null]);

        try {
            app(BookingManager::class)->markDepositPaid($booking);
            $this->fail('Expected a refusal.');
        } catch (BookingActionRefused $refused) {
            $this->assertStringContainsString('already paid the deposit by card', $refused->getMessage());
        }

        $booking->refresh();
        $this->assertNull($booking->deposit_paid_at);
        $this->assertSame('pi_test_123', $booking->stripe_payment_intent_id);
    }
}
