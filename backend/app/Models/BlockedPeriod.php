<?php

namespace App\Models;

use Database\Factories\BlockedPeriodFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Dates the owner closed by hand. Both end days are closed. */
class BlockedPeriod extends Model
{
    /** @use HasFactory<BlockedPeriodFactory> */
    use HasFactory;

    protected $fillable = [
        'car_id',
        'starts_on',
        'ends_on',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'starts_on' => 'immutable_date',
            'ends_on' => 'immutable_date',
        ];
    }

    /** @return BelongsTo<Car, $this> */
    public function car(): BelongsTo
    {
        return $this->belongsTo(Car::class);
    }
}
