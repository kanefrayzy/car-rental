<?php

namespace App\Services\Deposits;

use App\Models\Booking;
use Carbon\CarbonImmutable;
use RuntimeException;
use Stripe\Exception\CardException;
use Stripe\Exception\InvalidRequestException;
use Stripe\PaymentIntent;
use Stripe\StripeClient;

/**
 * Deposit holds through Stripe: a SetupIntent saves the card with the request, and later
 * PaymentIntents with capture_method "manual" authorise it off session.
 *
 * How long a hold lasts is Stripe's `capture_before` on the charge, never a guess: for online
 * card payments 7 days, Visa 5 days (4 days 18 hours) when we start the payment without the
 * customer (docs.stripe.com/payments/place-a-hold-on-a-payment-method, read 2026-11-10).
 * Extended authorization (up to 30 days for car rentals) is requested only when
 * rental.deposit.extended_authorization is on; Stripe refuses it on accounts without access.
 */
class StripeHoldGateway implements HoldGateway
{
    /** The Visa merchant-initiated window, used only if Stripe returns no capture_before. */
    private const FALLBACK_HOLD_MINUTES = (4 * 24 + 18) * 60;

    public function __construct(
        private readonly StripeClient $stripe,
        private readonly bool $extendedAuthorization = false,
    ) {}

    public function enabled(): bool
    {
        return true;
    }

    public function startCardSetup(Booking $booking): CardSetup
    {
        $customerId = $booking->stripe_customer_id ?: $this->stripe->customers->create(
            [
                'email' => $booking->email,
                'name' => $booking->name,
                'phone' => $booking->phone,
                'description' => "Booking {$booking->public_id}",
                'metadata' => ['booking' => $booking->public_id],
            ],
            ['idempotency_key' => "customer-{$booking->public_id}"],
        )->id;

        if ($booking->stripe_setup_intent_id) {
            $existing = $this->stripe->setupIntents->retrieve($booking->stripe_setup_intent_id);
            if ($existing->customer === $customerId
                && in_array($existing->status, ['requires_payment_method', 'requires_confirmation', 'requires_action'], true)) {
                return new CardSetup($customerId, $existing->id, $existing->client_secret);
            }
        }

        $intent = $this->stripe->setupIntents->create(
            [
                'customer' => $customerId,
                // Saved for holds and charges made without the customer present.
                'usage' => 'off_session',
                // Methods come from the dashboard (cards, Apple Pay, Google Pay, Link); nothing
                // that leaves the page.
                'automatic_payment_methods' => ['enabled' => true, 'allow_redirects' => 'never'],
                'description' => "Card for the security deposit hold, booking {$booking->public_id}",
                'metadata' => ['booking' => $booking->public_id, 'purpose' => 'deposit_card'],
            ],
            // A new key once the previous setup ended, so a retry is a fresh setup.
            ['idempotency_key' => "setup-{$booking->public_id}-".substr(md5((string) $booking->stripe_setup_intent_id), 0, 8)],
        );

        return new CardSetup($customerId, $intent->id, $intent->client_secret);
    }

    public function savedCard(string $setupIntentId): ?SavedCard
    {
        $intent = $this->stripe->setupIntents->retrieve($setupIntentId, ['expand' => ['payment_method']]);
        if ($intent->status !== 'succeeded' || ! $intent->payment_method) {
            return null;
        }

        return new SavedCard($intent->payment_method->id, $this->label($intent->payment_method));
    }

    public function placeHold(Booking $booking, int $cents, string $key): HoldResult
    {
        $params = [
            'amount' => $cents,
            'currency' => 'usd',
            'customer' => $booking->stripe_customer_id,
            'payment_method' => $booking->stripe_payment_method_id,
            'off_session' => true,
            'confirm' => true,
            'capture_method' => 'manual',
            'automatic_payment_methods' => ['enabled' => true, 'allow_redirects' => 'never'],
            'description' => "Security deposit hold, booking {$booking->public_id}",
            'metadata' => ['booking' => $booking->public_id, 'purpose' => 'deposit_hold'],
            'expand' => ['latest_charge', 'payment_method'],
        ];

        if ($this->extendedAuthorization) {
            try {
                return $this->create($params + ['payment_method_options' => ['card' => ['request_extended_authorization' => 'if_available']]], "{$key}-ext");
            } catch (InvalidRequestException $error) {
                // "This account is not eligible for the requested card features": a standard hold
                // is still better than none. Logged, so the flag can be switched off.
                if (! str_contains(strtolower($error->getMessage()), 'not eligible')) {
                    throw $error;
                }
                report($error);
            }
        }

        return $this->create($params, $key);
    }

    public function holdState(string $intentId): HoldResult
    {
        return $this->result($this->stripe->paymentIntents->retrieve($intentId, ['expand' => ['latest_charge', 'payment_method']]));
    }

    public function resumeHold(string $intentId): ?string
    {
        $intent = $this->stripe->paymentIntents->retrieve($intentId);
        if (! in_array($intent->status, ['requires_payment_method', 'requires_confirmation', 'requires_action'], true)) {
            return null;
        }
        // A card the customer enters now is saved for the extra charges after the rental.
        if ($intent->setup_future_usage !== 'off_session') {
            $intent = $this->stripe->paymentIntents->update($intentId, ['setup_future_usage' => 'off_session']);
        }

        return $intent->client_secret;
    }

    public function releaseHold(string $intentId): void
    {
        $intent = $this->stripe->paymentIntents->retrieve($intentId);
        if ($intent->status === 'canceled') {
            return;
        }
        if ($intent->status === 'succeeded') {
            throw new RuntimeException('This hold was already captured, so it cannot be released.');
        }
        $this->stripe->paymentIntents->cancel($intentId, [], ['idempotency_key' => "release-{$intentId}"]);
    }

    public function captureHold(string $intentId, int $cents): void
    {
        $this->stripe->paymentIntents->capture($intentId, ['amount_to_capture' => $cents], ['idempotency_key' => "capture-{$intentId}"]);
    }

    public function chargeSavedCard(Booking $booking, int $cents, string $description, string $key): HoldResult
    {
        return $this->create([
            'amount' => $cents,
            'currency' => 'usd',
            'customer' => $booking->stripe_customer_id,
            'payment_method' => $booking->stripe_payment_method_id,
            'off_session' => true,
            'confirm' => true,
            'automatic_payment_methods' => ['enabled' => true, 'allow_redirects' => 'never'],
            'receipt_email' => $booking->email,
            'description' => $description,
            'metadata' => ['booking' => $booking->public_id, 'purpose' => 'extra_charge'],
            'expand' => ['latest_charge', 'payment_method'],
        ], $key);
    }

    /** Creates and confirms a PaymentIntent; a decline is a result, not an exception. */
    private function create(array $params, string $key): HoldResult
    {
        try {
            return $this->result($this->stripe->paymentIntents->create($params, ['idempotency_key' => $key]));
        } catch (CardException $error) {
            $failed = $error->getError();

            return new HoldResult(
                status: 'failed',
                intentId: $failed?->payment_intent?->id,
                failureCode: $failed?->decline_code ?: $failed?->code ?: $error->getStripeCode(),
                failureMessage: $error->getMessage(),
            );
        }
    }

    private function result(PaymentIntent $intent): HoldResult
    {
        $method = is_object($intent->payment_method) ? $intent->payment_method : null;
        $common = [
            'intentId' => $intent->id,
            'paymentMethodId' => $method?->id ?? (is_string($intent->payment_method) ? $intent->payment_method : null),
            'cardLabel' => $method ? $this->label($method) : null,
        ];

        $fields = match ($intent->status) {
            'requires_capture' => ['status' => 'held', 'expiresAt' => $this->captureBefore($intent)],
            'succeeded' => ['status' => 'succeeded'],
            'canceled' => ['status' => 'canceled'],
            'requires_payment_method' => [
                'status' => 'failed',
                'failureCode' => $intent->last_payment_error?->decline_code ?: $intent->last_payment_error?->code,
                'failureMessage' => $intent->last_payment_error?->message,
            ],
            'requires_action', 'requires_confirmation' => [
                'status' => 'failed',
                'failureCode' => 'authentication_required',
                'failureMessage' => 'The bank wants the customer to confirm this payment.',
            ],
            default => ['status' => 'pending'],
        };

        return new HoldResult(...$fields, ...$common);
    }

    private function captureBefore(PaymentIntent $intent): CarbonImmutable
    {
        $charge = $intent->latest_charge;
        if (is_string($charge)) {
            $charge = $this->stripe->charges->retrieve($charge);
        }
        $deadline = $charge?->payment_method_details?->card?->capture_before ?? null;

        return $deadline
            ? CarbonImmutable::createFromTimestamp($deadline)
            : CarbonImmutable::now()->addMinutes(self::FALLBACK_HOLD_MINUTES);
    }

    /** "Visa •••• 4242", "Apple Pay (Visa •••• 4242)", "Link". */
    private function label(object $method): string
    {
        if (($method->type ?? null) !== 'card' || ! isset($method->card)) {
            return ucfirst((string) ($method->type ?? 'card'));
        }
        $card = ucfirst((string) $method->card->display_brand ?: (string) $method->card->brand);
        $card = str_replace('_', ' ', $card)." •••• {$method->card->last4}";
        $wallet = $method->card->wallet->type ?? null;

        return $wallet ? ucwords(str_replace('_', ' ', $wallet))." ({$card})" : $card;
    }
}
