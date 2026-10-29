<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Exceptions\BookingActionRefused;
use App\Jobs\SendReviewRequest;
use App\Mail\ReviewRequest;
use App\Models\Booking;
use App\Models\Car;
use App\Services\AvailabilityService;
use App\Services\BookingManager;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use RuntimeException;
use Tests\TestCase;

/** Marking the car returned, and the thank-you email with the review link that follows. */
class ReviewRequestTest extends TestCase
{
    use RefreshDatabase;

    private const REVIEW_URL = 'https://g.page/r/bueno-exotics/review';

    protected function setUp(): void
    {
        parent::setUp();

        config(['rental.review_url' => self::REVIEW_URL, 'rental.owner_email' => 'owner@example.com']);
    }

    private function manager(): BookingManager
    {
        return app(BookingManager::class);
    }

    /** A rental that started a few days before the tests' "now" (Oct 13). */
    private function booking(BookingStatus $status, array $attributes = []): Booking
    {
        return Booking::factory()->for(Car::first() ?? $this->charger())->between('2026-10-10', '2026-10-13')->status($status)
            ->create(['name' => 'Jordan Rivera', 'email' => 'jordan@example.com', ...$attributes]);
    }

    private function returned(array $attributes = []): Booking
    {
        return $this->booking(BookingStatus::Returned, ['returned_at' => now()->subHours(3), ...$attributes]);
    }

    public function test_marking_a_confirmed_booking_returned_queues_the_review_request_three_hours_later(): void
    {
        Queue::fake();
        $booking = $this->booking(BookingStatus::Confirmed);

        $this->manager()->markReturned($booking);

        $booking->refresh();
        $this->assertSame(BookingStatus::Returned, $booking->status);
        $this->assertTrue($booking->returned_at->equalTo(now()));
        Queue::assertPushed(SendReviewRequest::class, fn (SendReviewRequest $job) => $job->bookingId === $booking->id
            && CarbonImmutable::instance($job->delay)->equalTo(now()->addHours(3)));
    }

    public function test_the_delay_comes_from_the_config(): void
    {
        Queue::fake();
        config(['rental.review_delay_hours' => 5]);

        $this->manager()->markReturned($this->booking(BookingStatus::Confirmed));

        Queue::assertPushed(SendReviewRequest::class, fn (SendReviewRequest $job) => CarbonImmutable::instance($job->delay)->equalTo(now()->addHours(5)));
    }

    public function test_only_a_confirmed_booking_can_be_marked_returned(): void
    {
        Queue::fake();

        foreach ([BookingStatus::PendingDeposit, BookingStatus::DepositPaid, BookingStatus::Cancelled, BookingStatus::Returned] as $status) {
            $booking = $this->booking($status);
            try {
                $this->manager()->markReturned($booking);
                $this->fail("A {$status->value} booking was marked returned.");
            } catch (BookingActionRefused) {
                $this->assertSame($status, $booking->refresh()->status);
            }
        }

        Queue::assertNothingPushed();
    }

    public function test_a_rental_that_has_not_started_cannot_be_marked_returned(): void
    {
        Queue::fake();
        $booking = Booking::factory()->for($this->charger())->between('2026-10-20', '2026-10-23')->status(BookingStatus::Confirmed)->create();

        $this->expectException(BookingActionRefused::class);

        try {
            $this->manager()->markReturned($booking);
        } finally {
            $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);
            Queue::assertNothingPushed();
        }
    }

    public function test_the_job_sends_the_thank_you_once(): void
    {
        Mail::fake();
        $booking = $this->returned();

        (new SendReviewRequest($booking->id))->handle();
        (new SendReviewRequest($booking->id))->handle();

        Mail::assertSent(ReviewRequest::class, 1);
        Mail::assertSent(ReviewRequest::class, function (ReviewRequest $mail) {
            $mail->assertSeeInHtml(self::REVIEW_URL)->assertSeeInHtml('Leave a review')->assertSeeInHtml('Jordan');

            return $mail->hasTo('jordan@example.com')
                && $mail->hasReplyTo('owner@example.com')
                && $mail->hasSubject('Thanks for driving with '.config('app.name'));
        });
        $this->assertTrue($booking->refresh()->review_requested_at->equalTo(now()));
    }

    public function test_without_a_review_link_nothing_is_sent(): void
    {
        Mail::fake();
        config(['rental.review_url' => null]);
        $booking = $this->returned();

        (new SendReviewRequest($booking->id))->handle();

        Mail::assertNothingSent();
        $this->assertNull($booking->refresh()->review_requested_at);
    }

    public function test_a_booking_that_is_not_returned_gets_no_review_request(): void
    {
        Mail::fake();

        foreach ([BookingStatus::Confirmed, BookingStatus::Cancelled, BookingStatus::PendingDeposit] as $status) {
            $booking = $this->booking($status);
            (new SendReviewRequest($booking->id))->handle();
            $this->assertNull($booking->refresh()->review_requested_at);
        }

        Mail::assertNothingSent();
    }

    public function test_a_failed_send_clears_the_flag_so_a_retry_can_send(): void
    {
        $booking = $this->returned();
        Mail::shouldReceive('to')->once()->andThrow(new RuntimeException('SMTP is down'));

        try {
            (new SendReviewRequest($booking->id))->handle();
            $this->fail('The failure was swallowed, so the queue would not retry.');
        } catch (RuntimeException) {
            $this->assertNull($booking->refresh()->review_requested_at);
        }

        // Back to a working mailer (the mock replaced the real one in the container).
        $this->app->forgetInstance('mail.manager');
        Mail::clearResolvedInstances();
        Mail::fake();
        (new SendReviewRequest($booking->id))->handle();

        Mail::assertSent(ReviewRequest::class, 1);
        $this->assertNotNull($booking->refresh()->review_requested_at);
    }

    public function test_the_job_retries_a_few_times_with_a_pause(): void
    {
        $job = new SendReviewRequest(1);

        $this->assertSame(3, $job->tries);
        $this->assertNotEmpty($job->backoff);
    }

    public function test_a_returned_rental_keeps_its_dates_and_cannot_be_cancelled(): void
    {
        $booking = $this->returned();

        $this->assertFalse(app(AvailabilityService::class)->isAvailable($booking->car, $booking->pickup_date, $booking->return_date));
        $this->assertFalse($booking->isOpen());

        $this->expectException(BookingActionRefused::class);
        $this->manager()->cancel($booking, notifyCustomer: false);
    }

    public function test_an_unpaid_returned_rental_can_still_be_marked_paid(): void
    {
        $booking = $this->returned();
        $this->assertTrue($booking->rentalDue());

        $this->manager()->markRentalPaid($booking);

        $this->assertNotNull($booking->refresh()->rental_paid_at);
        $this->assertSame(BookingStatus::Returned, $booking->status);
    }

    public function test_the_customers_booking_page_says_the_car_is_back(): void
    {
        $booking = $this->returned();

        $this->getJson($this->uploadPath($booking))
            ->assertOk()
            ->assertJson([
                'status' => 'returned',
                'returnedAt' => $booking->returned_at->toIso8601String(),
                'acceptsUploads' => false,
                'rentalDue' => true,
            ]);
    }
}
