<?php

namespace App\Http\Controllers\Api;

use App\Enums\BookingStatus;
use App\Exceptions\BookingActionRefused;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Services\AvailabilityService;
use App\Services\DepositHolds;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The deposit hold from the customer's booking page (deposit_mode "hold"): saving the card
 * with their agreement to the hold, and finishing a hold the bank did not approve off session.
 * Like the deposit payment, only Stripe (webhook or a server-side check) records the outcome.
 */
class CardController extends Controller
{
    /** Start saving the card. The customer must tick the hold agreement first. */
    public function store(Request $request, Booking $booking, DepositHolds $holds, AvailabilityService $availability): JsonResponse
    {
        $request->validate(
            ['acceptHold' => ['accepted']],
            ['acceptHold.accepted' => 'Agree to the $'.number_format($booking->deposit_usd).' hold to save your card.'],
        );

        abort_unless($holds->enabled(), 409, 'Card payments are not switched on yet. We’ll contact you about the deposit.');
        abort_if(
            $booking->status === BookingStatus::PendingDeposit && $booking->holdExpired()
                && ! $availability->isAvailable($booking->car, $booking->pickup_date, $booking->return_date, $booking),
            409,
            'Sorry, your dates were taken while the request waited. Send a new request for other dates.',
        );

        try {
            $setup = $holds->startCardSetup($booking);
        } catch (BookingActionRefused $refused) {
            abort(409, $refused->getMessage());
        }

        return response()->json([
            'bookingId' => $booking->public_id,
            'amountUsd' => $booking->deposit_usd,
            'clientSecret' => $setup->clientSecret,
        ]);
    }

    /** Finish a hold that failed off session: confirm it with the bank, or use another card. */
    public function resume(Booking $booking, DepositHolds $holds): JsonResponse
    {
        $secret = $holds->enabled() ? $holds->resumeForCustomer($booking) : null;
        abort_unless($secret, 409, 'This hold cannot be confirmed online any more. Call us and we’ll sort it out.');

        return response()->json([
            'bookingId' => $booking->public_id,
            'amountUsd' => $booking->deposit_usd,
            'clientSecret' => $secret,
        ]);
    }
}
