<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** To the customer: the owner turned the request down or cancelled the booking. */
class BookingCancelled extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking, public ?string $ownerMessage = null) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'About your booking request',
            replyTo: array_filter([config('rental.owner_email')]),
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.booking.cancelled');
    }
}
