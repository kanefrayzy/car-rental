<?php

namespace App\Jobs;

use App\Enums\BookingStatus;
use App\Mail\ReviewRequest;
use App\Models\Booking;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * The thank-you email with the review link, queued with a delay when the owner marks the car
 * returned (BookingManager::markReturned), or run at once from the panel's button. Sends at
 * most once per booking, however many times it runs.
 */
class SendReviewRequest implements ShouldQueue
{
    use Queueable;

    /** A few tries for a mail server that is down for a moment. */
    public int $tries = 3;

    /** @var list<int> seconds */
    public array $backoff = [60, 600];

    /** The id, not the model: the job reloads the booking when it runs, hours later. */
    public function __construct(public int $bookingId) {}

    public function handle(): void
    {
        $url = config('rental.review_url');
        $booking = Booking::with('car')->find($this->bookingId);

        if (blank($url) || ! $booking || $booking->status !== BookingStatus::Returned || $booking->review_requested_at !== null) {
            return;
        }

        // Claim it first: of two runs at the same moment, only the one that sets the flag sends.
        $claimed = Booking::whereKey($booking->id)
            ->where('status', BookingStatus::Returned)
            ->whereNull('review_requested_at')
            ->update(['review_requested_at' => now()]);
        if ($claimed === 0) {
            return;
        }

        try {
            Mail::to($booking->email)->send(new ReviewRequest($booking, $url));
        } catch (Throwable $error) {
            // Not sent: let the next try (or the owner's button) have it.
            Booking::whereKey($booking->id)->update(['review_requested_at' => null]);

            throw $error;
        }
    }
}
