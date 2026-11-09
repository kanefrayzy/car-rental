<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** To the customer: the deposit hold did not go through; confirm it on the booking page. */
class DepositHoldFailed extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Action needed: confirm the $'.number_format($this->booking->deposit_usd).' hold on your card',
            replyTo: array_filter([config('rental.owner_email')]),
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.booking.hold-failed');
    }
}
