<?php

namespace App\Providers;

use App\Services\Deposits\DepositGateway;
use App\Services\Deposits\StripeDepositGateway;
use App\Services\Deposits\UnconfiguredDepositGateway;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Stripe\StripeClient;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Deposits go through Stripe once STRIPE_SECRET is set; until then nothing is charged.
        $this->app->bind(DepositGateway::class, function () {
            $secret = config('services.stripe.secret');

            return $secret
                ? new StripeDepositGateway(new StripeClient($secret), config('services.stripe.capture_method'))
                : new UnconfiguredDepositGateway;
        });
    }

    public function boot(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(
            config('rental.rate_limits.api_per_minute'),
        )->by($request->ip()));

        // Booking requests carry file uploads and send email, so they get a tighter limit.
        RateLimiter::for('bookings', fn (Request $request) => Limit::perMinute(
            config('rental.rate_limits.bookings_per_minute'),
        )->by($request->ip()));

        // The blog API: the website's server builds every blog page from one address.
        RateLimiter::for('blog', fn (Request $request) => Limit::perMinute(
            config('rental.rate_limits.blog_per_minute'),
        )->by($request->ip()));
    }
}
