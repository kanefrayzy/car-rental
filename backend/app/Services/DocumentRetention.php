<?php

namespace App\Services;

use App\Enums\BookingStatus;
use App\Models\Booking;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Deletes customers' licences and insurance cards once they are no longer needed:
 * `rental.document_retention_days` after the return date, or after a cancellation. The
 * booking itself is kept; only the files and their records go.
 */
class DocumentRetention
{
    /** Bookings whose documents are due for deletion. */
    public function due(): Builder
    {
        $days = config('rental.document_retention_days');
        $today = today(config('rental.timezone'));

        return Booking::query()
            ->whereNull('documents_deleted_at')
            ->whereHas('documents')
            ->where(function (Builder $query) use ($days, $today) {
                $query
                    ->where(fn (Builder $query) => $query
                        ->where('status', '!=', BookingStatus::Cancelled)
                        ->whereDate('return_date', '<', $today->copy()->subDays($days)->toDateString()))
                    ->orWhere(fn (Builder $query) => $query
                        ->where('status', BookingStatus::Cancelled)
                        ->where(fn (Builder $query) => $query
                            ->where('cancelled_at', '<', now()->subDays($days))
                            // Cancelled before the panel recorded when.
                            ->orWhere(fn (Builder $query) => $query
                                ->whereNull('cancelled_at')
                                ->where('updated_at', '<', now()->subDays($days)))));
            });
    }

    /** @return int how many bookings had their documents deleted */
    public function prune(): int
    {
        $count = 0;

        $this->due()->with('documents')->chunkById(100, function ($bookings) use (&$count) {
            foreach ($bookings as $booking) {
                $this->deleteDocuments($booking);
                $count++;
            }
        });

        return $count;
    }

    public function deleteDocuments(Booking $booking): void
    {
        foreach ($booking->documents as $document) {
            Storage::disk($document->disk)->delete($document->path);
        }

        DB::transaction(function () use ($booking) {
            $booking->documents()->delete();
            $booking->update(['documents_deleted_at' => now()]);
        });

        // The folder is named after the booking and holds nothing else.
        $disk = config('rental.uploads.disk');
        Storage::disk($disk)->deleteDirectory("bookings/{$booking->public_id}");
    }
}
