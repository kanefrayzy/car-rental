<?php

namespace Tests\Feature;

use App\Mail\BookingRequestConfirmation;
use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class MailLogoTest extends TestCase
{
    use RefreshDatabase;

    public function test_emails_carry_the_logo_inside_them_and_show_the_business_footer(): void
    {
        config(['mail.default' => 'array']);
        $booking = Booking::factory()->create(['email' => 'jordan@example.com']);

        Mail::to('jordan@example.com')->send(new BookingRequestConfirmation($booking->load('car')));

        $email = app('mailer')->getSymfonyTransport()->messages()->last()->getOriginalMessage();
        $this->assertStringContainsString('cid:bueno-logo', $email->getHtmlBody());
        $this->assertStringContainsString(config('rental.business.phone'), $email->getHtmlBody());
        $logo = collect($email->getAttachments())->first(fn ($part) => $part->getFilename() === 'bueno-logo');
        $this->assertNotNull($logo, 'The logo is not embedded.');
        $this->assertSame('inline', $logo->getDisposition());
    }

    public function test_customers_are_asked_to_reply_only_when_replies_reach_the_owner(): void
    {
        $booking = Booking::factory()->create()->load('car');

        config(['rental.owner_email' => null]);
        $html = (new BookingRequestConfirmation($booking))->render();
        $this->assertStringNotContainsString('Reply to this email', $html);
        $this->assertStringContainsString('Call or text us at '.config('rental.business.phone'), $html);

        config(['rental.owner_email' => 'owner@example.com']);
        $this->assertStringContainsString('Reply to this email', (new BookingRequestConfirmation($booking))->render());
    }
}
