<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Address;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;

/** To the business: a question from the website's contact form. "Reply" answers the sender. */
class ContactMessage extends Mailable
{
    use Queueable;

    public function __construct(
        public string $name,
        public string $email,
        public string $phone,
        public string $occasion,
        public ?string $preferredDates,
        public string $body,
    ) {}

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: "New question from website: {$this->name}",
            replyTo: [new Address($this->email, $this->name)],
        );
    }

    public function content(): Content
    {
        return new Content(markdown: 'mail.contact.message');
    }
}
