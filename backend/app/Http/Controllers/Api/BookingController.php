<?php

namespace App\Http\Controllers\Api;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBookingRequest;
use App\Mail\BookingRequestConfirmation;
use App\Mail\BookingRequestReceived;
use App\Models\Booking;
use App\Models\Car;
use App\Services\AvailabilityService;
use App\Support\SiteSettings;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class BookingController extends Controller
{
    /**
     * A booking request: dates, contact details and the agreement to the Rental Terms. The
     * license and insurance come afterwards, through the upload link in the customer's email
     * (BookingUploadController).
     */
    public function store(StoreBookingRequest $request, AvailabilityService $availability): JsonResponse
    {
        $car = Car::active()->where('slug', $request->validated('carSlug'))->firstOrFail();
        $pickup = $request->pickupAt();
        $return = $request->returnAt();
        $quote = $availability->quote($car, $pickup, $return);

        $booking = DB::transaction(function () use ($request, $availability, $car, $pickup, $return, $quote) {
            // Lock the car, so two people asking for the same dates at the same moment
            // cannot both pass the availability check.
            Car::whereKey($car->id)->lockForUpdate()->first();

            if (! $availability->isAvailable($car, $pickup, $return)) {
                throw new ConflictHttpException('Those dates are already booked. Try different dates.');
            }

            return $car->bookings()->create([
                'pickup_date' => $pickup->toDateString(),
                'pickup_time' => $pickup->format('H:i'),
                'return_date' => $return->toDateString(),
                'return_time' => $return->format('H:i'),
                'occasion' => $request->validated('occasion'),
                'days' => $quote['days'],
                'price_per_day' => $quote['pricePerDay'],
                'total_usd' => $quote['totalUsd'],
                'tax_rate' => $quote['taxRate'],
                'tax_usd' => $quote['taxUsd'],
                'deposit_usd' => SiteSettings::depositUsd(),
                'name' => trim(preg_replace('/\s+/', ' ', $request->validated('name'))),
                'phone' => $request->normalizedPhone(),
                'email' => strtolower(trim($request->validated('email'))),
                'terms_accepted_at' => now(),
                'status' => BookingStatus::PendingDeposit,
            ]);
        });

        $this->notify($booking);

        return response()->json([
            'bookingId' => $booking->public_id,
            'status' => $booking->status->value,
            'depositUsd' => $booking->deposit_usd,
            // The customer's private booking page; the site opens it right away.
            'link' => $booking->pageLink(),
        ], 201);
    }

    /** Emails are a courtesy: a mail failure is reported, but never fails a saved booking. */
    private function notify(Booking $booking): void
    {
        $booking->load('car');

        if ($owner = config('rental.owner_email')) {
            rescue(fn () => Mail::to($owner)->send(new BookingRequestReceived($booking)));
        }

        rescue(fn () => Mail::to($booking->email)->send(new BookingRequestConfirmation($booking)));
    }
}
