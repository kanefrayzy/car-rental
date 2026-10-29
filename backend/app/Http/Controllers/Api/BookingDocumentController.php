<?php

namespace App\Http\Controllers\Api;

use App\Enums\DocumentType;
use App\Http\Controllers\Controller;
use App\Models\Booking;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class BookingDocumentController extends Controller
{
    /**
     * Download a customer's document. Reachable only through the signed, expiring links
     * in the owner's email (the route has the `signed` middleware); there is no other way in.
     */
    public function show(Booking $booking, DocumentType $type): StreamedResponse
    {
        $document = $booking->documents()->where('type', $type)->firstOrFail();
        $extension = pathinfo($document->path, PATHINFO_EXTENSION);

        return Storage::disk($document->disk)->download(
            $document->path,
            "{$type->value}-{$booking->public_id}.{$extension}",
        );
    }
}
