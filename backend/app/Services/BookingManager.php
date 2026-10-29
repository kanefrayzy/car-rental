<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Exceptions\BookingActionRefused;
use App\Jobs\SendReviewRequest;
use App\Mail\BookingCancelled;
use App\Mail\BookingConfirmed;
use App\Mail\DepositRefunded;
use App\Models\BlockedPeriod;
use App\Models\Booking;
use App\Models\Car;
use App\Services\Deposits\DepositGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * What the owner does with a booking from the admin panel. Kept out of the panel so the
 * rules are the same wherever they are used, and are covered by tests.
 */
class BookingManager
{
    public function __construct(
        private AvailabilityService $availability,
        private DepositGateway $deposits,
    ) {}

    /** Accept a request. Refused if another booking or closed dates overlap it. */
    public function confirm(Booking $booking, bool $notifyCustomer = true): Booking
    {
        if ($booking->status === BookingStatus::Confirmed) {
            throw new BookingActionRefused('This booking is already confirmed.');
        }
        if ($booking->status === BookingStatus::Cancelled) {
            throw new BookingActionRefused('A cancelled booking cannot be confirmed. Ask the customer to send a new request.');
        }
        if ($booking->status === BookingStatus::Returned) {
            throw new BookingActionRefused('This rental is already finished.');
        }

        DB::transaction(function () use ($booking) {
            // Same lock as a new request from the site, so the two cannot interleave.
            Car::whereKey($booking->car_id)->lockForUpdate()->first();
            $this->ensureDatesAreFree($booking);

            $booking->update([
                'status' => BookingStatus::Confirmed,
                'confirmed_at' => now(),
            ]);
        });

        if ($notifyCustomer) {
            rescue(fn () => Mail::to($booking->email)->send(new BookingConfirmed($booking->fresh('car'))));
        }

        return $booking;
    }

    /**
     * Turn a request down, or cancel a confirmed booking. Frees the dates. A card deposit is
     * refunded in full unless `$depositRefundUsd` says less: a late cancellation keeps its fee
     * from the deposit and refunds the rest (Rental Terms, 2026-10-19); 0 keeps all of it.
     */
    public function cancel(Booking $booking, ?string $messageToCustomer = null, bool $notifyCustomer = true, bool $refundDeposit = true, bool $refundRental = true, ?float $depositRefundUsd = null): Booking
    {
        if ($booking->status === BookingStatus::Cancelled) {
            throw new BookingActionRefused('This booking is already cancelled.');
        }
        if ($booking->status === BookingStatus::Returned) {
            throw new BookingActionRefused('The car is already back, so this booking cannot be cancelled. Use Refund deposit to give the deposit back.');
        }

        // Refund first: if Stripe refuses, the booking stays as it was and the owner can retry.
        $depositRefundUsd = round($depositRefundUsd ?? $booking->deposit_usd, 2);
        if ($refundDeposit && $booking->depositRefundable() && $depositRefundUsd > 0) {
            $this->refundDeposit($booking, $depositRefundUsd, 'Booking cancelled', notifyCustomer: false);
        }
        if ($refundRental && $booking->rentalRefundable()) {
            $this->refundRental($booking);
        }

        $booking->update([
            'status' => BookingStatus::Cancelled,
            'cancelled_at' => now(),
        ]);

        if ($notifyCustomer) {
            $message = trim((string) $messageToCustomer) ?: null;
            rescue(fn () => Mail::to($booking->email)->send(new BookingCancelled($booking->fresh('car'), $message)));
        }

        return $booking;
    }

    /**
     * Give back a deposit paid by card: all of it, or what is left after deductions (late
     * return, fuel, cleaning...) once the car is back. One refund per booking.
     */
    public function refundDeposit(Booking $booking, float $amountUsd, ?string $note = null, bool $notifyCustomer = true): Booking
    {
        if (! $booking->depositRefundable()) {
            throw new BookingActionRefused($booking->deposit_refunded_at
                ? 'The deposit has already been refunded.'
                : 'This deposit was not paid by card on the website, so it cannot be refunded through Stripe.');
        }
        $amountUsd = round($amountUsd, 2);
        if ($amountUsd <= 0 || $amountUsd > $booking->deposit_usd) {
            throw new BookingActionRefused('Refund between $0.01 and $'.number_format($booking->deposit_usd).'.');
        }

        try {
            $this->deposits->refund($booking, (int) round($amountUsd * 100));
        } catch (BookingActionRefused $refused) {
            throw $refused;
        } catch (Throwable $error) {
            report($error);
            throw new BookingActionRefused('Stripe did not accept the refund: '.$error->getMessage());
        }

        $booking->update([
            'deposit_refunded_usd' => $amountUsd,
            'deposit_refunded_at' => now(),
            'deposit_refund_note' => trim((string) $note) ?: null,
        ]);

        if ($notifyCustomer) {
            rescue(fn () => Mail::to($booking->email)->send(new DepositRefunded($booking->fresh('car'))));
        }

        return $booking;
    }

    /** Gives back the whole rental payment of a cancelled booking. */
    public function refundRental(Booking $booking): Booking
    {
        if (! $booking->rentalRefundable()) {
            throw new BookingActionRefused('The rental was not paid by card on the website, or it was already refunded.');
        }
        $amount = $booking->totalWithTax();

        try {
            $this->deposits->refundRental($booking, (int) round($amount * 100));
        } catch (BookingActionRefused $refused) {
            throw $refused;
        } catch (Throwable $error) {
            report($error);
            throw new BookingActionRefused('Stripe did not accept the refund: '.$error->getMessage());
        }

        $booking->update(['rental_refunded_usd' => $amount, 'rental_refunded_at' => now()]);

        return $booking;
    }

    /**
     * The car is back. The customer gets a thank-you email with the review link
     * `rental.review_delay_hours` later (SendReviewRequest; skipped while no link is set).
     */
    public function markReturned(Booking $booking): Booking
    {
        if ($booking->status !== BookingStatus::Confirmed) {
            throw new BookingActionRefused(match ($booking->status) {
                BookingStatus::Returned => 'This rental is already marked as returned.',
                BookingStatus::Cancelled => 'A cancelled booking cannot be marked as returned.',
                default => 'Only a confirmed booking can be marked as returned. Confirm it first.',
            });
        }
        // A slip of the finger on a future booking would thank someone who has not driven yet.
        if ($booking->pickup_date->toDateString() > today(config('rental.timezone'))->toDateString()) {
            throw new BookingActionRefused('This rental has not started yet: pick-up is '.$booking->pickupLabel().'.');
        }

        $booking->update([
            'status' => BookingStatus::Returned,
            'returned_at' => now(),
        ]);

        SendReviewRequest::dispatch($booking->id)->delay(now()->addHours(config('rental.review_delay_hours')));

        return $booking;
    }

    /** Record a rental paid outside the website (cash, Zelle, a card in person). */
    public function markRentalPaid(Booking $booking): Booking
    {
        if (! $booking->rentalDue()) {
            throw new BookingActionRefused('Only a confirmed or returned booking that is not paid yet can be marked as paid.');
        }
        $this->closeCardPayment($booking->rental_payment_intent_id, 'rental');
        // Paid outside Stripe: no card payment to refund later.
        $booking->update(['rental_paid_at' => now(), 'rental_payment_intent_id' => null]);

        return $booking;
    }

    /**
     * Record a deposit the owner took outside Stripe (cash, Zelle, a card in person). A
     * paid request keeps its dates, so it must not overlap anything else.
     */
    public function markDepositPaid(Booking $booking): Booking
    {
        if ($booking->status === BookingStatus::Cancelled) {
            throw new BookingActionRefused('This booking is cancelled.');
        }
        if ($booking->status === BookingStatus::Returned) {
            throw new BookingActionRefused('This rental is already finished.');
        }
        if ($booking->deposit_paid_at !== null) {
            throw new BookingActionRefused('The deposit is already marked as paid.');
        }

        $this->closeCardPayment($booking->stripe_payment_intent_id, 'deposit');

        DB::transaction(function () use ($booking) {
            Car::whereKey($booking->car_id)->lockForUpdate()->first();

            $pending = $booking->status === BookingStatus::PendingDeposit;
            if ($pending) {
                $this->ensureDatesAreFree($booking);
            }

            $booking->update([
                'status' => $pending ? BookingStatus::DepositPaid : $booking->status,
                'deposit_paid_at' => now(),
                // Paid outside Stripe: the card payment the page started is not this deposit,
                // so the admin panel must not offer to refund it to a card.
                'stripe_payment_intent_id' => null,
            ]);
        });

        return $booking;
    }

    /**
     * Before recording money taken in person, close the card payment the booking page started,
     * so the customer cannot pay twice. If they already paid by card, say so instead.
     */
    private function closeCardPayment(?string $intentId, string $what): void
    {
        if ($intentId === null) {
            return;
        }

        try {
            $closed = $this->deposits->cancelIntent($intentId);
        } catch (Throwable $error) {
            // Stripe unreachable: record the cash anyway; the owner is standing there with it.
            report($error);

            return;
        }

        if (! $closed) {
            throw new BookingActionRefused("The customer has already paid the {$what} by card on the website. It is recorded automatically within a minute; refresh the page.");
        }
    }

    private function ensureDatesAreFree(Booking $booking): void
    {
        $car = $booking->car;
        $bookings = $this->availability->conflictingBookings($car, $booking->pickup_date, $booking->return_date, $booking);
        $closed = $this->availability->blockedPeriods($car, $booking->pickup_date, $booking->return_date);

        if ($bookings->isEmpty() && $closed->isEmpty()) {
            return;
        }

        $reasons = $bookings
            ->map(fn (Booking $other) => "{$other->name}'s booking ({$other->pickup_date->format('M j')} to {$other->return_date->format('M j')}, {$other->status->getLabel()})")
            ->toBase()
            ->merge($closed->map(fn (BlockedPeriod $period) => "closed dates {$period->starts_on->format('M j')} to {$period->ends_on->format('M j')}".($period->note ? " ({$period->note})" : '')))
            ->join('; ');

        throw new BookingActionRefused("These dates overlap {$reasons}. Cancel or move that first.");
    }
}
