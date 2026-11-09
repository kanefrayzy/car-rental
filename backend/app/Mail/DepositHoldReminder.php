<?php

namespace App\Mail;

use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/** To the owner: a deposit hold is still open after the return; release or capture it. */
class DepositHoldReminder extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "Open hold: release or capture ({$this->booking->name}, back {$this->booking->return_date->format('M j')})",
            replyTo: [new Address($this->booking->email, $this->booking->name)],
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.booking.hold-reminder');
    }
}
