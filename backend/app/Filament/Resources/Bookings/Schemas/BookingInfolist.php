<?php

namespace App\Filament\Resources\Bookings\Schemas;

use App\Enums\BookingStatus;
use App\Filament\Resources\Bookings\BookingActions;
use App\Filament\Resources\Bookings\Tables\BookingsTable;
use App\Models\Booking;
use Filament\Infolists\Components\TextEntry;
use Filament\Infolists\Components\ViewEntry;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class BookingInfolist
{
    public static function configure(Schema $schema): Schema
    {
        $timezone = config('rental.timezone');

        return $schema
            ->columns(['default' => 1, 'lg' => 3])
            ->components([
                // Status and customer come first, so a phone shows them at the top.
                Grid::make(1)
                    ->columnSpan(1)
                    ->schema([
                        Section::make('Status')
                            ->schema([
                                TextEntry::make('status')
                                    ->hiddenLabel()
                                    ->badge()
                                    ->helperText(fn (Booking $record): ?string => $record->holdExpired()
                                        ? 'The deposit was not paid within '.config('rental.hold_hours').' hours, so the website shows these dates as free again. Confirming still checks that nobody else has taken them.'
                                        : null),
                                TextEntry::make('created_at')
                                    ->label('Received')
                                    ->dateTime('M j, Y g:i A', $timezone),
                                TextEntry::make('confirmed_at')
                                    ->label('Confirmed')
                                    ->dateTime('M j, Y g:i A', $timezone)
                                    ->visible(fn (Booking $record): bool => $record->confirmed_at !== null),
                                TextEntry::make('cancelled_at')
                                    ->label('Cancelled')
                                    ->dateTime('M j, Y g:i A', $timezone)
                                    ->visible(fn (Booking $record): bool => $record->cancelled_at !== null),
                                TextEntry::make('returned_at')
                                    ->label('Returned')
                                    ->dateTime('M j, Y g:i A', $timezone)
                                    ->visible(fn (Booking $record): bool => $record->returned_at !== null),
                                TextEntry::make('review_requested_at')
                                    ->label('Review request')
                                    ->state(fn (Booking $record): string => self::reviewRequest($record))
                                    ->visible(fn (Booking $record): bool => $record->status === BookingStatus::Returned || $record->review_requested_at !== null),
                            ]),
                        Section::make('Customer')
                            ->schema([
                                TextEntry::make('name'),
                                TextEntry::make('phone')
                                    ->formatStateUsing(fn (Booking $record): string => $record->displayPhone())
                                    ->url(fn (Booking $record): string => 'tel:'.$record->phone)
                                    ->copyable()
                                    ->copyableState(fn (Booking $record): string => $record->phone),
                                TextEntry::make('email')
                                    ->url(fn (Booking $record): string => 'mailto:'.$record->email)
                                    ->copyable(),
                            ]),
                    ]),
                Grid::make(1)
                    ->columnSpan(['lg' => 2])
                    ->schema([
                        Section::make('Rental')
                            ->columns(['default' => 1, 'sm' => 2])
                            ->schema([
                                TextEntry::make('car.full_name')->label('Car')->columnSpanFull(),
                                TextEntry::make('pickup_date')
                                    ->label('Dates')
                                    ->formatStateUsing(fn (Booking $record): string => BookingsTable::dates($record))
                                    ->helperText(fn (Booking $record): string => $record->days.' '.str('day')->plural($record->days)),
                                TextEntry::make('occasion')
                                    ->formatStateUsing(fn (Booking $record): ?string => $record->occasionLabel())
                                    ->placeholder('Not given'),
                                TextEntry::make('total_usd')
                                    ->label('Total with tax')
                                    ->state(fn (Booking $record): float => $record->totalWithTax())
                                    ->money('USD')
                                    ->helperText(fn (Booking $record): string => $record->days.' × $'.number_format($record->price_per_day)
                                        .' = $'.number_format($record->total_usd)
                                        .' + tax '.rtrim(rtrim(number_format($record->tax_rate, 3), '0'), '.').'% $'.number_format($record->tax_usd, 2)
                                        .'. Delivery beyond the free radius is extra.'),
                                TextEntry::make('rental_paid_at')
                                    ->label('Rental payment')
                                    ->state(fn (Booking $record): string => match (true) {
                                        $record->rental_refunded_at !== null => 'Refunded $'.number_format($record->rental_refunded_usd, 2),
                                        $record->rental_paid_at !== null => 'Paid '.$record->rental_paid_at->setTimezone(config('rental.timezone'))->format('M j, Y')
                                            .($record->rental_payment_intent_id ? ' by card (Stripe)' : ''),
                                        $record->rentalDue() => $record->status === BookingStatus::Returned ? 'Not paid yet' : 'Due before pickup',
                                        default => 'Asked for once you confirm',
                                    }),
                                TextEntry::make('deposit_usd')
                                    ->label('Deposit')
                                    ->money('USD', decimalPlaces: 0)
                                    ->helperText(fn (Booking $record): string => match (true) {
                                        $record->deposit_refunded_at !== null => 'Refunded $'.number_format($record->deposit_refunded_usd, 2)
                                            .' on '.$record->deposit_refunded_at->setTimezone(config('rental.timezone'))->format('M j, Y')
                                            .($record->deposit_refund_note ? ': '.$record->deposit_refund_note : ''),
                                        $record->deposit_paid_at !== null => 'Received '.$record->deposit_paid_at->setTimezone(config('rental.timezone'))->format('M j, Y')
                                            .($record->stripe_payment_intent_id ? ' by card (Stripe)' : ''),
                                        default => 'Not received yet',
                                    }),
                                TextEntry::make('public_id')->label('Reference')->copyable(),
                            ]),
                        Section::make('Documents')
                            ->description(fn (Booking $record): string => $record->hasAllDocuments()
                                ? 'Uploaded '.$record->documents_uploaded_at->setTimezone(config('rental.timezone'))->format('M j, Y g:i A').'. They open in a new tab.'
                                : 'Not uploaded yet. The customer got an upload link by email; the Send upload link button sends a fresh one.')
                            ->headerActions([BookingActions::sendUploadLink()])
                            ->schema([
                                ViewEntry::make('documents')
                                    ->hiddenLabel()
                                    ->view('filament.bookings.documents'),
                            ]),
                        Section::make('Your notes')
                            ->schema([
                                TextEntry::make('owner_notes')
                                    ->hiddenLabel()
                                    ->placeholder('No notes. Use the Notes button to add some.')
                                    ->prose(),
                            ]),
                    ]),
            ]);
    }

    /** Where the thank-you email with the review link stands. */
    private static function reviewRequest(Booking $record): string
    {
        $timezone = config('rental.timezone');

        if ($record->review_requested_at !== null) {
            return 'Sent '.$record->review_requested_at->setTimezone($timezone)->format('M j, Y g:i A');
        }
        if (blank(config('rental.review_url'))) {
            return 'Not sent: no review link set (GOOGLE_REVIEW_URL)';
        }

        $due = $record->reviewRequestDueAt();
        if ($due === null) {
            return 'Not sent yet. Use Send review request.';
        }
        // Past due and still not sent: the email failed, or the queue worker is not running.
        if ($due->isPast()) {
            return 'Not sent yet (was due about '.$due->setTimezone($timezone)->format('M j, g:i A').'). Use Send review request.';
        }

        return 'Scheduled for about '.$due->setTimezone($timezone)->format('M j, g:i A');
    }
}
