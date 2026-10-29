<?php

namespace App\Models;

use Database\Factories\CarFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Car extends Model
{
    /** @use HasFactory<CarFactory> */
    use HasFactory;

    protected $fillable = [
        'slug',
        'name',
        'full_name',
        'category',
        'price_per_day',
        'specs',
        'gallery',
        'is_active',
        'position',
    ];

    protected function casts(): array
    {
        return [
            'price_per_day' => 'integer',
            'specs' => 'array',
            'gallery' => 'array',
            'is_active' => 'boolean',
        ];
    }

    /** @return HasMany<Booking, $this> */
    public function bookings(): HasMany
    {
        return $this->hasMany(Booking::class);
    }

    /** @return HasMany<BlockedPeriod, $this> */
    public function blockedPeriods(): HasMany
    {
        return $this->hasMany(BlockedPeriod::class);
    }

    /** Cars that can be shown and booked. */
    public function scopeActive(Builder $query): void
    {
        $query->where('is_active', true);
    }
}
