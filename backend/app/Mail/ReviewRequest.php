<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** To the customer, a few hours after the return: thanks, and a link to leave a review. */
class ReviewRequest extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking, public string $reviewUrl) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Thanks for driving with '.config('app.name'),
            replyTo: array_filter([config('rental.owner_email')]),
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.booking.review-request');
    }
}
