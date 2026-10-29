<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Models\Booking;
use App\Services\BookingManager;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class DocumentRetentionTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        config(['rental.document_retention_days' => 180]);
        $this->charger();
    }

    /** A request through the website for 2026-10-20 to 2026-10-23, with its two files. */
    private function booking(): Booking
    {
        return $this->bookingWithDocuments()->load('documents');
    }

    public function test_documents_are_kept_until_the_period_after_the_return_date_is_over(): void
    {
        $booking = $this->booking();
        app(BookingManager::class)->confirm($booking, notifyCustomer: false);
        $paths = $booking->documents->pluck('path');

        // Return date Oct 23 + 180 days = Apr 21, 2027: still kept on that day.
        $this->travelTo('2027-04-21 16:00:00');
        $this->artisan('bookings:prune-documents')->expectsOutput('Deleted the documents of 0 booking(s).');
        $paths->each(fn (string $path) => Storage::disk('local')->assertExists($path));

        $this->travelTo('2027-04-22 16:00:00');
        $this->artisan('bookings:prune-documents')->expectsOutput('Deleted the documents of 1 booking(s).');

        $paths->each(fn (string $path) => Storage::disk('local')->assertMissing($path));
        $booking->refresh();
        $this->assertCount(0, $booking->documents);
        $this->assertNotNull($booking->documents_deleted_at);
        $this->assertSame(BookingStatus::Confirmed, $booking->status, 'The booking itself is kept.');
    }

    public function test_a_cancelled_request_loses_its_documents_after_the_period_from_cancelling(): void
    {
        $booking = $this->booking();
        app(BookingManager::class)->cancel($booking, notifyCustomer: false);

        $this->travel(179)->days();
        $this->artisan('bookings:prune-documents', ['--dry-run' => true])
            ->expectsOutput('0 booking(s) have documents past the retention period.');

        $this->travel(2)->days();
        $this->artisan('bookings:prune-documents');

        $this->assertNotNull($booking->refresh()->documents_deleted_at);
        Storage::disk('local')->assertDirectoryEmpty('bookings');
    }

    public function test_the_signed_email_links_stop_working_once_the_files_are_gone(): void
    {
        $booking = $this->booking();
        app(BookingManager::class)->cancel($booking, notifyCustomer: false);
        $this->travel(200)->days();
        $this->artisan('bookings:prune-documents');

        $this->get(\URL::temporarySignedRoute('bookings.documents.show', now()->addDay(), ['booking' => $booking, 'type' => 'license']))
            ->assertNotFound();
    }

    public function test_the_job_runs_every_night(): void
    {
        $this->artisan('schedule:list')->expectsOutputToContain('bookings:prune-documents');
    }
}
