<?php

namespace App\Models;

use App\Enums\BookingStatus;
use App\Enums\HoldStatus;
use App\Support\RentalTime;
use Carbon\CarbonInterface;
use Database\Factories\BookingFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\URL;

class Booking extends Model
{
    /** @use HasFactory<BookingFactory> */
    use HasFactory, HasUlids;

    protected $fillable = [
        'car_id',
        'pickup_date',
        'pickup_time',
        'return_date',
        'return_time',
        'occasion',
        'days',
        'price_per_day',
        'total_usd',
        'tax_rate',
        'tax_usd',
        'deposit_usd',
        'deposit_mode',
        'name',
        'phone',
        'email',
        'terms_accepted_at',
        'documents_uploaded_at',
        'status',
        'stripe_payment_intent_id',
        'stripe_customer_id',
        'stripe_setup_intent_id',
        'stripe_payment_method_id',
        'card_label',
        'card_saved_at',
        'hold_authorized_at',
        'hold_status',
        'hold_payment_intent_id',
        'hold_pending_intent_id',
        'hold_attempts',
        'hold_placed_at',
        'hold_expires_at',
        'hold_failed_at',
        'hold_failure',
        'hold_released_at',
        'hold_captured_usd',
        'hold_captured_at',
        'hold_capture_reason',
        'hold_reminded_at',
        'deposit_paid_at',
        'deposit_refunded_usd',
        'deposit_refunded_at',
        'deposit_refund_note',
        'rental_payment_intent_id',
        'rental_paid_at',
        'rental_refunded_usd',
        'rental_refunded_at',
        'confirmed_at',
        'cancelled_at',
        'returned_at',
        'review_requested_at',
        'documents_deleted_at',
        'owner_notes',
    ];

    protected function casts(): array
    {
        return [
            'pickup_date' => 'immutable_date',
            'return_date' => 'immutable_date',
            'days' => 'integer',
            'price_per_day' => 'integer',
            'total_usd' => 'integer',
            'tax_rate' => 'float',
            'tax_usd' => 'float',
            'deposit_usd' => 'integer',
            'status' => BookingStatus::class,
            'deposit_paid_at' => 'immutable_datetime',
            'deposit_refunded_usd' => 'float',
            'deposit_refunded_at' => 'immutable_datetime',
            'rental_paid_at' => 'immutable_datetime',
            'rental_refunded_usd' => 'float',
            'rental_refunded_at' => 'immutable_datetime',
            'confirmed_at' => 'immutable_datetime',
            'cancelled_at' => 'immutable_datetime',
            'returned_at' => 'immutable_datetime',
            'review_requested_at' => 'immutable_datetime',
            'documents_deleted_at' => 'immutable_datetime',
            'terms_accepted_at' => 'immutable_datetime',
            'documents_uploaded_at' => 'immutable_datetime',
            'card_saved_at' => 'immutable_datetime',
            'hold_authorized_at' => 'immutable_datetime',
            'hold_status' => HoldStatus::class,
            'hold_attempts' => 'integer',
            'hold_placed_at' => 'immutable_datetime',
            'hold_expires_at' => 'immutable_datetime',
            'hold_failed_at' => 'immutable_datetime',
            'hold_released_at' => 'immutable_datetime',
            'hold_captured_usd' => 'float',
            'hold_captured_at' => 'immutable_datetime',
            'hold_reminded_at' => 'immutable_datetime',
        ];
    }

    /** Only public_id is a ULID; the primary key stays an auto-increment integer. */
    public function uniqueIds(): array
    {
        return ['public_id'];
    }

    /** Bookings are addressed by their public reference in URLs, never by numeric id. */
    public function getRouteKeyName(): string
    {
        return 'public_id';
    }

    /** @return BelongsTo<Car, $this> */
    public function car(): BelongsTo
    {
        return $this->belongsTo(Car::class);
    }

    /** @return HasMany<BookingDocument, $this> */
    public function documents(): HasMany
    {
        return $this->hasMany(BookingDocument::class);
    }

    /** @return HasMany<BookingCharge, $this> */
    public function charges(): HasMany
    {
        return $this->hasMany(BookingCharge::class);
    }

    /** The deposit is a hold on a saved card (since 2026-11-10), not a charge. */
    public function usesHold(): bool
    {
        return $this->deposit_mode === 'hold';
    }

    /** The card saved with the request, which holds and extra charges go to. */
    public function hasSavedCard(): bool
    {
        return $this->card_saved_at !== null && $this->stripe_payment_method_id !== null && $this->stripe_customer_id !== null;
    }

    /** When the hold is (or was to be) placed: some hours before pick-up. */
    public function holdDueAt(): CarbonInterface
    {
        return $this->pickupAt()->subHours(config('rental.deposit.hold_hours_before_pickup'));
    }

    /** Until when the owner keeps the hold after the return, to check the car. */
    public function holdNeededUntil(): CarbonInterface
    {
        return $this->returnAt()->addHours(config('rental.deposit.inspection_hours_after_return'));
    }

    /** A hold the owner can capture or release right now. */
    public function hasCapturableHold(): bool
    {
        return $this->hold_payment_intent_id !== null
            && in_array($this->hold_status, [HoldStatus::OnHold, HoldStatus::Failed], true)
            && ($this->hold_expires_at === null || $this->hold_expires_at->isFuture());
    }

    /** "Captured $120 (Tolls, Fuel)", "On hold", ... as the admin panel shows the deposit. */
    public function holdSummary(): string
    {
        if ($this->hold_status === null) {
            return $this->status === BookingStatus::Cancelled ? 'No card' : 'Waiting for card';
        }

        return match ($this->hold_status) {
            HoldStatus::Captured => 'Captured $'.rtrim(rtrim(number_format($this->hold_captured_usd, 2), '0'), '.')
                .($this->hold_capture_reason ? " ({$this->hold_capture_reason})" : ''),
            default => $this->hold_status->getLabel(),
        };
    }

    /** "Tolls, Fuel" for reason keys from rental.charge_reasons. */
    public static function reasonLabels(array $keys): string
    {
        $reasons = config('rental.charge_reasons');

        return collect($keys)->map(fn (string $key) => $reasons[$key]['label'] ?? $key)->join(', ');
    }

    /**
     * Bookings that keep their dates off the market: paid, confirmed or returned ones, and
     * unpaid requests that are still inside their hold period.
     */
    public function scopeBlocking(Builder $query): void
    {
        $holdStart = now()->subHours(config('rental.hold_hours'));

        $query->where(function (Builder $query) use ($holdStart) {
            $query
                ->whereIn('status', [BookingStatus::DepositPaid, BookingStatus::CardSaved, BookingStatus::Confirmed, BookingStatus::Returned])
                ->orWhere(function (Builder $query) use ($holdStart) {
                    $query
                        ->where('status', BookingStatus::PendingDeposit)
                        ->where('created_at', '>=', $holdStart);
                });
        });
    }

    /** Bookings with at least one day in the period. Both end days count. */
    public function scopeOverlapping(Builder $query, CarbonInterface $from, CarbonInterface $to): void
    {
        $query
            ->whereDate('pickup_date', '<=', $to->toDateString())
            ->whereDate('return_date', '>=', $from->toDateString());
    }

    /** An unpaid request whose hold has run out: its dates are open to others again. */
    public function holdExpired(): bool
    {
        return $this->status === BookingStatus::PendingDeposit
            && $this->created_at !== null
            && $this->created_at->lt(now()->subHours(config('rental.hold_hours')));
    }

    /** Pick-up as a moment in the business time zone. */
    public function pickupAt(): CarbonInterface
    {
        return RentalTime::at($this->pickup_date->toDateString(), $this->pickup_time);
    }

    public function returnAt(): CarbonInterface
    {
        return RentalTime::at($this->return_date->toDateString(), $this->return_time);
    }

    /**
     * "Tue, Oct 20, 2026 at 10:00 AM ET", for emails. Every time a customer reads names its
     * time zone (owner, 2026-11-10): the times are New York's, wherever the reader is.
     */
    public function pickupLabel(): string
    {
        return $this->pickup_date->format('D, M j, Y').' at '.RentalTime::label($this->pickup_time).' ET';
    }

    public function returnLabel(): string
    {
        return $this->return_date->format('D, M j, Y').' at '.RentalTime::label($this->return_time).' ET';
    }

    /** Any moment as "Thu, Nov 19, 2026 at 10:00 AM ET" (New York time). */
    public static function etLabel(CarbonInterface $moment): string
    {
        return $moment->copy()->setTimezone(config('rental.timezone'))->format('D, M j, Y \a\t g:i A').' ET';
    }

    /** "Wedding", or null when the customer did not say what the car is for. */
    public function occasionLabel(): ?string
    {
        return $this->occasion ? (config('rental.occasions')[$this->occasion] ?? $this->occasion) : null;
    }

    /** The stored +16315550142 written as (631) 555-0142. */
    public function displayPhone(): string
    {
        return preg_match('/^\+1(\d{3})(\d{3})(\d{4})$/', $this->phone, $parts)
            ? "({$parts[1]}) {$parts[2]}-{$parts[3]}"
            : $this->phone;
    }

    /** Rental plus tax. Delivery beyond the free radius is quoted separately; the deposit too. */
    public function totalWithTax(): float
    {
        return round($this->total_usd + $this->tax_usd, 2);
    }

    /** A deposit paid by card on the website, not yet given back: it can be refunded through Stripe. */
    public function depositRefundable(): bool
    {
        return $this->deposit_paid_at !== null
            && $this->stripe_payment_intent_id !== null
            && $this->deposit_refunded_at === null;
    }

    /**
     * Confirmed and not paid yet: the customer's page and email offer the card form. Still so
     * after the return, so a rental left unpaid can be settled then.
     */
    public function rentalDue(): bool
    {
        return in_array($this->status, [BookingStatus::Confirmed, BookingStatus::Returned], true)
            && $this->rental_paid_at === null;
    }

    /** A rental paid by card on the website, not yet given back. */
    public function rentalRefundable(): bool
    {
        return $this->rental_paid_at !== null
            && $this->rental_payment_intent_id !== null
            && $this->rental_refunded_at === null;
    }

    /** Both the license and the insurance are on file. */
    public function hasAllDocuments(): bool
    {
        return $this->documents_uploaded_at !== null;
    }

    /** The customer can still add or replace documents: the request is open and they still exist. */
    public function acceptsUploads(): bool
    {
        return $this->isOpen() && $this->documents_deleted_at === null;
    }

    /**
     * The values of the customer's private link to their booking page: the booking, an expiry
     * and a signature. The page passes them on to the API, which checks them against its own
     * signed route (`bookings.upload`).
     *
     * @return array{booking: string, expires: string, signature: string}
     */
    public function pageLink(): array
    {
        $signed = URL::temporarySignedRoute(
            'bookings.upload',
            now()->addDays(config('rental.upload_link_days')),
            ['booking' => $this],
            absolute: false,
        );
        parse_str((string) parse_url($signed, PHP_URL_QUERY), $query);

        return [
            'booking' => $this->public_id,
            'expires' => (string) $query['expires'],
            'signature' => (string) $query['signature'],
        ];
    }

    /**
     * The customer's booking page on the website (/booking): status, deposit, documents and
     * the rental payment in one place. Every customer email links to it.
     */
    public function pageUrl(): string
    {
        return rtrim(config('rental.frontend_url'), '/').'/booking?'.http_build_query($this->pageLink());
    }

    /** When an unpaid request stops holding its dates. */
    public function holdEndsAt(): ?CarbonInterface
    {
        return $this->status === BookingStatus::PendingDeposit && $this->created_at
            ? $this->created_at->copy()->addHours(config('rental.hold_hours'))
            : null;
    }

    /**
     * Signed links to each uploaded document, for the owner's emails.
     *
     * @return Collection<int, array{label: string, url: string}>
     */
    public function documentLinks(): Collection
    {
        return $this->documents->map(fn (BookingDocument $document) => [
            'label' => $document->type->label(),
            'url' => URL::temporarySignedRoute(
                'bookings.documents.show',
                now()->addDays(config('rental.document_link_days')),
                ['booking' => $this, 'type' => $document->type->value],
            ),
        ]);
    }

    /**
     * Confirmed or paid bookings, and requests still waiting for the owner. A returned rental
     * is finished: it is not cancelled and takes no more documents.
     */
    public function isOpen(): bool
    {
        return ! in_array($this->status, [BookingStatus::Cancelled, BookingStatus::Returned], true);
    }

    /**
     * When the thank-you email with the review link is due: some hours after the return.
     * Null once it was sent, and for bookings that are not returned.
     */
    public function reviewRequestDueAt(): ?CarbonInterface
    {
        return $this->status === BookingStatus::Returned && $this->returned_at && $this->review_requested_at === null
            ? $this->returned_at->addHours(config('rental.review_delay_hours'))
            : null;
    }
}
