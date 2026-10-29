<?php

namespace Tests\Feature;

use App\Mail\DocumentsUploaded;
use App\Models\Booking;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

class DocumentAccessTest extends TestCase
{
    use RefreshDatabase;

    private Booking $booking;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Storage::fake('public');
        config(['rental.owner_email' => 'owner@example.com', 'rental.document_link_days' => 14]);
        $this->charger();
        $this->booking = $this->bookingWithDocuments()->load('car', 'documents');
    }

    private function signedUrl(string $type = 'license'): string
    {
        return URL::temporarySignedRoute('bookings.documents.show', now()->addDays(14), [
            'booking' => $this->booking,
            'type' => $type,
        ]);
    }

    public function test_the_documents_uploaded_email_lists_both_documents_with_links(): void
    {
        $mail = new DocumentsUploaded($this->booking);

        $mail->assertSeeInHtml('Jordan Rivera');
        $mail->assertSeeInHtml('Driver’s license', false);
        $mail->assertSeeInHtml('Proof of insurance');
        $mail->assertSeeInHtml("/api/bookings/{$this->booking->public_id}/documents/license?expires=", false);
    }

    public function test_a_signed_link_downloads_the_document(): void
    {
        $response = $this->get($this->signedUrl('license'));

        $response->assertOk();
        $response->assertDownload("license-{$this->booking->public_id}.jpg");
    }

    public function test_the_same_address_without_a_signature_is_refused(): void
    {
        $this->get("/api/bookings/{$this->booking->public_id}/documents/license")->assertForbidden();
    }

    public function test_a_tampered_link_is_refused(): void
    {
        // A valid signature for the license must not open the insurance document.
        $url = str_replace('/documents/license', '/documents/insurance', $this->signedUrl('license'));

        $this->get($url)->assertForbidden();
    }

    public function test_links_stop_working_after_they_expire(): void
    {
        $url = $this->signedUrl();

        $this->travel(15)->days();

        $this->get($url)->assertForbidden();
    }

    public function test_an_unknown_document_type_is_not_found(): void
    {
        $url = URL::temporarySignedRoute('bookings.documents.show', now()->addDay(), [
            'booking' => $this->booking,
            'type' => 'passport',
        ]);

        $this->get($url)->assertNotFound();
    }

    public function test_documents_are_not_on_the_public_disk(): void
    {
        $this->assertSame([], Storage::disk('public')->allFiles());
        $this->get('/storage/'.$this->booking->documents->first()->path)->assertNotFound();
    }
}
