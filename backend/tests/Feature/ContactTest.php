<?php

namespace Tests\Feature;

use App\Mail\ContactMessage;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ContactTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Mail::fake();
    }

    private function send(array $overrides = [], string $ip = '203.0.113.7')
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])->postJson('/api/contact', [
            'firstName' => 'Jordan ',
            'lastName' => ' Rivera',
            'email' => 'Jordan@Example.com',
            'phone' => '(631) 555-0142',
            'occasion' => 'wedding',
            'preferredDates' => 'Jul 3 – Jul 5',
            'message' => "Is the car free on the 4th of July?\nWe need it for a wedding.",
            'company' => '',
            ...$overrides,
        ]);
    }

    public function test_a_question_is_emailed_to_the_business_with_the_sender_as_reply_to(): void
    {
        $this->send()->assertOk()->assertExactJson(['sent' => true]);

        Mail::assertSent(ContactMessage::class, function (ContactMessage $mail) {
            $html = $mail->render();

            return $mail->hasTo('info@buenoexoticsny.com')
                && $mail->hasReplyTo('jordan@example.com', 'Jordan Rivera')
                && $mail->hasSubject('New question from website: Jordan Rivera')
                && str_contains($html, 'Is the car free on the 4th of July?<br>')
                && str_contains($html, '(631) 555-0142')
                && str_contains($html, 'Wedding')
                && str_contains($html, 'Jul 3 – Jul 5');
        });
    }

    public function test_the_preferred_dates_are_optional(): void
    {
        $this->send(['preferredDates' => ''])->assertOk();

        Mail::assertSent(ContactMessage::class, fn (ContactMessage $mail) => $mail->preferredDates === null
            && str_contains($mail->render(), 'Not given'));
    }

    public function test_a_filled_honeypot_looks_sent_but_sends_nothing(): void
    {
        $this->send(['company' => 'Acme SEO'])->assertOk()->assertExactJson(['sent' => true]);

        Mail::assertNothingSent();
    }

    public function test_the_fields_are_checked(): void
    {
        $this->send(['firstName' => '', 'lastName' => '', 'email' => 'not-an-email', 'phone' => '555', 'occasion' => 'funeral', 'message' => 'Hi'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.firstName.0', 'Enter your first name.')
            ->assertJsonPath('errors.lastName.0', 'Enter your last name.')
            ->assertJsonPath('errors.email.0', 'Enter a valid email address.')
            ->assertJsonPath('errors.phone.0', 'Enter a 10-digit US phone number.')
            ->assertJsonPath('errors.occasion.0', 'Choose what it’s for from the list.')
            ->assertJsonPath('errors.message.0', 'Tell us a little more: at least 10 characters.');

        $this->send(['phone' => '', 'occasion' => '', 'message' => str_repeat('a', 2001)])
            ->assertUnprocessable()
            ->assertJsonPath('errors.phone.0', 'Enter a 10-digit US phone number.')
            ->assertJsonPath('errors.occasion.0', 'Choose what it’s for.')
            ->assertJsonPath('errors.message.0', 'That message is too long. Keep it under 2,000 characters.');

        Mail::assertNothingSent();
    }

    public function test_five_messages_an_hour_per_address(): void
    {
        // Messages that fail validation do not use up the limit.
        $this->send(['message' => 'Hi'])->assertUnprocessable();

        for ($i = 0; $i < 5; $i++) {
            $this->send()->assertOk();
        }
        $this->send()->assertTooManyRequests()
            ->assertJsonPath('message', 'You have sent several messages already. Call or text us at (631) 459-1929.');
        // Another address is not affected, and the limit lifts after an hour.
        $this->send([], '198.51.100.20')->assertOk();
        $this->travel(61)->minutes();
        $this->send()->assertOk();

        Mail::assertSentCount(7);
    }
}
