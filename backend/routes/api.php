<?php

use App\Http\Controllers\Api\AvailabilityController;
use App\Http\Controllers\Api\BlogPostController;
use App\Http\Controllers\Api\BookingController;
use App\Http\Controllers\Api\BookingDocumentController;
use App\Http\Controllers\Api\BookingUploadController;
use App\Http\Controllers\Api\CarController;
use App\Http\Controllers\Api\ContactController;
use App\Http\Controllers\Api\DepositController;
use App\Http\Controllers\Api\RentalPaymentController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\StripeWebhookController;
use Illuminate\Support\Facades\Route;

/*
 * Everything the site calls. All paths are under /api.
 * The matching client is frontend/lib/api.ts.
 */
Route::middleware('throttle:api')->group(function () {
    Route::get('cars', [CarController::class, 'index']);
    Route::get('settings', [SettingsController::class, 'show']);
    Route::post('availability', AvailabilityController::class);

    // The contact form. Its own limit (5 an hour per IP) is in the controller.
    Route::post('contact', [ContactController::class, 'store']);

    Route::post('bookings', [BookingController::class, 'store'])->middleware('throttle:bookings');
    Route::post('bookings/{booking}/deposit', [DepositController::class, 'store']);
    Route::post('bookings/{booking}/rental-payment', [RentalPaymentController::class, 'store']);

    // The customer's document upload, through the signed link in their email. GET and POST
    // share one path, so one signature covers both.
    Route::get('bookings/{booking}/upload', [BookingUploadController::class, 'show'])
        ->middleware('signed:relative')
        ->name('bookings.upload');
    Route::post('bookings/{booking}/upload', [BookingUploadController::class, 'store'])
        ->middleware(['signed:relative', 'throttle:bookings']);

    // Only reachable through the signed links in the owner's email.
    Route::get('bookings/{booking}/documents/{type}', [BookingDocumentController::class, 'show'])
        ->middleware('signed')
        ->name('bookings.documents.show');
});

// The blog, read by the website's server (frontend/lib/blog.ts). It caches what it reads, but
// every page it builds comes from one address, so these get their own, larger limit.
Route::middleware('throttle:blog')->prefix('blog')->group(function () {
    Route::get('posts', [BlogPostController::class, 'index']);
    Route::get('posts/{slug}', [BlogPostController::class, 'show'])->where('slug', '[A-Za-z0-9_-]+');
    // A draft's preview link (admin panel, Preview). Signed, so the post id cannot be guessed.
    Route::get('preview/{post}', [BlogPostController::class, 'preview'])
        ->middleware('signed:relative')
        ->name('blog.preview');
});

// Called by Stripe's servers, authenticated by its signature, so not rate limited.
Route::post('stripe/webhook', StripeWebhookController::class);
