<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\SiteSettings;
use Illuminate\Http\JsonResponse;

/** The values from the admin panel's Settings page that the website shows. */
class SettingsController extends Controller
{
    public function show(): JsonResponse
    {
        return response()->json([
            'depositUsd' => SiteSettings::depositUsd(),
            // "hold" (a card authorisation, the default) or "charge"; config/rental.php.
            'depositMode' => config('rental.deposit.mode'),
            'instagramUrl' => SiteSettings::instagramUrl(),
        ]);
    }
}
