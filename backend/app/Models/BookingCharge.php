<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A charge to the customer's saved card on top of the deposit hold: tolls or tickets that
 * arrive after the hold was settled, damage, a late cancellation fee. Failed tries are kept too.
 */
class BookingCharge extends Model
{
    public const SUCCEEDED = 'succeeded';

    public const FAILED = 'failed';

    protected $fillable = ['reason', 'note', 'amount_usd', 'status', 'stripe_payment_intent_id', 'failure'];

    protected function casts(): array
    {
        return ['amount_usd' => 'float'];
    }

    /** @return BelongsTo<Booking, $this> */
    public function booking(): BelongsTo
    {
        return $this->belongsTo(Booking::class);
    }

    public function reasonLabel(): string
    {
        return Booking::reasonLabels([$this->reason]);
    }
}
