<?php

namespace App\Http\Resources;

use App\Models\Car;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * The shape of `Car` in frontend/config/cars.ts.
 *
 * @mixin Car
 */
class CarResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'slug' => $this->slug,
            'name' => $this->name,
            'fullName' => $this->full_name,
            'category' => $this->category,
            'pricePerDay' => $this->price_per_day,
            'currency' => 'USD',
            'specs' => $this->specs,
            'gallery' => $this->gallery ?? [],
        ];
    }
}
