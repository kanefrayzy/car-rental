<?php

namespace App\Http\Controllers\Api;

use App\Enums\BookingStatus;
use App\Enums\DocumentType;
use App\Http\Controllers\Controller;
use App\Mail\DocumentsUploaded;
use App\Models\Booking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\GoneHttpException;

/**
 * The customer's booking page: its status, and the document upload. Reachable only through
 * the signed, expiring link returned with the request and sent in every email
 * (Booking::pageUrl()); the website's /booking page passes the signature on. The route has `signed:relative`, so the same link
 * works behind the proxy and on a developer machine.
 */
class BookingUploadController extends Controller
{
    public function show(Booking $booking): JsonResponse
    {
        return response()->json($this->describe($booking));
    }

    public function store(Request $request, Booking $booking): JsonResponse
    {
        if (! $booking->acceptsUploads()) {
            throw new GoneHttpException('This booking is closed, so it no longer takes documents. Call us if you need help.');
        }

        $uploads = config('rental.uploads');
        $limit = $uploads['max_kb'] / 1024;
        $existing = $booking->documents()->pluck('type')->map->value->all();
        $rules = [];
        $messages = [];

        foreach (DocumentType::cases() as $type) {
            // A document already on file may be replaced, not left out; a missing one is required.
            $rules[$type->value] = [
                Rule::requiredIf(! in_array($type->value, $existing, true)),
                'file',
                // "mimes" looks at the file's real content, not the extension the browser claims.
                'mimes:'.implode(',', $uploads['mimes']),
                'max:'.$uploads['max_kb'],
            ];
            $messages["{$type->value}.required"] = "Upload your {$type->noun()}.";
            $messages["{$type->value}.mimes"] = 'That file type isn’t supported. Use JPG, PNG, WebP or PDF.';
            $messages["{$type->value}.max"] = "That file is too large. The limit is {$limit} MB.";
            $messages["{$type->value}.uploaded"] = "That file couldn’t be uploaded. The limit is {$limit} MB.";
        }

        $request->validate($rules, $messages);
        $disk = $uploads['disk'];

        foreach (DocumentType::cases() as $type) {
            $file = $request->file($type->value);
            if (! $file) {
                continue;
            }

            // Stored under a random name on the private disk; the customer's file name is
            // kept only as a label.
            $path = $file->store("bookings/{$booking->public_id}", $disk);
            if ($path === false) {
                throw new RuntimeException("Could not store the {$type->value} upload.");
            }

            $previous = $booking->documents()->where('type', $type)->first();
            $booking->documents()->updateOrCreate(['type' => $type], [
                'disk' => $disk,
                'path' => $path,
                'original_name' => mb_substr(basename($file->getClientOriginalName()), 0, 150),
                'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
                'size' => $file->getSize(),
            ]);
            if ($previous) {
                Storage::disk($previous->disk)->delete($previous->path);
            }
        }

        $booking->load('documents');
        if ($booking->documents->count() === count(DocumentType::cases())) {
            $booking->forceFill(['documents_uploaded_at' => now()])->save();

            if ($owner = config('rental.owner_email')) {
                // A courtesy: a mail failure is reported, but never fails a saved upload.
                rescue(fn () => Mail::to($owner)->send(new DocumentsUploaded($booking->load('car'))));
            }
        }

        return response()->json($this->describe($booking));
    }

    /** What the booking page shows: status, price, payments and which documents are on file. */
    private function describe(Booking $booking): array
    {
        $onFile = $booking->documents()->pluck('type')->map->value->all();

        return [
            'bookingId' => $booking->public_id,
            'status' => $booking->status->value,
            'firstName' => strtok($booking->name, ' '),
            'email' => $booking->email,
            'carSlug' => $booking->car->slug,
            'carName' => $booking->car->full_name,
            'pickupDate' => $booking->pickup_date->toDateString(),
            'pickupTime' => $booking->pickup_time,
            'returnDate' => $booking->return_date->toDateString(),
            'returnTime' => $booking->return_time,
            'occasion' => $booking->occasion,
            'requestedAt' => $booking->created_at?->toIso8601String(),
            // Set once the owner marks the car returned (status "returned").
            'returnedAt' => $booking->returned_at?->toIso8601String(),
            // An unpaid request holds the dates until then; null once the deposit is paid.
            'holdEndsAt' => $booking->holdEndsAt()?->toIso8601String(),
            'holdExpired' => $booking->holdExpired(),
            'days' => $booking->days,
            'pricePerDay' => $booking->price_per_day,
            'rentalUsd' => (float) $booking->total_usd,
            'taxRate' => (float) $booking->tax_rate,
            'taxUsd' => (float) $booking->tax_usd,
            'acceptsUploads' => $booking->acceptsUploads(),
            // The page also takes the deposit while the request is waiting for it.
            'depositUsd' => $booking->deposit_usd,
            'awaitingDeposit' => $booking->status === BookingStatus::PendingDeposit,
            'depositPaid' => $booking->deposit_paid_at !== null,
            // ...and the rental itself once the owner has confirmed.
            'rentalTotalUsd' => $booking->totalWithTax(),
            'rentalDue' => $booking->rentalDue(),
            'rentalPaid' => $booking->rental_paid_at !== null,
            'documents' => collect(DocumentType::cases())
                ->mapWithKeys(fn (DocumentType $type) => [$type->value => in_array($type->value, $onFile, true)])
                ->all(),
        ];
    }
}
