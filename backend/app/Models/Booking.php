<?php

namespace App\Models;

use App\Enums\BookingStatus;
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
        'name',
        'phone',
        'email',
        'terms_accepted_at',
        'documents_uploaded_at',
        'status',
        'stripe_payment_intent_id',
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

    /**
     * Bookings that keep their dates off the market: paid, confirmed or returned ones, and
     * unpaid requests that are still inside their hold period.
     */
    public function scopeBlocking(Builder $query): void
    {
        $holdStart = now()->subHours(config('rental.hold_hours'));

        $query->where(function (Builder $query) use ($holdStart) {
            $query
                ->whereIn('status', [BookingStatus::DepositPaid, BookingStatus::Confirmed, BookingStatus::Returned])
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

    /** "Tue, Oct 20, 2026 at 10:00 AM", for emails. */
    public function pickupLabel(): string
    {
        return $this->pickup_date->format('D, M j, Y').' at '.RentalTime::label($this->pickup_time);
    }

    public function returnLabel(): string
    {
        return $this->return_date->format('D, M j, Y').' at '.RentalTime::label($this->return_time);
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
