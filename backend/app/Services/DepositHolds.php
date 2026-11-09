<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Enums\HoldStatus;
use App\Exceptions\BookingActionRefused;
use App\Mail\DepositHoldFailed;
use App\Mail\DepositHoldFailedOwner;
use App\Mail\DepositHoldReleased;
use App\Mail\DepositHoldReminder;
use App\Mail\ExtraCharge;
use App\Models\Booking;
use App\Models\BookingCharge;
use App\Models\Car;
use App\Services\Deposits\CardSetup;
use App\Services\Deposits\HoldGateway;
use App\Services\Deposits\HoldResult;
use App\Services\Deposits\SavedCard;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * The deposit as a hold on the customer's card (owner, 2026-11-10; deposit_mode "hold"):
 *
 * 1. The request saves the card (no charge) once the customer agrees to the hold; that locks
 *    the dates like a paid deposit did (status card_saved).
 * 2. `rental.deposit.hold_hours_before_pickup` (24) before pick-up, or at once when pick-up is
 *    sooner, the deposit is authorised on the card without the customer.
 * 3. While the rental and the owner's check after it (`inspection_hours_after_return`) need it,
 *    the hold is renewed `renew_hours_before_expiry` (12) before Stripe's capture deadline: a new
 *    authorisation first, then the old one is cancelled.
 * 4. After the return the owner releases it, or captures part of it with a reason, and may
 *    charge the saved card for more (only for charges listed in the Rental Terms).
 *
 * A hold the bank refuses (or wants the customer to confirm) is "Hold failed": the customer
 * gets a link to finish it on their booking page, the owner an email, and the owner decides
 * whether to hand over the car. `run()` is the scheduled part (bookings:deposit-holds).
 */
class DepositHolds
{
    public function __construct(
        private HoldGateway $gateway,
        private AvailabilityService $availability,
    ) {}

    public function enabled(): bool
    {
        return $this->gateway->enabled();
    }

    /** The customer agreed to the hold and starts saving their card on the booking page. */
    public function startCardSetup(Booking $booking): CardSetup
    {
        if (! $booking->usesHold()) {
            throw new BookingActionRefused('This booking pays its deposit by card, not with a hold.');
        }
        // Also after a confirmation: the owner may confirm a request before the card is saved.
        if (! in_array($booking->status, [BookingStatus::PendingDeposit, BookingStatus::Confirmed], true) || $booking->card_saved_at !== null) {
            throw new BookingActionRefused('This booking is not waiting for a card.');
        }

        $setup = $this->gateway->startCardSetup($booking);
        $booking->update([
            'stripe_customer_id' => $setup->customerId,
            'stripe_setup_intent_id' => $setup->setupIntentId,
            'hold_authorized_at' => now(),
        ]);

        return $setup;
    }

    /** Stripe confirmed the saved card (webhook, or the booking page asking). */
    public function cardSaved(Booking $booking, SavedCard $card): Booking
    {
        if ($booking->card_saved_at !== null) {
            return $booking;
        }

        DB::transaction(function () use ($booking, $card) {
            Car::whereKey($booking->car_id)->lockForUpdate()->first();
            $booking->refresh();
            if ($booking->card_saved_at !== null) {
                return;
            }

            $fields = [
                'stripe_payment_method_id' => $card->paymentMethodId,
                'card_label' => $card->label,
                'card_saved_at' => now(),
            ];

            // Like a paid deposit, the saved card locks the dates. A request whose 24-hour hold on
            // the dates ran out keeps the card, but only gets the dates if nobody took them.
            if ($booking->status === BookingStatus::PendingDeposit
                && (! $booking->holdExpired() || $this->availability->isAvailable($booking->car, $booking->pickup_date, $booking->return_date, $booking))) {
                $fields['status'] = BookingStatus::CardSaved;
                $fields['hold_status'] = HoldStatus::Scheduled;
            } elseif (in_array($booking->status, [BookingStatus::Confirmed, BookingStatus::DepositPaid], true)) {
                $fields['hold_status'] = HoldStatus::Scheduled;
            }

            $booking->update($fields);
        });

        $booking->refresh();
        if ($booking->hold_status === HoldStatus::Scheduled && $booking->holdDueAt()->lte(now())) {
            // Pick-up is less than a day away: the hold goes on now.
            $this->placeHold($booking);
        }

        return $booking;
    }

    /** The booking page asks after the customer saved the card: no need to wait for the webhook. */
    public function syncCard(Booking $booking): void
    {
        if (! $booking->usesHold() || $booking->card_saved_at !== null || ! $booking->stripe_setup_intent_id || ! $this->enabled()) {
            return;
        }

        try {
            if ($card = $this->gateway->savedCard($booking->stripe_setup_intent_id)) {
                $this->cardSaved($booking, $card);
            }
        } catch (Throwable $error) {
            report($error);
        }
    }

    /**
     * Authorise the deposit on the saved card now: the scheduled hold, a renewal, or the
     * owner's "Place hold now". A failure is recorded and both sides are told.
     */
    public function placeHold(Booking $booking, bool $notifyOnFailure = true): HoldResult
    {
        if (! $booking->hasSavedCard()) {
            throw new BookingActionRefused('There is no saved card on this booking.');
        }
        if (! in_array($booking->status, [BookingStatus::CardSaved, BookingStatus::DepositPaid, BookingStatus::Confirmed, BookingStatus::Returned], true)) {
            throw new BookingActionRefused('A hold is only placed on an open booking.');
        }
        if (in_array($booking->hold_status, [HoldStatus::Released, HoldStatus::Captured], true)) {
            throw new BookingActionRefused('The hold on this booking is already settled.');
        }

        $attempt = $booking->hold_attempts + 1;
        $booking->update(['hold_attempts' => $attempt]);

        try {
            $result = $this->gateway->placeHold($booking, $booking->deposit_usd * 100, "hold-{$booking->public_id}-{$attempt}");
        } catch (BookingActionRefused $refused) {
            throw $refused;
        } catch (Throwable $error) {
            // Stripe unreachable or a request it refused: the same as a failed hold, with the reason.
            report($error);
            $result = new HoldResult(status: 'failed', failureCode: 'error', failureMessage: 'Stripe did not answer: '.$error->getMessage());
        }

        if ($result->status === 'held') {
            $this->recordHold($booking, $result);
        } else {
            $this->recordFailure($booking, $result, $notifyOnFailure);
        }

        return $result;
    }

    /**
     * A hold authorised outside placeHold: the customer finished a failed one on their page
     * (webhook payment_intent.amount_capturable_updated, or the page asking).
     */
    public function holdConfirmed(Booking $booking, string $intentId): void
    {
        if ($intentId !== $booking->hold_pending_intent_id) {
            return;
        }

        $result = $this->gateway->holdState($intentId);
        if ($result->status === 'held') {
            $this->recordHold($booking, $result);
        }
    }

    /** The booking page asks after the customer finished a failed hold. */
    public function syncPendingHold(Booking $booking): void
    {
        if ($booking->hold_status !== HoldStatus::Failed || ! $booking->hold_pending_intent_id || ! $this->enabled()) {
            return;
        }

        try {
            $this->holdConfirmed($booking, $booking->hold_pending_intent_id);
        } catch (Throwable $error) {
            report($error);
        }
    }

    /** For the customer's page: Stripe's client secret to finish a failed hold, or null. */
    public function resumeForCustomer(Booking $booking): ?string
    {
        if ($booking->hold_status !== HoldStatus::Failed || ! $booking->hold_pending_intent_id || ! $booking->isOpen()) {
            return null;
        }

        return $this->gateway->resumeHold($booking->hold_pending_intent_id);
    }

    /** Stripe cancelled a hold on its own: the capture deadline passed. */
    public function holdCanceled(Booking $booking, string $intentId): void
    {
        if ($intentId !== $booking->hold_payment_intent_id || ! in_array($booking->hold_status, [HoldStatus::OnHold, HoldStatus::Failed], true)) {
            return;
        }

        $booking->update([
            'hold_payment_intent_id' => null,
            'hold_status' => $booking->hold_status === HoldStatus::OnHold ? HoldStatus::Expired : HoldStatus::Failed,
        ]);
    }

    /** The owner gives the hold back: nothing is taken. The customer gets an email. */
    public function release(Booking $booking, bool $notifyCustomer = true): Booking
    {
        if (! $booking->usesHold() || ! $booking->hold_status?->isOpen()) {
            throw new BookingActionRefused('There is no open hold on this booking.');
        }

        $wasHeld = $booking->hold_payment_intent_id !== null;
        $this->cancelIntents($booking, [$booking->hold_payment_intent_id, $booking->hold_pending_intent_id]);

        $booking->update([
            'hold_status' => HoldStatus::Released,
            'hold_released_at' => now(),
            'hold_payment_intent_id' => null,
            'hold_pending_intent_id' => null,
        ]);

        if ($notifyCustomer && $wasHeld) {
            rescue(fn () => Mail::to($booking->email)->send(new DepositHoldReleased($booking->fresh('car'))));
        }

        return $booking;
    }

    /**
     * The owner takes part of the hold for charges the customer agreed to (tolls, tickets,
     * extra miles, late return, fuel, cleaning); the rest goes back to the card at once.
     *
     * @param  list<string>  $reasons  keys of rental.charge_reasons that may be captured
     */
    public function capture(Booking $booking, float $amountUsd, array $reasons, ?string $note = null): Booking
    {
        if (! $booking->hasCapturableHold()) {
            throw new BookingActionRefused('There is no hold on the card to capture from. Use Extra charge to charge the saved card.');
        }
        $allowed = collect(config('rental.charge_reasons'))->filter(fn (array $reason) => $reason['capture'])->keys()->all();
        $reasons = array_values(array_unique($reasons));
        if ($reasons === [] || array_diff($reasons, $allowed) !== []) {
            throw new BookingActionRefused('Pick the reason: '.Booking::reasonLabels($allowed).'.');
        }
        $amountUsd = round($amountUsd, 2);
        if ($amountUsd <= 0 || $amountUsd > $booking->deposit_usd) {
            throw new BookingActionRefused('Capture between $0.01 and $'.number_format($booking->deposit_usd).'. For more, use Extra charge.');
        }

        try {
            $this->gateway->captureHold($booking->hold_payment_intent_id, (int) round($amountUsd * 100));
        } catch (Throwable $error) {
            report($error);
            throw new BookingActionRefused('Stripe did not capture the hold: '.$error->getMessage());
        }
        $this->cancelIntents($booking, [$booking->hold_pending_intent_id], quietly: true);

        $note = trim((string) $note);
        $booking->update([
            'hold_status' => HoldStatus::Captured,
            'hold_captured_usd' => $amountUsd,
            'hold_captured_at' => now(),
            'hold_capture_reason' => Booking::reasonLabels($reasons).($note !== '' ? ": {$note}" : ''),
            'hold_pending_intent_id' => null,
        ]);

        rescue(fn () => Mail::to($booking->email)->send(new DepositHoldReleased($booking->fresh('car'))));

        return $booking;
    }

    /**
     * A charge to the saved card on top of the hold, for a charge listed in the Rental Terms.
     * A decline is kept as a failed charge and refused, so the owner sees it.
     */
    public function extraCharge(Booking $booking, float $amountUsd, string $reason, ?string $note = null, bool $notifyCustomer = true): BookingCharge
    {
        if (! $booking->hasSavedCard()) {
            throw new BookingActionRefused('There is no saved card on this booking to charge.');
        }
        if (! array_key_exists($reason, config('rental.charge_reasons'))) {
            throw new BookingActionRefused('Pick one of the charges listed in the Rental Terms.');
        }
        $amountUsd = round($amountUsd, 2);
        $max = config('rental.deposit.max_extra_charge_usd');
        if ($amountUsd <= 0 || $amountUsd > $max) {
            throw new BookingActionRefused('Charge between $0.01 and $'.number_format($max).'.');
        }

        $charge = $booking->charges()->create([
            'reason' => $reason,
            'note' => trim((string) $note) ?: null,
            'amount_usd' => $amountUsd,
            'status' => 'pending',
        ]);
        $description = Booking::reasonLabels([$reason])." (booking {$booking->public_id})";

        try {
            $result = $this->gateway->chargeSavedCard($booking, (int) round($amountUsd * 100), $description, "charge-{$booking->public_id}-{$charge->id}");
        } catch (Throwable $error) {
            report($error);
            $result = new HoldResult(status: 'failed', failureCode: 'error', failureMessage: 'Stripe did not answer: '.$error->getMessage());
        }

        $charge->update([
            'status' => $result->ok() ? BookingCharge::SUCCEEDED : BookingCharge::FAILED,
            'stripe_payment_intent_id' => $result->intentId,
            'failure' => $result->ok() ? null : mb_substr($result->reason(), 0, 255),
        ]);

        if (! $result->ok()) {
            throw new BookingActionRefused('The charge did not go through: '.$result->reason());
        }

        if ($notifyCustomer) {
            rescue(fn () => Mail::to($booking->email)->send(new ExtraCharge($booking->fresh('car'), $charge)));
        }

        return $charge;
    }

    /**
     * The scheduled part, every few minutes: place the holds that are due, renew the ones about
     * to lapse while still needed, notice expired ones, and remind the owner of open holds.
     *
     * @return array{placed: int, renewed: int, failed: int, expired: int, reminded: int}
     */
    public function run(): array
    {
        $counts = ['placed' => 0, 'renewed' => 0, 'failed' => 0, 'expired' => 0, 'reminded' => 0];
        if (! $this->enabled()) {
            return $counts;
        }
        $renewBefore = config('rental.deposit.renew_hours_before_expiry');

        // 1. Holds due: the set time before pick-up has come.
        Booking::query()
            ->where('deposit_mode', 'hold')
            ->where('hold_status', HoldStatus::Scheduled)
            ->whereIn('status', [BookingStatus::CardSaved, BookingStatus::DepositPaid, BookingStatus::Confirmed])
            ->whereNotNull('card_saved_at')
            ->get()
            ->filter(fn (Booking $booking) => $booking->holdDueAt()->lte(now()) && $booking->returnAt()->isFuture())
            ->each(function (Booking $booking) use (&$counts) {
                $this->safely(fn () => $this->placeHold($booking)->status === 'held' ? $counts['placed']++ : $counts['failed']++);
            });

        // 2. Renewals: a hold that lapses before the owner is done with it gets a new one first.
        Booking::query()
            ->where('deposit_mode', 'hold')
            ->where('hold_status', HoldStatus::OnHold)
            ->whereIn('status', [BookingStatus::CardSaved, BookingStatus::DepositPaid, BookingStatus::Confirmed, BookingStatus::Returned])
            ->whereNotNull('hold_expires_at')
            ->where('hold_expires_at', '<=', now()->addHours($renewBefore))
            ->where('hold_expires_at', '>', now())
            ->get()
            ->filter(fn (Booking $booking) => $booking->hold_expires_at->lt($booking->holdNeededUntil()))
            ->each(function (Booking $booking) use (&$counts) {
                $this->safely(fn () => $this->placeHold($booking)->status === 'held' ? $counts['renewed']++ : $counts['failed']++);
            });

        // 3. Past Stripe's deadline (the webhook normally says so first).
        Booking::query()
            ->where('deposit_mode', 'hold')
            ->whereIn('hold_status', [HoldStatus::OnHold, HoldStatus::Failed])
            ->whereNotNull('hold_payment_intent_id')
            ->where('hold_expires_at', '<', now())
            ->get()
            ->each(function (Booking $booking) use (&$counts) {
                $this->safely(function () use ($booking, &$counts) {
                    $state = $this->gateway->holdState($booking->hold_payment_intent_id);
                    if ($state->status === 'canceled') {
                        $this->holdCanceled($booking, $booking->hold_payment_intent_id);
                        $counts['expired']++;
                    }
                });
            });

        // 4. The owner's reminder: once the car is due back, at the end of the check time after
        //    the return, or earlier if the hold would lapse first.
        Booking::query()
            ->where('deposit_mode', 'hold')
            ->whereIn('hold_status', [HoldStatus::OnHold, HoldStatus::Failed])
            ->whereNotNull('hold_payment_intent_id')
            ->whereNull('hold_reminded_at')
            ->whereIn('status', [BookingStatus::Confirmed, BookingStatus::Returned, BookingStatus::CardSaved, BookingStatus::DepositPaid])
            ->get()
            ->filter(fn (Booking $booking) => $this->reminderDueAt($booking)?->lte(now()))
            ->each(function (Booking $booking) use (&$counts) {
                $owner = config('rental.owner_email');
                if ($owner) {
                    rescue(fn () => Mail::to($owner)->send(new DepositHoldReminder($booking->load('car'))));
                }
                $booking->update(['hold_reminded_at' => now()]);
                $counts['reminded']++;
            });

        return $counts;
    }

    /** When the owner is reminded of an open hold; null while the car is not due back yet. */
    public function reminderDueAt(Booking $booking): ?CarbonInterface
    {
        if ($booking->hold_expires_at === null) {
            return null;
        }
        $remindAt = $booking->holdNeededUntil();
        $lapse = $booking->hold_expires_at->subHours(config('rental.deposit.renew_hours_before_expiry'));
        if ($lapse->lt($remindAt)) {
            $remindAt = $lapse;
        }

        return $remindAt->lt($booking->returnAt()) ? $booking->returnAt() : $remindAt;
    }

    private function recordHold(Booking $booking, HoldResult $result): void
    {
        $previous = array_filter([$booking->hold_payment_intent_id, $booking->hold_pending_intent_id], fn ($id) => $id && $id !== $result->intentId);

        $fields = [
            'hold_status' => HoldStatus::OnHold,
            'hold_payment_intent_id' => $result->intentId,
            'hold_pending_intent_id' => null,
            'hold_placed_at' => now(),
            'hold_expires_at' => $result->expiresAt,
            'hold_failed_at' => null,
            'hold_failure' => null,
            'hold_reminded_at' => null,
        ];
        // The customer finished it with another card: that one is saved for later charges.
        if ($result->paymentMethodId && $result->paymentMethodId !== $booking->stripe_payment_method_id) {
            $fields['stripe_payment_method_id'] = $result->paymentMethodId;
            $fields['card_label'] = $result->cardLabel ?? $booking->card_label;
        }
        $booking->update($fields);

        // The renewal is in place: now the old authorisation goes.
        $this->cancelIntents($booking, array_values($previous), quietly: true);
    }

    private function recordFailure(Booking $booking, HoldResult $result, bool $notify): void
    {
        $stale = $booking->hold_pending_intent_id && $booking->hold_pending_intent_id !== $result->intentId
            ? $booking->hold_pending_intent_id
            : null;

        $booking->update([
            'hold_status' => HoldStatus::Failed,
            // A renewal that failed leaves the current hold in place until it lapses.
            'hold_pending_intent_id' => $result->intentId,
            'hold_failed_at' => now(),
            'hold_failure' => mb_substr($result->reason(), 0, 255),
        ]);
        if ($stale) {
            $this->cancelIntents($booking, [$stale], quietly: true);
        }

        if (! $notify) {
            return;
        }
        $booking->load('car');
        rescue(fn () => Mail::to($booking->email)->send(new DepositHoldFailed($booking)));
        if ($owner = config('rental.owner_email')) {
            rescue(fn () => Mail::to($owner)->send(new DepositHoldFailedOwner($booking)));
        }
    }

    /** @param  list<?string>  $intentIds */
    private function cancelIntents(Booking $booking, array $intentIds, bool $quietly = false): void
    {
        foreach (array_filter($intentIds) as $intentId) {
            try {
                $this->gateway->releaseHold($intentId);
            } catch (Throwable $error) {
                report($error);
                if (! $quietly) {
                    throw new BookingActionRefused('Stripe did not release the hold: '.$error->getMessage());
                }
            }
        }
    }

    private function safely(callable $step): void
    {
        try {
            $step();
        } catch (Throwable $error) {
            report($error);
        }
    }
}
