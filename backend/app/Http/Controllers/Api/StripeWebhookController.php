<?php

namespace App\Http\Controllers\Api;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\BookingManager;
use App\Services\DepositHolds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Stripe\Exception\SignatureVerificationException;
use Stripe\Webhook;
use UnexpectedValueException;

class StripeWebhookController extends Controller
{
    /**
     * Stripe calls this when something happens to a payment. It is the only thing that
     * marks a deposit as paid: the browser saying "payment succeeded" is never trusted.
     * The endpoint in the Stripe dashboard sends payment_intent.succeeded, charge.refunded and, for
     * deposit holds, setup_intent.succeeded, payment_intent.amount_capturable_updated,
     * payment_intent.canceled and payment_intent.payment_failed
     * (among others, which are acknowledged and ignored).
     */
    public function __invoke(Request $request, BookingManager $manager, DepositHolds $holds): JsonResponse
    {
        $secret = config('services.stripe.webhook_secret');
        abort_unless($secret, 503, 'Stripe webhooks are not configured.');

        try {
            $event = Webhook::constructEvent(
                $request->getContent(),
                (string) $request->header('Stripe-Signature'),
                $secret,
            );
        } catch (SignatureVerificationException|UnexpectedValueException) {
            abort(400, 'Invalid Stripe signature.');
        }

        $object = $event->data->object;

        // Deposit holds (deposit_mode "hold"): the card saved, a hold the customer finished on
        // their page, a hold Stripe let lapse. Payments made by the API itself are recorded when
        // it makes them; these events are for what happens elsewhere.
        if ($event->type === 'setup_intent.succeeded') {
            $this->cardSaved($object->id, $holds);
        }
        if (in_array($event->type, ['payment_intent.amount_capturable_updated', 'payment_intent.canceled'], true)
            && ($booking = Booking::where('hold_pending_intent_id', $object->id)->orWhere('hold_payment_intent_id', $object->id)->first())) {
            $event->type === 'payment_intent.canceled'
                ? $holds->holdCanceled($booking, $object->id)
                : $holds->holdConfirmed($booking, $object->id);

            return response()->json(['received' => true]);
        }

        // "succeeded" for an immediate charge, "amount_capturable_updated" for a card hold.
        if (in_array($event->type, ['payment_intent.succeeded', 'payment_intent.amount_capturable_updated'], true)) {
            $this->paymentSucceeded($object->id, $manager);
        }

        // A refund made in the Stripe dashboard instead of the admin panel: record it.
        if ($event->type === 'charge.refunded' && ($object->payment_intent ?? null)) {
            Booking::query()
                ->where('rental_payment_intent_id', $object->payment_intent)
                ->whereNull('rental_refunded_at')
                ->update(['rental_refunded_usd' => $object->amount_refunded / 100, 'rental_refunded_at' => now()]);
            Booking::query()
                ->where('stripe_payment_intent_id', $object->payment_intent)
                ->whereNull('deposit_refunded_at')
                ->update([
                    'deposit_refunded_usd' => $object->amount_refunded / 100,
                    'deposit_refunded_at' => now(),
                    'deposit_refund_note' => 'Refunded in the Stripe dashboard',
                ]);
        }

        // Anything else is acknowledged, so Stripe does not keep retrying it.
        return response()->json(['received' => true]);
    }

    /** The customer saved their card for the deposit hold. */
    private function cardSaved(string $setupIntentId, DepositHolds $holds): void
    {
        $booking = Booking::where('stripe_setup_intent_id', $setupIntentId)->first();
        if ($booking && $booking->card_saved_at === null) {
            // Read back from Stripe for the card's label; the event alone is not enough.
            $holds->syncCard($booking);
        }
    }

    private function paymentSucceeded(string $intentId, BookingManager $manager): void
    {
        // The rental payment, made after the owner confirmed.
        if ($booking = Booking::where('rental_payment_intent_id', $intentId)->first()) {
            if ($booking->rental_paid_at === null) {
                $booking->update(['rental_paid_at' => now()]);
                // Cancelled while the customer was paying: give it straight back.
                if ($booking->status === BookingStatus::Cancelled) {
                    rescue(fn () => $manager->refundRental($booking));
                }
            }

            return;
        }

        $booking = Booking::where('stripe_payment_intent_id', $intentId)->first();
        if (! $booking || $booking->deposit_paid_at !== null) {
            return;
        }

        if ($booking->status === BookingStatus::PendingDeposit) {
            $booking->update(['status' => BookingStatus::DepositPaid, 'deposit_paid_at' => now()]);

            return;
        }

        // The request was declined or cancelled while the customer was paying: the money
        // goes straight back, the booking stays cancelled.
        if ($booking->status === BookingStatus::Cancelled) {
            $booking->update(['deposit_paid_at' => now()]);
            rescue(fn () => $manager->refundDeposit($booking, $booking->deposit_usd, 'Your booking was cancelled before your payment arrived, so the full deposit has been refunded.'));
        }
    }
}
