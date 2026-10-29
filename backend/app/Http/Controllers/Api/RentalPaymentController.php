<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\Deposits\DepositGateway;
use Illuminate\Http\JsonResponse;

class RentalPaymentController extends Controller
{
    /**
     * Start paying the rental (price plus tax) of a confirmed booking. Like the deposit:
     * `clientSecret` is for Stripe's form in the browser, null while payments are off, and
     * only Stripe's webhook marks the rental as paid.
     */
    public function store(Booking $booking, DepositGateway $gateway): JsonResponse
    {
        abort_unless($booking->rentalDue(), 409, 'This booking is not waiting for payment.');

        $intent = $gateway->createRentalIntent($booking);

        if ($intent->id && $booking->rental_payment_intent_id !== $intent->id) {
            $booking->update(['rental_payment_intent_id' => $intent->id]);
        }

        return response()->json([
            'bookingId' => $booking->public_id,
            'amountUsd' => $booking->totalWithTax(),
            'clientSecret' => $intent->clientSecret,
        ]);
    }
}
