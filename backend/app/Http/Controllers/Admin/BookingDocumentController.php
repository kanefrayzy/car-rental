<?php

namespace App\Http\Controllers\Admin;

use App\Enums\DocumentType;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookingDocumentController extends Controller
{
    /**
     * Show a customer's document in the browser. Registered inside the admin panel, so only
     * a signed-in owner reaches it. The signed links in the owner's email are a separate
     * route (`Api\BookingDocumentController`).
     */
    public function __invoke(Booking $booking, DocumentType $type): StreamedResponse
    {
        $document = $booking->documents()->where('type', $type)->firstOrFail();
        $extension = pathinfo($document->path, PATHINFO_EXTENSION);

        return Storage::disk($document->disk)->response(
            $document->path,
            "{$type->value}-{$booking->public_id}.{$extension}",
            [
                // Uploads are checked by content when they arrive; this stops the browser
                // from guessing a different type anyway.
                'Content-Type' => $document->mime_type,
                'X-Content-Type-Options' => 'nosniff',
                'Cache-Control' => 'private, no-store',
            ],
        );
    }
}
