<?php

namespace App\Services\Deposits;

use App\Models\Booking;
use Stripe\Exception\InvalidRequestException;
use Stripe\StripeClient;

/** Booking payments through Stripe: the deposit at request time, the rental after confirmation. */
class StripeDepositGateway implements DepositGateway
{
    /**
     * @param  'automatic'|'manual'  $captureMethod  For the deposit. "manual" only authorises the
     *                                               card (a hold); Stripe releases an uncaptured hold
     *                                               after about a week, so it suits short lead times only.
     */
    public function __construct(
        private readonly StripeClient $stripe,
        private readonly string $captureMethod = 'automatic',
    ) {}

    public function createIntent(Booking $booking): DepositIntent
    {
        return $this->intent(
            $booking->stripe_payment_intent_id,
            $booking,
            $booking->deposit_usd * 100,
            "Rental deposit, booking {$booking->public_id}",
            "deposit-{$booking->public_id}",
            $this->captureMethod,
        );
    }

    public function createRentalIntent(Booking $booking): DepositIntent
    {
        $cents = (int) round($booking->totalWithTax() * 100);

        return $this->intent(
            $booking->rental_payment_intent_id,
            $booking,
            $cents,
            "Car rental, booking {$booking->public_id}",
            // The amount is part of the key: a changed price must never reuse an old payment.
            "rental-{$booking->public_id}-{$cents}",
            'automatic',
        );
    }

    public function refund(Booking $booking, int $amountCents): string
    {
        return $this->refundIntent($booking->stripe_payment_intent_id, $booking, $amountCents, "deposit-refund-{$booking->public_id}");
    }

    public function refundRental(Booking $booking, int $amountCents): string
    {
        return $this->refundIntent($booking->rental_payment_intent_id, $booking, $amountCents, "rental-refund-{$booking->public_id}");
    }

    public function cancelIntent(string $intentId): bool
    {
        try {
            $intent = $this->stripe->paymentIntents->retrieve($intentId);
        } catch (InvalidRequestException $error) {
            // Unknown under this key, e.g. started in test mode before the live keys: nothing to close.
            if ($error->getStripeCode() === 'resource_missing') {
                return true;
            }
            throw $error;
        }

        if (in_array($intent->status, ['succeeded', 'processing', 'requires_capture'], true)) {
            return false;
        }
        if ($intent->status !== 'canceled') {
            $this->stripe->paymentIntents->cancel($intentId);
        }

        return true;
    }

    private function intent(?string $existing, Booking $booking, int $cents, string $description, string $key, string $capture): DepositIntent
    {
        if ($existing) {
            $intent = $this->stripe->paymentIntents->retrieve($existing);
            if ($intent->amount === $cents) {
                return new DepositIntent($intent->id, $intent->client_secret);
            }
        }

        $intent = $this->stripe->paymentIntents->create(
            [
                'amount' => $cents, // Stripe counts in cents
                'currency' => 'usd',
                'capture_method' => $capture,
                // Which methods show is set in the Stripe dashboard (Settings > Payment methods;
                // Stripe no longer takes a list here). Keep it to cards and wallets: bank debits
                // take days and can bounce. Nothing that leaves the page.
                'automatic_payment_methods' => ['enabled' => true, 'allow_redirects' => 'never'],
                'receipt_email' => $booking->email,
                'description' => $description,
                'metadata' => ['booking' => $booking->public_id],
            ],
            // The same booking can never be charged twice, even if two requests race.
            ['idempotency_key' => $key],
        );

        return new DepositIntent($intent->id, $intent->client_secret);
    }

    private function refundIntent(?string $intentId, Booking $booking, int $cents, string $key): string
    {
        $refund = $this->stripe->refunds->create(
            ['payment_intent' => $intentId, 'amount' => $cents, 'metadata' => ['booking' => $booking->public_id]],
            // One refund per payment, even if the owner presses the button twice.
            ['idempotency_key' => $key],
        );

        return $refund->id;
    }
}
