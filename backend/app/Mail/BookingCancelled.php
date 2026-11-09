<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * To the customer: the booking is cancelled. Two wordings (owner, 2026-11-10): the customer asked
 * for it ("Your booking is cancelled"), or we turned the request down or cancelled it.
 */
class BookingCancelled extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking, public ?string $ownerMessage = null, public bool $byCustomer = false) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->byCustomer ? 'Your booking is cancelled' : 'About your booking request',
            replyTo: array_filter([config('rental.owner_email')]),
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.booking.cancelled');
    }
}
