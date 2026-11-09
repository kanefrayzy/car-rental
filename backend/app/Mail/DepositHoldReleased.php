<?php

namespace App\Mail;

use App\Enums\HoldStatus;
use App\Models\Booking;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

/**
 * To the customer: the deposit hold is settled. Released in full ("hold-released"), or partly
 * used, with the amount and the reasons ("hold-captured", owner 2026-11-10).
 */
class DepositHoldReleased extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public Booking $booking) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: $this->captured()
                ? 'Part of your $'.number_format($this->booking->deposit_usd).' hold was used'
                : 'Your $'.number_format($this->booking->deposit_usd).' hold has been released',
            replyTo: array_filter([config('rental.owner_email')]),
        );
    }

    public function content(): Content
    {
        return new Content(markdown: $this->captured() ? 'mail.booking.hold-captured' : 'mail.booking.hold-released');
    }

    private function captured(): bool
    {
        return $this->booking->hold_status === HoldStatus::Captured;
    }
}
