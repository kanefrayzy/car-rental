<?php

namespace App\Http\Controllers\Api;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\AvailabilityService;
use App\Services\Deposits\DepositGateway;
use Illuminate\Http\JsonResponse;

class DepositController extends Controller
{
    /**
     * Start paying the deposit for a booking. `clientSecret` is what Stripe's payment form
     * needs in the browser; it is null while payments are not switched on.
     */
    public function store(Booking $booking, DepositGateway $gateway, AvailabilityService $availability): JsonResponse
    {
        abort_unless(
            $booking->status === BookingStatus::PendingDeposit,
            409,
            'This booking is not waiting for a deposit.',
        );

        // An unpaid request holds its dates for a while only. Past that, someone else may have
        // taken them: no payment for dates the booking no longer has.
        abort_if(
            $booking->holdExpired() && ! $availability->isAvailable($booking->car, $booking->pickup_date, $booking->return_date, $booking),
            409,
            'Sorry, your dates were taken while the request waited for its deposit. Send a new request for other dates.',
        );

        $intent = $gateway->createIntent($booking);

        if ($intent->id && $booking->stripe_payment_intent_id !== $intent->id) {
            $booking->update(['stripe_payment_intent_id' => $intent->id]);
        }

        return response()->json([
            'bookingId' => $booking->public_id,
            'amountUsd' => $booking->deposit_usd,
            'clientSecret' => $intent->clientSecret,
        ]);
    }
}
