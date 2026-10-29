<?php

namespace Tests\Feature;

use App\Enums\BookingStatus;
use App\Filament\Pages\Calendar;
use App\Filament\Resources\BlockedPeriods\Pages\CreateBlockedPeriod;
use App\Filament\Resources\Bookings\Pages\ListBookings;
use App\Filament\Resources\Bookings\Pages\ViewBooking;
use App\Filament\Resources\Cars\Pages\EditCar;
use App\Filament\Widgets\BookingStats;
use App\Filament\Widgets\WaitingRequests;
use App\Jobs\SendReviewRequest;
use App\Mail\BookingRequestReceived;
use App\Mail\ReviewRequest;
use App\Models\BlockedPeriod;
use App\Models\Booking;
use App\Models\User;
use Filament\Facades\Filament;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Livewire\Livewire;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private User $owner;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
        Filament::setCurrentPanel('admin');
        $this->owner = User::factory()->create();
    }

    /** A request sent through the website, with its two documents. */
    private function requestFromTheSite(): Booking
    {
        $this->charger();

        return $this->bookingWithDocuments()->load('car', 'documents');
    }

    public function test_the_panel_needs_a_sign_in(): void
    {
        $booking = $this->requestFromTheSite();

        $this->get('/be')->assertRedirect('/be/login');
        $this->get('/be/bookings')->assertRedirect('/be/login');
        $this->get("/be/documents/{$booking->public_id}/license")->assertRedirect('/be/login');
    }

    public function test_every_page_opens_for_the_owner(): void
    {
        $booking = $this->requestFromTheSite();
        BlockedPeriod::factory()->for($booking->car)->create(['starts_on' => '2026-10-27', 'ends_on' => '2026-10-28', 'note' => 'Service']);
        $this->actingAs($this->owner);

        $this->get('/be')->assertOk();
        // Dashboard widgets load after the page, so they are checked as components.
        Livewire::test(BookingStats::class)->assertSee('Waiting for you')->assertSee('Next pickup');
        Livewire::test(WaitingRequests::class)->assertCanSeeTableRecords([$booking]);
        $this->get('/be/bookings')->assertOk()->assertSee($booking->name);
        $this->get("/be/bookings/{$booking->public_id}")->assertOk()
            ->assertSee('Driver’s license', false)
            ->assertSee("/be/documents/{$booking->public_id}/insurance", false);
        $this->get('/be/calendar?month=2026-10')->assertOk()->assertSee($booking->name)->assertSee('Service');
        $this->get('/be/closed-dates')->assertOk()->assertSee('Service');
        $this->get('/be/closed-dates/create')->assertOk();
        $this->get('/be/profile')->assertOk();
    }

    public function test_the_owner_can_open_the_documents(): void
    {
        $booking = $this->requestFromTheSite();

        $this->actingAs($this->owner)
            ->get("/be/documents/{$booking->public_id}/insurance")
            ->assertOk()
            ->assertHeader('Content-Type', 'application/pdf')
            ->assertHeader('X-Content-Type-Options', 'nosniff');
    }

    public function test_confirming_from_the_booking_page(): void
    {
        $booking = $this->requestFromTheSite();
        $this->actingAs($this->owner);

        Livewire::test(ViewBooking::class, ['record' => $booking->public_id])
            ->callAction('confirm', ['notify' => false])
            ->assertNotified('Booking confirmed');

        $this->assertSame(BookingStatus::Confirmed, $booking->refresh()->status);
    }

    public function test_a_refused_change_is_explained_to_the_owner(): void
    {
        $booking = $this->requestFromTheSite();
        Booking::factory()->for($booking->car)->between('2026-10-22', '2026-10-24')->status(BookingStatus::Confirmed)->create();
        $this->actingAs($this->owner);

        Livewire::test(ViewBooking::class, ['record' => $booking->public_id])
            ->callAction('confirm', ['notify' => false])
            ->assertNotified('Not done');

        $this->assertSame(BookingStatus::PendingDeposit, $booking->refresh()->status);
    }

    public function test_declining_and_notes_from_the_list(): void
    {
        $booking = $this->requestFromTheSite();
        $this->actingAs($this->owner);

        Livewire::test(ListBookings::class)
            ->assertCanSeeTableRecords([$booking])
            ->callTableAction('editNotes', $booking, ['owner_notes' => 'Called him, wants delivery.'])
            ->callTableAction('cancel', $booking, ['notify' => false]);

        $booking->refresh();
        $this->assertSame(BookingStatus::Cancelled, $booking->status);
        $this->assertSame('Called him, wants delivery.', $booking->owner_notes);
    }

    public function test_dates_with_a_booking_cannot_be_closed(): void
    {
        $booking = $this->requestFromTheSite();
        $this->actingAs($this->owner);

        Livewire::test(CreateBlockedPeriod::class)
            ->fillForm(['car_id' => $booking->car_id, 'starts_on' => '2026-10-22', 'ends_on' => '2026-10-25'])
            ->call('create')
            ->assertHasFormErrors(['ends_on']);

        Livewire::test(CreateBlockedPeriod::class)
            ->fillForm(['car_id' => $booking->car_id, 'starts_on' => '2026-10-24', 'ends_on' => '2026-10-25', 'note' => 'Service'])
            ->call('create')
            ->assertHasNoFormErrors();

        $this->assertDatabaseHas('blocked_periods', ['note' => 'Service']);
    }

    public function test_the_owner_changes_the_price_and_the_api_serves_it(): void
    {
        $car = $this->charger(['price_per_day' => 499]);
        $this->actingAs($this->owner);

        $this->get('/be/cars')->assertOk()->assertSee('$499');
        Livewire::test(EditCar::class, ['record' => $car->getRouteKey()])
            ->fillForm(['price_per_day' => 0])
            ->call('save')
            ->assertHasFormErrors(['price_per_day'])
            ->fillForm(['price_per_day' => 549])
            ->call('save')
            ->assertHasNoFormErrors();

        $this->getJson('/api/cars')->assertJsonPath('data.0.pricePerDay', 549);
        $this->postJson('/api/availability', ['carSlug' => $car->slug, 'pickupDate' => '2026-10-20', 'returnDate' => '2026-10-22', 'pickupTime' => '10:00', 'returnTime' => '10:00'])
            ->assertJsonPath('totalUsd', 1098);
    }

    public function test_the_calendar_moves_between_months(): void
    {
        $this->actingAs($this->owner);

        Livewire::test(Calendar::class)
            ->assertSet('month', '2026-10')
            ->call('nextMonth')->assertSet('month', '2026-11')->assertSee('November 2026')
            ->call('thisMonth')->assertSet('month', '2026-10');
    }

    public function test_the_owner_email_links_to_the_booking_in_the_panel(): void
    {
        $booking = $this->requestFromTheSite();

        (new BookingRequestReceived($booking))->assertSeeInHtml("/be/bookings/{$booking->public_id}", false);
    }

    public function test_accounts_are_made_from_the_command_line(): void
    {
        $this->artisan('admin:user', ['email' => 'Owner@Example.com', '--password' => 'correct horse battery'])
            ->expectsOutput('Account created for owner@example.com.')
            ->assertExitCode(0);
        $this->artisan('admin:user', ['email' => 'owner@example.com', '--password' => 'something else', '--keep-existing' => true])
            ->assertExitCode(0);
        $this->artisan('admin:user', ['email' => 'new@example.com', '--password' => 'short'])
            ->assertExitCode(1);

        $user = User::where('email', 'owner@example.com')->sole();
        $this->assertTrue(Hash::check('correct horse battery', $user->password));
        $this->assertDatabaseMissing('users', ['email' => 'new@example.com']);
    }

    /** A rental that started before the tests' "now" (Oct 13). */
    private function rental(BookingStatus $status, array $attributes = []): Booking
    {
        return Booking::factory()->for($this->charger())->between('2026-10-10', '2026-10-13')->status($status)->create($attributes);
    }

    public function test_marking_the_car_returned_from_the_booking_page(): void
    {
        Queue::fake();
        config(['rental.review_url' => 'https://g.page/r/review']);
        $booking = $this->rental(BookingStatus::Confirmed);
        $this->actingAs($this->owner);

        Livewire::test(ViewBooking::class, ['record' => $booking->public_id])
            ->assertActionHidden('sendReviewRequest')
            ->callAction('markReturned')
            ->assertNotified('Marked as returned');

        $this->assertSame(BookingStatus::Returned, $booking->refresh()->status);
        Queue::assertPushed(SendReviewRequest::class, fn (SendReviewRequest $job) => $job->bookingId === $booking->id && $job->delay !== null);

        $this->get("/be/bookings/{$booking->public_id}")->assertOk()->assertSee('Scheduled for about Oct 13, 3:00 PM');
        Livewire::test(ListBookings::class, ['activeTab' => 'past'])->assertCanSeeTableRecords([$booking]);
    }

    public function test_a_returned_booking_is_not_cancelled_but_its_deposit_can_be_refunded(): void
    {
        $booking = $this->rental(BookingStatus::Returned, [
            'returned_at' => now(),
            'deposit_paid_at' => now()->subDays(4),
            'stripe_payment_intent_id' => 'pi_test',
        ]);
        $this->actingAs($this->owner);

        Livewire::test(ViewBooking::class, ['record' => $booking->public_id])
            ->assertActionHidden('markReturned')
            ->assertActionHidden('cancel')
            ->assertActionHidden('confirm')
            ->assertActionVisible('refundDeposit');
    }

    public function test_the_owner_sends_the_review_request_by_hand_once(): void
    {
        Mail::fake();
        config(['rental.review_url' => 'https://g.page/r/review']);
        $booking = $this->rental(BookingStatus::Returned, ['returned_at' => now()]);
        $this->actingAs($this->owner);

        Livewire::test(ViewBooking::class, ['record' => $booking->public_id])
            ->assertActionEnabled('sendReviewRequest')
            ->callAction('sendReviewRequest')
            ->assertNotified('Review request sent');

        Mail::assertSent(ReviewRequest::class, 1);
        $this->assertNotNull($booking->refresh()->review_requested_at);

        Livewire::test(ViewBooking::class, ['record' => $booking->public_id])->assertActionHidden('sendReviewRequest');
        $this->get("/be/bookings/{$booking->public_id}")->assertOk()->assertSee('Sent Oct 13, 2026 12:00 PM');
    }

    public function test_without_a_review_link_the_button_is_disabled_and_the_page_says_why(): void
    {
        config(['rental.review_url' => null]);
        $booking = $this->rental(BookingStatus::Returned, ['returned_at' => now()]);
        $this->actingAs($this->owner);

        Livewire::test(ViewBooking::class, ['record' => $booking->public_id])
            ->assertActionVisible('sendReviewRequest')
            ->assertActionDisabled('sendReviewRequest');
        $this->get("/be/bookings/{$booking->public_id}")->assertOk()->assertSee('Not sent: no review link set (GOOGLE_REVIEW_URL)');
    }

    public function test_a_confirmed_booking_shows_no_review_request(): void
    {
        $booking = $this->rental(BookingStatus::Confirmed);
        $this->actingAs($this->owner);

        $this->get("/be/bookings/{$booking->public_id}")->assertOk()->assertDontSee('Review request');
    }
}
