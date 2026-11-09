<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\HoldStatus;
use App\Mail\DepositHoldFailed;
use App\Mail\DepositHoldFailedOwner;
use App\Models\Booking;
use App\Models\BookingCharge;
use App\Services\BookingManager;
use App\Services\DepositHolds;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use PHPUnit\Framework\Attributes\Group;
use Stripe\Exception\CardException;
use Stripe\StripeClient;
use Tests\TestCase;

/**
 * The deposit hold against Stripe's TEST mode, with Stripe's test cards. Skipped unless
 * STRIPE_TEST_SECRET holds an sk_test_ key:
 *
 *   STRIPE_TEST_SECRET=sk_test_... php artisan test --group=stripe
 *
 * Our clock is moved and the scheduler run by hand; Stripe's side is real (its holds last as
 * long as its capture_before says). Saving a card that needs 3D Secure takes a browser, so the
 * on-session part of 4000 0025 0000 3155 is covered by scripts/check-deposit-hold.mjs.
 */
#[Group('stripe')]
class StripeHoldIntegrationTest extends TestCase
{
    use RefreshDatabase;

    private StripeClient $stripe;

    protected function setUp(): void
    {
        parent::setUp();

        $key = (string) env('STRIPE_TEST_SECRET');
        if (! str_starts_with($key, 'sk_test_')) {
            $this->markTestSkipped('STRIPE_TEST_SECRET (an sk_test_ key) is not set.');
        }
        config([
            'services.stripe.secret' => $key,
            'rental.deposit.mode' => 'hold',
            'rental.owner_email' => 'owner@example.com',
        ]);
        $this->stripe = new StripeClient($key);
        Mail::fake();
        $this->travelTo(CarbonImmutable::now('America/New_York')->setTime(12, 0));
    }

    private function holds(): DepositHolds
    {
        return app(DepositHolds::class);
    }

    private function booking(CarbonImmutable $pickup, int $days = 2): Booking
    {
        $return = $pickup->addDays($days);

        return Booking::factory()->create([
            'pickup_date' => $pickup->toDateString(),
            'pickup_time' => $pickup->format('H:i'),
            'return_date' => $return->toDateString(),
            'return_time' => $return->format('H:i'),
            'days' => $days,
            'price_per_day' => 499,
            'total_usd' => 499 * $days,
            'deposit_usd' => 500,
            'deposit_mode' => 'hold',
            'email' => 'delivered@resend.dev',
        ]);
    }

    /**
     * The customer's step on the booking page, done server side: agree, then confirm the
     * SetupIntent with a test card. Returns Stripe's error code when the card is refused.
     */
    private function saveCard(Booking $booking, string $testCard): ?string
    {
        $setup = $this->holds()->startCardSetup($booking);
        try {
            $intent = $this->stripe->setupIntents->confirm($setup->setupIntentId, ['payment_method' => $testCard]);
        } catch (CardException $error) {
            return $error->getError()->decline_code ?: $error->getStripeCode();
        }
        if ($intent->status !== 'succeeded') {
            return $intent->status;
        }
        $this->holds()->syncCard($booking);

        return null;
    }

    private function intent(string $id)
    {
        return $this->stripe->paymentIntents->retrieve($id);
    }

    private function scheduler(): void
    {
        $this->artisan('bookings:deposit-holds')->assertSuccessful();
    }

    public function test_hold_24_hours_before_pickup_then_released(): void
    {
        $pickup = now('America/New_York')->addDays(3)->setTime(10, 0)->toImmutable();
        $booking = $this->booking($pickup);

        $this->assertNull($this->saveCard($booking, 'pm_card_visa'));
        $booking->refresh();
        $this->assertSame(BookingStatus::CardSaved, $booking->status);
        $this->assertSame(HoldStatus::Scheduled, $booking->hold_status);
        $this->assertSame('Visa •••• 4242', $booking->card_label);

        $this->scheduler();
        $this->assertNull($booking->refresh()->hold_payment_intent_id, 'no hold three days out');

        $this->travelTo($pickup->subHours(24));
        $this->scheduler();
        $booking->refresh();
        $this->assertSame(HoldStatus::OnHold, $booking->hold_status);
        $intent = $this->intent($booking->hold_payment_intent_id);
        $this->assertSame('requires_capture', $intent->status);
        $this->assertSame(50000, $intent->amount_capturable);
        $this->assertTrue($booking->hold_expires_at->isFuture(), 'capture_before comes from Stripe');

        $this->holds()->release($booking);
        $this->assertSame('canceled', $this->intent($intent->id)->status);
        $this->assertSame(HoldStatus::Released, $booking->refresh()->hold_status);
    }

    public function test_same_day_booking_is_held_at_once(): void
    {
        $booking = $this->booking(now('America/New_York')->addHours(5)->toImmutable(), 1);

        $this->assertNull($this->saveCard($booking, 'pm_card_visa'));

        $booking->refresh();
        $this->assertSame(HoldStatus::OnHold, $booking->hold_status);
        $this->assertSame('requires_capture', $this->intent($booking->hold_payment_intent_id)->status);
        $this->holds()->release($booking, notifyCustomer: false);
    }

    public function test_cards_refused_when_saved_never_lock_the_dates(): void
    {
        $pickup = now('America/New_York')->addDays(3)->setTime(10, 0)->toImmutable();

        // 4000 0000 0000 0002 and 4000 0000 0000 9995: the bank refuses the card already when it is
        // saved, on the booking page, where the customer sees it and can use another card.
        foreach (['pm_card_chargeDeclined' => 'generic_decline', 'pm_card_chargeDeclinedInsufficientFunds' => 'insufficient_funds'] as $card => $code) {
            $booking = $this->booking($pickup);
            $this->assertSame($code, $this->saveCard($booking, $card), $card);
            $this->assertSame(BookingStatus::PendingDeposit, $booking->refresh()->status, $card);
            $this->assertNull($booking->card_saved_at, $card);
        }

        // 4000 0025 0000 3155: the bank wants 3D Secure when the card is saved (on the page).
        $booking = $this->booking($pickup);
        $this->assertSame('requires_action', $this->saveCard($booking, 'pm_card_authenticationRequiredOnSetup'));
        $this->assertNull($booking->refresh()->card_saved_at);
    }

    public function test_a_hold_the_bank_declines_later_is_hold_failed(): void
    {
        // 4000 0000 0000 0341: saved fine, refused when the hold is placed.
        $booking = $this->booking(now('America/New_York')->addHours(30)->setTime(10, 0)->toImmutable());
        $this->assertNull($this->saveCard($booking, 'pm_card_chargeCustomerFail'));

        $this->travelTo($booking->holdDueAt());
        $this->scheduler();

        $booking->refresh();
        $this->assertSame(HoldStatus::Failed, $booking->hold_status);
        $this->assertSame('The card was declined.', $booking->hold_failure);
        $this->assertSame('requires_payment_method', $this->intent($booking->hold_pending_intent_id)->status);
        // The customer's page gets a client secret to try again (any card).
        $this->assertNotNull($this->holds()->resumeForCustomer($booking));
        $this->assertSame('off_session', $this->intent($booking->hold_pending_intent_id)->setup_future_usage);
        Mail::assertSent(DepositHoldFailed::class);
        Mail::assertSent(DepositHoldFailedOwner::class);

        $pending = $booking->hold_pending_intent_id;
        $this->holds()->release($booking, notifyCustomer: false);
        $this->assertSame('canceled', $this->intent($pending)->status);
    }

    public function test_partial_capture_and_extra_charge(): void
    {
        $booking = $this->booking(now('America/New_York')->addHours(5)->toImmutable(), 1);
        $this->assertNull($this->saveCard($booking, 'pm_card_visa'));
        $booking->refresh();
        $holdId = $booking->hold_payment_intent_id;

        $this->holds()->capture($booking, 120, ['late_return', 'fuel'], 'test');
        $intent = $this->intent($holdId);
        $this->assertSame('succeeded', $intent->status);
        $this->assertSame(12000, $intent->amount_received);

        $charge = $this->holds()->extraCharge($booking->refresh(), 75, 'tickets', 'test');
        $this->assertSame(BookingCharge::SUCCEEDED, $charge->status);
        $paid = $this->intent($charge->stripe_payment_intent_id);
        $this->assertSame('succeeded', $paid->status);
        $this->assertSame(7500, $paid->amount_received);
    }

    public function test_late_cancellation_fee_and_release(): void
    {
        $booking = $this->booking(now('America/New_York')->addHours(5)->toImmutable(), 1);
        $this->assertNull($this->saveCard($booking, 'pm_card_visa'));
        $holdId = $booking->refresh()->hold_payment_intent_id;

        app(BookingManager::class)->cancel($booking, notifyCustomer: false, lateFeeUsd: 499);

        $this->assertSame('canceled', $this->intent($holdId)->status);
        $fee = BookingCharge::sole();
        $this->assertSame(49900, $this->intent($fee->stripe_payment_intent_id)->amount_received);
        $this->assertSame(BookingStatus::Cancelled, $booking->refresh()->status);
    }
}
