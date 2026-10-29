<?php

namespace App\Providers\Filament;

use App\Http\Controllers\Admin\BookingDocumentController;
use Filament\Http\Middleware\Authenticate;
use Filament\Http\Middleware\AuthenticateSession;
use Filament\Http\Middleware\DisableBladeIconComponents;
use Filament\Http\Middleware\DispatchServingFilamentEvent;
use Filament\Pages\Dashboard;
use Filament\Panel;
use Filament\PanelProvider;
use Filament\Support\Colors\Color;
use Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse;
use Illuminate\Cookie\Middleware\EncryptCookies;
use Illuminate\Foundation\Http\Middleware\PreventRequestForgery;
use Illuminate\Routing\Middleware\SubstituteBindings;
use Illuminate\Session\Middleware\StartSession;
use Illuminate\Support\Facades\Route;
use Illuminate\View\Middleware\ShareErrorsFromSession;

/** The owner's admin panel at /be: booking requests, the calendar and closed dates. */
class AdminPanelProvider extends PanelProvider
{
    public function panel(Panel $panel): Panel
    {
        return $panel
            ->default()
            ->id('admin')
            // Short and less guessable than /admin (user, 2026-10-16). deploy/Caddyfile routes it.
            ->path('be')
            ->login()
            ->profile(isSimple: false)
            ->brandName(config('app.name'))
            // The site's logo (scripts/brand.mjs writes the view), inline so it needs no file
            // from the website.
            ->brandLogo(fn () => view('filament.brand-logo'))
            ->brandLogoHeight('2.25rem')
            ->favicon('/favicon.ico')
            // The site's brand-deep blue (frontend/app/globals.css).
            ->colors([
                'primary' => Color::hex('#0566fb'),
                'gray' => Color::Slate,
                // Returned bookings (BookingStatus), apart from the other statuses' colours.
                'violet' => Color::Violet,
            ])
            ->font('DM Sans')
            ->spa()
            ->discoverResources(in: app_path('Filament/Resources'), for: 'App\Filament\Resources')
            ->discoverPages(in: app_path('Filament/Pages'), for: 'App\Filament\Pages')
            ->pages([
                Dashboard::class,
            ])
            ->discoverWidgets(in: app_path('Filament/Widgets'), for: 'App\Filament\Widgets')
            ->authenticatedRoutes(function () {
                // Customer documents, shown in the booking page. Only for a signed-in owner.
                Route::get('documents/{booking}/{type}', BookingDocumentController::class)
                    ->name('documents.show');
            })
            ->middleware([
                EncryptCookies::class,
                AddQueuedCookiesToResponse::class,
                StartSession::class,
                AuthenticateSession::class,
                ShareErrorsFromSession::class,
                PreventRequestForgery::class,
                SubstituteBindings::class,
                DisableBladeIconComponents::class,
                DispatchServingFilamentEvent::class,
            ])
            ->authMiddleware([
                Authenticate::class,
            ]);
    }
}
