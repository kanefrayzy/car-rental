<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Enums\DocumentType;
use App\Mail\BookingRequestConfirmation;
use App\Mail\DocumentsUploaded;
use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class BookingUploadTest extends TestCase
{
    use RefreshDatabase;

    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Mail::fake();
        config(['rental.owner_email' => 'owner@example.com', 'rental.frontend_url' => 'https://site.test']);
        $this->charger();
        $this->post('/api/bookings', $this->bookingPayload(), ['Accept' => 'application/json'])->assertCreated();
        $this->booking = Booking::sole();
    }

    private function upload(array $files, ?string $path = null)
    {
        return $this->post($path ?? $this->uploadPath($this->booking), $files, ['Accept' => 'application/json']);
    }

    public function test_the_confirmation_email_links_to_the_booking_page_on_the_website(): void
    {
        Mail::assertSent(BookingRequestConfirmation::class, function (BookingRequestConfirmation $mail) {
            $html = $mail->render();

            return str_contains($html, 'https://site.test/booking?booking='.$this->booking->public_id)
                && str_contains($html, 'Open your booking');
        });
    }

    public function test_the_request_returns_a_working_link_to_the_booking_page(): void
    {
        $link = $this->post('/api/bookings', $this->bookingPayload(['pickupDate' => '2026-11-02', 'returnDate' => '2026-11-04']), ['Accept' => 'application/json'])
            ->assertCreated()
            ->json('link');

        $this->getJson("/api/bookings/{$link['booking']}/upload?".http_build_query(['expires' => $link['expires'], 'signature' => $link['signature']]))
            ->assertOk()
            ->assertJson([
                'bookingId' => $link['booking'],
                'status' => 'pending_deposit',
                'days' => 2,
                'holdExpired' => false,
            ])
            ->assertJsonStructure(['holdEndsAt', 'requestedAt', 'rentalUsd', 'taxUsd', 'taxRate', 'carSlug', 'email', 'occasion']);
    }

    public function test_the_link_shows_the_booking_and_what_is_missing(): void
    {
        $this->getJson($this->uploadPath($this->booking))
            ->assertOk()
            ->assertJson([
                'bookingId' => $this->booking->public_id,
                'firstName' => 'Jordan',
                'pickupDate' => '2026-10-20',
                'acceptsUploads' => true,
                'documents' => ['license' => false, 'insurance' => false],
            ]);
    }

    public function test_uploading_both_documents_stores_them_privately_and_tells_the_owner(): void
    {
        $this->upload($this->documentFiles())
            ->assertOk()
            ->assertJsonPath('documents', ['license' => true, 'insurance' => true]);

        $booking = $this->booking->refresh()->load('documents');
        $this->assertTrue($booking->hasAllDocuments());
        $this->assertCount(2, $booking->documents);
        foreach ($booking->documents as $document) {
            Storage::disk('local')->assertExists($document->path);
            $this->assertStringStartsWith("bookings/{$booking->public_id}/", $document->path);
        }
        $this->assertSame('license.jpg', $booking->documents->firstWhere('type', DocumentType::License)->original_name);
        Mail::assertSent(DocumentsUploaded::class, fn ($mail) => $mail->hasTo('owner@example.com'));
    }

    public function test_one_document_alone_is_kept_and_the_other_is_still_asked_for(): void
    {
        $this->upload(['license' => UploadedFile::fake()->image('license.jpg')])
            ->assertUnprocessable()
            ->assertJsonPath('errors.insurance.0', 'Upload your proof of insurance.');
    }

    public function test_a_document_on_file_can_be_replaced(): void
    {
        $this->upload($this->documentFiles())->assertOk();
        $old = $this->booking->documents()->where('type', DocumentType::License)->value('path');

        $this->upload(['license' => UploadedFile::fake()->image('new-license.png')])->assertOk();

        Storage::disk('local')->assertMissing($old);
        $this->assertSame('new-license.png', $this->booking->documents()->where('type', DocumentType::License)->value('original_name'));
        $this->assertCount(2, $this->booking->documents()->get());
    }

    public function test_documents_must_be_images_or_pdfs_within_the_size_limit(): void
    {
        $this->upload($this->documentFiles(['license' => UploadedFile::fake()->create('notes.txt', 20, 'text/plain')]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.license.0', 'That file type isn’t supported. Use JPG, PNG, WebP or PDF.');

        $this->upload($this->documentFiles(['insurance' => UploadedFile::fake()->create('insurance.pdf', 10 * 1024 + 1, 'application/pdf')]))
            ->assertUnprocessable()
            ->assertJsonPath('errors.insurance.0', 'That file is too large. The limit is 10 MB.');

        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_a_tampered_or_expired_link_is_refused(): void
    {
        $this->getJson($this->uploadPath($this->booking).'x')->assertForbidden();
        $this->getJson("/api/bookings/{$this->booking->public_id}/upload")->assertForbidden();

        $path = $this->uploadPath($this->booking);
        $this->travel(config('rental.upload_link_days') + 1)->days();
        $this->upload($this->documentFiles(), $path)->assertForbidden();
        $this->assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_a_cancelled_booking_takes_no_documents(): void
    {
        $this->booking->update(['status' => BookingStatus::Cancelled]);

        $this->upload($this->documentFiles())->assertStatus(410);
        $this->assertSame([], Storage::disk('local')->allFiles());
    }
}
