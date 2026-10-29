<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\CheckAvailabilityRequest;
use App\Models\Car;
use App\Services\AvailabilityService;
use Illuminate\Http\JsonResponse;

class AvailabilityController extends Controller
{
    public function __invoke(CheckAvailabilityRequest $request, AvailabilityService $availability): JsonResponse
    {
        $car = Car::active()->where('slug', $request->validated('carSlug'))->firstOrFail();
        $pickup = $request->pickupAt();
        $return = $request->returnAt();

        return response()->json([
            'available' => $availability->isAvailable($car, $pickup, $return),
            ...$availability->quote($car, $pickup, $return),
        ]);
    }
}
