<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\HoldStatus;
use App\Exceptions\BookingActionRefused;
use App\Filament\Resources\Bookings\Pages\ViewBooking;
use App\Mail\BookingCancelled;
use App\Mail\DepositHoldFailed;
use App\Mail\DepositHoldFailedOwner;
use App\Mail\DepositHoldReleased;
use App\Mail\DepositHoldReminder;
use App\Mail\ExtraCharge;
use App\Models\Booking;
use App\Models\BookingCharge;
use App\Models\User;
use App\Services\AvailabilityService;
use App\Services\DepositHolds;
use App\Services\Deposits\CardSetup;
use App\Services\Deposits\HoldGateway;
use App\Services\Deposits\HoldResult;
use App\Services\Deposits\SavedCard;
use Carbon\CarbonImmutable;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Livewire\Livewire;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The deposit as a card hold (owner, 2026-11-10), against a fake Stripe. The scheduler is run
 * by hand (`bookings:deposit-holds`) with the clock moved. StripeHoldIntegrationTest runs the
 * same steps against Stripe's test mode.
 */
class DepositHoldTest extends TestCase
{
    use RefreshDatabase;

    private const WEBHOOK_SECRET = 'whsec_test_secret';

    private object $gateway;

    protected function setUp(): void
    {
        parent::setUp();

        Mail::fake();
        config([
            'rental.owner_email' => 'owner@example.com',
            'rental.deposit.mode' => 'hold',
            'services.stripe.webhook_secret' => self::WEBHOOK_SECRET,
        ]);
        // Wednesday noon in New York.
        $this->travelTo(CarbonImmutable::parse('2026-11-11 12:00', 'America/New_York'));
        $this->gateway = $this->fakeGateway();
    }

    /** A Stripe stand-in: hands out ids, records every call, and fails a hold when told to. */
    private function fakeGateway(): object
    {
        $gateway = new class implements HoldGateway
        {
            public bool $cardReady = true;

            /** @var list<HoldResult> what the next placeHold calls return; empty = success */
            public array $nextHolds = [];

            public array $holds = [];

            public array $released = [];

            public array $captured = [];

            public array $charges = [];

            public array $states = [];

            public ?string $chargeFailure = null;

            public function enabled(): bool
            {
                return true;
            }

            public function startCardSetup(Booking $booking): CardSetup
            {
                return new CardSetup('cus_1', 'seti_1', 'seti_1_secret_abc');
            }

            public function savedCard(string $setupIntentId): ?SavedCard
            {
                return $this->cardReady ? new SavedCard('pm_visa', 'Visa •••• 4242') : null;
            }

            public function placeHold(Booking $booking, int $cents, string $key): HoldResult
            {
                $this->holds[] = ['booking' => $booking->public_id, 'cents' => $cents, 'key' => $key];

                return array_shift($this->nextHolds)
                    ?? new HoldResult('held', 'pi_hold_'.count($this->holds), CarbonImmutable::now()->addDays(7));
            }

            public function holdState(string $intentId): HoldResult
            {
                return $this->states[$intentId] ?? new HoldResult('held', $intentId, CarbonImmutable::now()->addDays(7));
            }

            public function resumeHold(string $intentId): ?string
            {
                return "{$intentId}_secret";
            }

            public function releaseHold(string $intentId): void
            {
                $this->released[] = $intentId;
            }

            public function captureHold(string $intentId, int $cents): void
            {
                $this->captured[] = ['intent' => $intentId, 'cents' => $cents];
            }

            public function chargeSavedCard(Booking $booking, int $cents, string $description, string $key): HoldResult
            {
                $this->charges[] = ['cents' => $cents, 'description' => $description, 'key' => $key];

                return $this->chargeFailure
                    ? new HoldResult('failed', 'pi_charge_x', failureCode: $this->chargeFailure)
                    : new HoldResult('succeeded', 'pi_charge_'.count($this->charges));
            }
        };
        $this->app->instance(HoldGateway::class, $gateway);

        return $gateway;
    }

    /** A request in hold mode, picked up `$pickup` (New York time) for `$days` days. */
    private function request(string $pickup = '2026-11-14 10:00', int $days = 2, array $attributes = []): Booking
    {
        $at = CarbonImmutable::parse($pickup, 'America/New_York');
        $return = $at->addDays($days);

        return Booking::factory()->create([
            'pickup_date' => $at->toDateString(),
            'pickup_time' => $at->format('H:i'),
            'return_date' => $return->toDateString(),
            'return_time' => $return->format('H:i'),
            'days' => $days,
            'total_usd' => 499 * $days,
            'price_per_day' => 499,
            'deposit_usd' => 500,
            'deposit_mode' => 'hold',
            'email' => 'jordan@example.com',
            ...$attributes,
        ]);
    }

    /** A booking whose card is saved (and hold scheduled), as after the customer's step. */
    private function withCard(string $pickup = '2026-11-14 10:00', int $days = 2, array $attributes = []): Booking
    {
        return $this->request($pickup, $days, [
            'status' => BookingStatus::CardSaved,
            'stripe_customer_id' => 'cus_1',
            'stripe_setup_intent_id' => 'seti_1',
            'stripe_payment_method_id' => 'pm_visa',
            'card_label' => 'Visa •••• 4242',
            'card_saved_at' => now(),
            'hold_authorized_at' => now(),
            'hold_status' => HoldStatus::Scheduled,
            ...$attributes,
        ]);
    }

    private function onHold(string $pickup = '2026-11-14 10:00', int $days = 2, array $attributes = []): Booking
    {
        return $this->withCard($pickup, $days, [
            'status' => BookingStatus::Confirmed,
            'hold_status' => HoldStatus::OnHold,
            'hold_payment_intent_id' => 'pi_hold_old',
            'hold_placed_at' => now(),
            'hold_expires_at' => now()->addDays(7),
            ...$attributes,
        ]);
    }

    private function scheduler(): void
    {
        $this->artisan('bookings:deposit-holds')->assertSuccessful();
    }

    private function stripeEvent(string $type, string $id, string $object = 'payment_intent')
    {
        $payload = json_encode(['id' => 'evt_1', 'object' => 'event', 'type' => $type, 'data' => ['object' => ['id' => $id, 'object' => $object]]]);
        $timestamp = time();
        $signature = hash_hmac('sha256', "{$timestamp}.{$payload}", self::WEBHOOK_SECRET);

        return $this->call('POST', '/api/stripe/webhook', server: [
            'CONTENT_TYPE' => 'application/json',
            'HTTP_ACCEPT' => 'application/json',
            'HTTP_STRIPE_SIGNATURE' => "t={$timestamp},v1={$signature}",
        ], content: $payload);
    }

    private function admin(Booking $booking)
    {
        Filament::setCurrentPanel('admin');
        $this->actingAs(User::factory()->create());

        return Livewire::test(ViewBooking::class, ['record' => $booking->getRouteKey()]);
    }

    // Saving the card -------------------------------------------------------------------------

    public function test_the_card_is_saved_only_with_the_hold_agreement(): void
    {
        $booking = $this->request();

        $this->postJson("/api/bookings/{$booking->public_id}/card")
            ->assertUnprocessable()
            ->assertJsonPath('errors.acceptHold.0', 'Agree to the $500 hold to save your card.');

        $this->postJson("/api/bookings/{$booking->public_id}/card", ['acceptHold' => true])
            ->assertOk()
            ->assertExactJson(['bookingId' => $booking->public_id, 'amountUsd' => 500, 'clientSecret' => 'seti_1_secret_abc']);

        $booking->refresh();
        $this->assertNotNull($booking->hold_authorized_at);
        $this->assertSame('cus_1', $booking->stripe_customer_id);
        $this->assertSame('seti_1', $booking->stripe_setup_intent_id);
        // Nothing is held or charged yet.
        $this->assertSame([], $this->gateway->holds);
        $this->assertSame(BookingStatus::PendingDeposit, $booking->status);
    }

    public function test_a_saved_card_locks_the_dates_and_schedules_the_hold(): void
    {
        $booking = $this->request(attributes: ['stripe_setup_intent_id' => 'seti_1', 'stripe_customer_id' => 'cus_1']);

        $this->stripeEvent('setup_intent.succeeded', 'seti_1', 'setup_intent')->assertOk();

        $booking->refresh();
        $this->assertSame(BookingStatus::CardSaved, $booking->status);
        $this->assertSame(HoldStatus::Scheduled, $booking->hold_status);
        $this->assertSame('Visa •••• 4242', $booking->card_label);
        $this->assertSame('Scheduled', $booking->holdSummary());
        // Pick-up is three days away: no hold yet.
        $this->assertSame([], $this->gateway->holds);

        // The dates stay taken after the 24 hours an unpaid request gets.
        $this->travel(2)->days();
        $this->assertFalse(app(AvailabilityService::class)->isAvailable($booking->car, $booking->pickup_date, $booking->return_date));
    }

    public function test_the_booking_page_records_the_saved_card_without_waiting_for_the_webhook(): void
    {
        $booking = $this->request(attributes: ['stripe_setup_intent_id' => 'seti_1', 'stripe_customer_id' => 'cus_1']);
        $link = $booking->pageLink();

        $this->getJson("/api/bookings/{$booking->public_id}/upload?expires={$link['expires']}&signature={$link['signature']}")
            ->assertOk()
            ->assertJsonPath('status', 'card_saved')
            ->assertJsonPath('depositMode', 'hold')
            ->assertJsonPath('cardSaved', true)
            ->assertJsonPath('awaitingCard', false)
            ->assertJsonPath('holdStatus', 'scheduled')
            ->assertJsonPath('cardLabel', 'Visa •••• 4242')
            ->assertJsonPath('holdAt', CarbonImmutable::parse('2026-11-13 10:00', 'America/New_York')->toIso8601String());
    }

    // Placing the hold ------------------------------------------------------------------------

    public function test_the_scheduler_places_the_hold_24_hours_before_pickup(): void
    {
        $booking = $this->withCard('2026-11-14 10:00');

        // Friday 9:55 AM: not yet.
        $this->travelTo(CarbonImmutable::parse('2026-11-13 09:55', 'America/New_York'));
        $this->scheduler();
        $this->assertSame([], $this->gateway->holds);

        // Friday 10:00 AM, 24 hours before pick-up.
        $this->travelTo(CarbonImmutable::parse('2026-11-13 10:00', 'America/New_York'));
        $this->scheduler();

        $this->assertSame([['booking' => $booking->public_id, 'cents' => 50000, 'key' => "hold-{$booking->public_id}-1"]], $this->gateway->holds);
        $booking->refresh();
        $this->assertSame(HoldStatus::OnHold, $booking->hold_status);
        $this->assertSame('pi_hold_1', $booking->hold_payment_intent_id);
        $this->assertNotNull($booking->hold_expires_at);
        $this->assertSame('On hold', $booking->holdSummary());

        // Running again places nothing more.
        $this->scheduler();
        $this->assertCount(1, $this->gateway->holds);
        Mail::assertNothingOutgoing();
    }

    public function test_a_same_day_booking_is_held_as_soon_as_the_card_is_saved(): void
    {
        // Pick-up at 5 PM today, five hours from now.
        $booking = $this->request('2026-11-11 17:00', 1, ['stripe_setup_intent_id' => 'seti_1', 'stripe_customer_id' => 'cus_1']);

        $this->stripeEvent('setup_intent.succeeded', 'seti_1', 'setup_intent')->assertOk();

        $this->assertCount(1, $this->gateway->holds);
        $this->assertSame(HoldStatus::OnHold, $booking->refresh()->hold_status);
        $this->assertSame(BookingStatus::CardSaved, $booking->status);
    }

    /** @return array<string, array{string, string}> */
    public static function failedHolds(): array
    {
        return [
            'declined (4000 0000 0000 0002)' => ['generic_decline', 'The card was declined.'],
            'insufficient funds (4000 0000 0000 9995)' => ['insufficient_funds', 'Insufficient funds on the card.'],
            '3D Secure required (4000 0025 0000 3155)' => ['authentication_required', 'The bank wants the customer to confirm the hold (3D Secure).'],
        ];
    }

    #[DataProvider('failedHolds')]
    public function test_a_failed_hold_is_hold_failed_and_both_sides_are_told(string $code, string $reason): void
    {
        $booking = $this->withCard('2026-11-12 10:00');
        $this->gateway->nextHolds = [new HoldResult('failed', 'pi_failed', failureCode: $code, failureMessage: 'Stripe says no')];
        // Until the customer acts, Stripe reports the same.
        $this->gateway->states['pi_failed'] = new HoldResult('failed', 'pi_failed', failureCode: $code);

        $this->scheduler();

        $booking->refresh();
        $this->assertSame(HoldStatus::Failed, $booking->hold_status);
        $this->assertSame('Hold failed', $booking->holdSummary());
        $this->assertSame($reason, $booking->hold_failure);
        $this->assertSame('pi_failed', $booking->hold_pending_intent_id);
        $this->assertNull($booking->hold_payment_intent_id);
        // The booking itself is untouched: the owner decides.
        $this->assertSame(BookingStatus::CardSaved, $booking->status);

        Mail::assertSent(DepositHoldFailed::class, fn ($mail) => $mail->hasTo('jordan@example.com')
            && str_contains($mail->render(), 'Confirm the hold'));
        Mail::assertSent(DepositHoldFailedOwner::class, fn ($mail) => $mail->hasTo('owner@example.com') && str_contains($mail->render(), $reason));

        // The booking page offers to finish it; the customer gets Stripe's client secret.
        $link = $booking->pageLink();
        $this->getJson("/api/bookings/{$booking->public_id}/upload?expires={$link['expires']}&signature={$link['signature']}")
            ->assertJsonPath('holdStatus', 'failed')
            ->assertJsonPath('holdActionNeeded', true);
        $this->postJson("/api/bookings/{$booking->public_id}/hold")->assertOk()->assertJsonPath('clientSecret', 'pi_failed_secret');

        // The scheduler does not keep trying on its own.
        $this->scheduler();
        $this->assertCount(1, $this->gateway->holds);
    }

    public function test_a_hold_the_customer_finishes_on_the_page_is_on_hold_with_the_new_card(): void
    {
        $booking = $this->withCard('2026-11-12 10:00', attributes: [
            'hold_status' => HoldStatus::Failed,
            'hold_pending_intent_id' => 'pi_failed',
            'hold_failed_at' => now(),
            'hold_failure' => 'The bank wants the customer to confirm the hold (3D Secure).',
        ]);
        $this->gateway->states['pi_failed'] = new HoldResult('held', 'pi_failed', now()->addDays(7)->toImmutable(), paymentMethodId: 'pm_new', cardLabel: 'Mastercard •••• 4444');

        $this->stripeEvent('payment_intent.amount_capturable_updated', 'pi_failed')->assertOk();

        $booking->refresh();
        $this->assertSame(HoldStatus::OnHold, $booking->hold_status);
        $this->assertSame('pi_failed', $booking->hold_payment_intent_id);
        $this->assertNull($booking->hold_pending_intent_id);
        $this->assertNull($booking->hold_failure);
        $this->assertSame('pm_new', $booking->stripe_payment_method_id);
        $this->assertSame('Mastercard •••• 4444', $booking->card_label);
        // Not mistaken for the old-style deposit payment.
        $this->assertNull($booking->deposit_paid_at);
    }

    public function test_the_owner_can_try_the_hold_again(): void
    {
        $booking = $this->withCard('2026-11-12 10:00', attributes: [
            'hold_status' => HoldStatus::Failed,
            'hold_pending_intent_id' => 'pi_failed',
            'hold_attempts' => 1,
        ]);

        $this->admin($booking)->callAction('placeHoldNow')->assertHasNoActionErrors();

        $this->assertSame(HoldStatus::OnHold, $booking->refresh()->hold_status);
        $this->assertSame("hold-{$booking->public_id}-2", $this->gateway->holds[0]['key']);
        // The unfinished one is cancelled, so the customer cannot end up with two holds.
        $this->assertSame(['pi_failed'], $this->gateway->released);
    }

    // Renewing, expiry, reminders -------------------------------------------------------------

    public function test_a_hold_is_renewed_12_hours_before_it_lapses_while_the_rental_needs_it(): void
    {
        // A 10-day rental: the first hold (5 days, Visa off session) ends long before the return.
        $booking = $this->onHold('2026-11-12 10:00', 10, [
            'hold_expires_at' => CarbonImmutable::parse('2026-11-16 04:00', 'America/New_York')->utc(),
        ]);

        $this->travelTo(CarbonImmutable::parse('2026-11-15 15:00', 'America/New_York'));
        $this->scheduler();
        $this->assertSame([], $this->gateway->holds);

        $this->travelTo(CarbonImmutable::parse('2026-11-15 16:05', 'America/New_York'));
        $this->scheduler();

        $this->assertCount(1, $this->gateway->holds);
        $booking->refresh();
        $this->assertSame('pi_hold_1', $booking->hold_payment_intent_id);
        $this->assertSame(['pi_hold_old'], $this->gateway->released, 'the old hold is cancelled only after the new one is in place');
        Mail::assertNothingOutgoing();
    }

    public function test_no_renewal_once_the_owner_has_had_a_day_after_the_return(): void
    {
        // Back Nov 14, 10 AM; the hold lasts until Nov 16, past the 24 hours after the return.
        $booking = $this->onHold('2026-11-12 10:00', 2, [
            'hold_expires_at' => CarbonImmutable::parse('2026-11-16 10:00', 'America/New_York')->utc(),
        ]);

        $this->travelTo(CarbonImmutable::parse('2026-11-16 00:00', 'America/New_York'));
        $this->scheduler();

        $this->assertSame([], $this->gateway->holds);
        $this->assertSame('pi_hold_old', $booking->refresh()->hold_payment_intent_id);
    }

    public function test_a_failed_renewal_keeps_the_current_hold_until_it_lapses(): void
    {
        $booking = $this->onHold('2026-11-12 10:00', 10, [
            'hold_expires_at' => CarbonImmutable::parse('2026-11-16 04:00', 'America/New_York')->utc(),
        ]);
        $this->gateway->nextHolds = [new HoldResult('failed', 'pi_renew', failureCode: 'insufficient_funds')];

        $this->travelTo(CarbonImmutable::parse('2026-11-15 16:05', 'America/New_York'));
        $this->scheduler();

        $booking->refresh();
        $this->assertSame(HoldStatus::Failed, $booking->hold_status);
        $this->assertSame('pi_hold_old', $booking->hold_payment_intent_id);
        $this->assertTrue($booking->hasCapturableHold());
        $this->assertSame([], $this->gateway->released);
        Mail::assertSent(DepositHoldFailedOwner::class, fn ($mail) => str_contains($mail->render(), 'This was a renewal'));
    }

    public function test_stripe_lapsing_a_hold_shows_it_as_expired(): void
    {
        $booking = $this->onHold();

        $this->stripeEvent('payment_intent.canceled', 'pi_hold_old')->assertOk();

        $booking->refresh();
        $this->assertSame(HoldStatus::Expired, $booking->hold_status);
        $this->assertNull($booking->hold_payment_intent_id);
    }

    public function test_the_owner_is_reminded_once_a_day_after_the_return(): void
    {
        $booking = $this->onHold('2026-11-12 10:00', 2, [
            'status' => BookingStatus::Returned,
            'hold_expires_at' => CarbonImmutable::parse('2026-11-18 10:00', 'America/New_York')->utc(),
        ]);

        $this->travelTo(CarbonImmutable::parse('2026-11-15 09:55', 'America/New_York'));
        $this->scheduler();
        Mail::assertNotSent(DepositHoldReminder::class);

        $this->travelTo(CarbonImmutable::parse('2026-11-15 10:00', 'America/New_York'));
        $this->scheduler();
        $this->scheduler();

        Mail::assertSent(DepositHoldReminder::class, 1);
        Mail::assertSent(DepositHoldReminder::class, fn ($mail) => $mail->hasTo('owner@example.com') && str_contains($mail->render(), 'Nov 18'));
    }

    public function test_the_reminder_comes_earlier_when_the_hold_would_lapse_first(): void
    {
        // Back Nov 14, 10 AM; the hold ends Nov 14, 8 PM, past the return (so no renewal is due
        // before the return) but before the owner's 24 hours are up: renewed at 8 AM, and the
        // owner hears at the return.
        $booking = $this->onHold('2026-11-12 10:00', 2, [
            'hold_expires_at' => CarbonImmutable::parse('2026-11-14 20:00', 'America/New_York')->utc(),
        ]);

        $this->assertEquals(
            CarbonImmutable::parse('2026-11-14 10:00', 'America/New_York')->getTimestamp(),
            app(DepositHolds::class)->reminderDueAt($booking)->getTimestamp(),
        );
    }

    // After the return: release, capture, extra charge ----------------------------------------

    public function test_the_owner_releases_the_hold(): void
    {
        $booking = $this->onHold(attributes: ['status' => BookingStatus::Returned]);

        $this->admin($booking)->callAction('releaseHold')->assertHasNoActionErrors();

        $this->assertSame(['pi_hold_old'], $this->gateway->released);
        $booking->refresh();
        $this->assertSame(HoldStatus::Released, $booking->hold_status);
        $this->assertSame('Released', $booking->holdSummary());
        Mail::assertSent(DepositHoldReleased::class, fn ($mail) => $mail->hasTo('jordan@example.com')
            && str_contains($mail->render(), 'Nothing was charged'));
    }

    public function test_the_owner_captures_part_of_the_hold_with_a_reason(): void
    {
        $booking = $this->onHold(attributes: ['status' => BookingStatus::Returned]);

        $this->admin($booking)
            ->callAction('captureHold', ['amount' => 120, 'reasons' => ['late_return', 'fuel'], 'note' => '2 hours late, 2 gallons'])
            ->assertHasNoActionErrors();

        $this->assertSame([['intent' => 'pi_hold_old', 'cents' => 12000]], $this->gateway->captured);
        $booking->refresh();
        $this->assertSame(HoldStatus::Captured, $booking->hold_status);
        $this->assertSame('Captured $120 (Late return, Fuel: 2 hours late, 2 gallons)', $booking->holdSummary());
        // Its own email: what was used, why, and what went back. Never "Nothing was charged".
        Mail::assertSent(DepositHoldReleased::class, function ($mail) {
            $html = $mail->render();

            return $mail->envelope()->subject === 'Part of your $500 hold was used'
                && str_contains($html, '$120.00')
                && str_contains($html, 'Late return, Fuel: 2 hours late, 2 gallons')
                && str_contains($html, '$380.00')
                && str_contains($html, 'was released')
                && ! str_contains($html, 'Nothing was charged');
        });
    }

    public function test_a_released_hold_email_says_nothing_was_charged(): void
    {
        $booking = $this->onHold(attributes: ['status' => BookingStatus::Returned]);

        app(DepositHolds::class)->release($booking);

        Mail::assertSent(DepositHoldReleased::class, fn ($mail) => $mail->envelope()->subject === 'Your $500 hold has been released'
            && str_contains($mail->render(), 'Nothing was charged')
            && ! str_contains($mail->render(), 'was used'));
    }

    public function test_a_capture_stays_within_the_hold_and_the_agreed_reasons(): void
    {
        $booking = $this->onHold(attributes: ['status' => BookingStatus::Returned]);

        $this->admin($booking)->callAction('captureHold', ['amount' => 600, 'reasons' => ['tolls']])->assertHasActionErrors(['amount']);
        $this->admin($booking)->callAction('captureHold', ['amount' => 50, 'reasons' => []])->assertHasActionErrors(['reasons']);
        $this->expectException(BookingActionRefused::class);
        app(DepositHolds::class)->capture($booking, 50, ['damage']);
    }

    public function test_the_owner_charges_the_saved_card_for_more(): void
    {
        $booking = $this->onHold(attributes: [
            'status' => BookingStatus::Returned,
            'hold_status' => HoldStatus::Captured,
            'hold_payment_intent_id' => null,
        ]);

        $this->admin($booking)
            ->callAction('extraCharge', ['reason' => 'tickets', 'amount' => 75, 'note' => 'Speed camera, Nov 13'])
            ->assertHasNoActionErrors();

        $this->assertSame(7500, $this->gateway->charges[0]['cents']);
        $charge = BookingCharge::sole();
        $this->assertSame(BookingCharge::SUCCEEDED, $charge->status);
        $this->assertSame('pi_charge_1', $charge->stripe_payment_intent_id);
        Mail::assertSent(ExtraCharge::class, fn ($mail) => $mail->hasTo('jordan@example.com') && str_contains($mail->render(), 'Speed camera'));
    }

    public function test_a_declined_extra_charge_is_kept_and_reported(): void
    {
        $booking = $this->onHold(attributes: ['status' => BookingStatus::Returned]);
        $this->gateway->chargeFailure = 'insufficient_funds';

        $this->admin($booking)->callAction('extraCharge', ['reason' => 'damage', 'amount' => 900]);

        $charge = BookingCharge::sole();
        $this->assertSame(BookingCharge::FAILED, $charge->status);
        $this->assertSame('Insufficient funds on the card.', $charge->failure);
        Mail::assertNotSent(ExtraCharge::class);
    }

    // Cancelling ------------------------------------------------------------------------------

    public function test_a_late_cancellation_charges_one_day_to_the_card_and_releases_the_hold(): void
    {
        // Pick-up tomorrow at 10 AM: inside 48 hours, so the dialog offers one day's price.
        $booking = $this->onHold('2026-11-12 10:00');

        // The fee is offered once the owner says the customer asked to cancel.
        $this->admin($booking)->mountAction('cancel')->assertActionDataSet(['cancelledBy' => 'us', 'lateFee' => 0])
            ->setActionData(['cancelledBy' => 'customer'])->assertActionDataSet(['lateFee' => 499]);
        $this->admin($booking)->callAction('cancel', ['cancelledBy' => 'customer', 'lateFee' => 499, 'notify' => true])->assertHasNoActionErrors();

        $booking->refresh();
        $this->assertSame(BookingStatus::Cancelled, $booking->status);
        $this->assertSame(HoldStatus::Released, $booking->hold_status);
        $this->assertSame(['pi_hold_old'], $this->gateway->released);
        $this->assertSame(49900, $this->gateway->charges[0]['cents']);
        $this->assertSame('late_cancellation', BookingCharge::sole()->reason);
        Mail::assertSent(BookingCancelled::class, fn ($mail) => $mail->envelope()->subject === 'Your booking is cancelled'
            && str_contains($mail->render(), 'as you asked, we cancelled your booking')
            && ! str_contains($mail->render(), 'we&#039;re sorry')
            && ! str_contains($mail->render(), 'can&#039;t go ahead')
            && str_contains($mail->render(), 'late cancellation fee of $499.00')
            && str_contains($mail->render(), 'The hold on your card has been released'));
        Mail::assertNotSent(DepositHoldReleased::class);
    }

    public function test_an_early_cancellation_charges_nothing(): void
    {
        $booking = $this->withCard('2026-11-20 10:00');

        $this->admin($booking)->mountAction('cancel')->assertActionDataSet(['lateFee' => 0]);
        $this->admin($booking)->callAction('cancel', ['lateFee' => 0, 'notify' => true])->assertHasNoActionErrors();

        $this->assertSame([], $this->gateway->charges);
        $this->assertSame(BookingStatus::Cancelled, $booking->refresh()->status);
        // Cancelled by us: the "we can't go ahead" email, with the hold line.
        Mail::assertSent(BookingCancelled::class, fn ($mail) => $mail->envelope()->subject === 'About your booking request'
            && str_contains($mail->render(), 'go ahead with your booking')
            && ! str_contains($mail->render(), 'late cancellation')
            && str_contains($mail->render(), 'The hold on your card has been released'));
    }

    public function test_a_declined_late_fee_stops_the_cancellation(): void
    {
        $booking = $this->onHold('2026-11-12 10:00');
        $this->gateway->chargeFailure = 'card_declined';

        $this->admin($booking)->callAction('cancel', ['lateFee' => 499, 'notify' => false]);

        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);
        $this->assertSame(HoldStatus::OnHold, $booking->hold_status);
    }

    // Old bookings ----------------------------------------------------------------------------

    public function test_bookings_from_before_keep_the_charged_deposit(): void
    {
        $old = Booking::factory()->create(['deposit_usd' => 1000]);

        $this->assertSame('charge', $old->refresh()->deposit_mode);
        $this->postJson("/api/bookings/{$old->public_id}/card", ['acceptHold' => true])->assertConflict();
        $this->scheduler();
        $this->assertSame([], $this->gateway->holds);
    }

    public function test_a_hold_mode_booking_takes_no_deposit_payment(): void
    {
        $booking = $this->request();

        $this->postJson("/api/bookings/{$booking->public_id}/deposit")->assertConflict();
    }
}
