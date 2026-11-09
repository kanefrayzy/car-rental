<?php

namespace App\Mail;

use App\Models\Booking;
use App\Models\BookingCharge;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** To the customer: a charge to their saved card after the rental, and what it is for. */
class ExtraCharge extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking, public BookingCharge $charge) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'A charge of $'.number_format($this->charge->amount_usd, 2).' for your '.config('app.name').' rental',
            replyTo: array_filter([config('rental.owner_email')]),
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.booking.extra-charge');
    }
}
