<?php

namespace App\Filament\Resources\Bookings;

use App\Enums\BookingStatus;
use App\Exceptions\BookingActionRefused;
use App\Jobs\SendReviewRequest;
use App\Mail\DocumentsRequest;
use App\Models\Booking;
use App\Services\BookingManager;
use Closure;
use Filament\Actions\Action;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\Facades\Mail;
use Throwable;

/** The owner's buttons for a booking, shared by the list and the booking page. */
class BookingActions
{
    public static function confirm(): Action
    {
        return Action::make('confirm')
            ->label('Confirm')
            ->icon(Heroicon::OutlinedCheckCircle)
            ->color('success')
            ->visible(fn (Booking $record): bool => in_array($record->status, BookingStatus::awaitingOwner(), true))
            ->modalHeading('Confirm this booking?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).' The dates stay taken on the website.')
            ->modalSubmitActionLabel('Confirm booking')
            ->schema([
                Toggle::make('notify')
                    ->label('Email the customer that the booking is confirmed')
                    ->default(true),
            ])
            ->action(fn (Booking $record, array $data) => self::run(
                fn (BookingManager $manager) => $manager->confirm($record, (bool) $data['notify']),
                'Booking confirmed',
            ));
    }

    public static function cancel(): Action
    {
        return Action::make('cancel')
            ->label(fn (Booking $record): string => $record->status === BookingStatus::Confirmed ? 'Cancel booking' : 'Decline')
            ->icon(Heroicon::OutlinedXCircle)
            ->color('danger')
            ->visible(fn (Booking $record): bool => $record->isOpen())
            ->modalHeading(fn (Booking $record): string => $record->status === BookingStatus::Confirmed ? 'Cancel this booking?' : 'Decline this request?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).' The dates open up on the website again.')
            ->modalSubmitActionLabel(fn (Booking $record): string => $record->status === BookingStatus::Confirmed ? 'Cancel booking' : 'Decline request')
            ->modalCancelActionLabel('Keep it')
            ->schema([
                TextInput::make('refundAmount')
                    ->label('Amount to refund')
                    ->prefix('$')
                    ->numeric()
                    ->required()
                    ->minValue(0)
                    ->maxValue(fn (Booking $record): int => $record->deposit_usd)
                    ->default(fn (Booking $record): int => $record->deposit_usd)
                    ->helperText(fn (Booking $record): string => 'Back to their card through Stripe. The full $'.number_format($record->deposit_usd)
                        .' deposit by default; lower it to keep a late cancellation fee, or 0 to keep all of it.')
                    ->visible(fn (Booking $record): bool => $record->depositRefundable()),
                Toggle::make('refundRental')
                    ->label(fn (Booking $record): string => 'Refund the rental payment ($'.number_format($record->totalWithTax(), 2).')')
                    ->helperText('Turn it off to keep it under the cancellation terms; refund part of it in the Stripe dashboard if needed.')
                    ->default(true)
                    ->visible(fn (Booking $record): bool => $record->rentalRefundable()),
                Toggle::make('notify')
                    ->label('Email the customer')
                    ->default(true)
                    ->live(),
                Textarea::make('message')
                    ->label('Message to the customer (optional)')
                    ->placeholder('For example: the car is already booked for part of those dates.')
                    ->rows(3)
                    ->maxLength(1000)
                    ->visible(fn ($get): bool => (bool) $get('notify')),
            ])
            ->action(fn (Booking $record, array $data) => self::run(
                fn (BookingManager $manager) => $manager->cancel(
                    $record,
                    $data['message'] ?? null,
                    (bool) $data['notify'],
                    refundDeposit: isset($data['refundAmount']),
                    refundRental: (bool) ($data['refundRental'] ?? false),
                    depositRefundUsd: isset($data['refundAmount']) ? (float) $data['refundAmount'] : null,
                ),
                $record->status === BookingStatus::Confirmed ? 'Booking cancelled' : 'Request declined',
            ));
    }

    public static function markDepositPaid(): Action
    {
        return Action::make('markDepositPaid')
            ->label('Deposit received')
            ->icon(Heroicon::OutlinedBanknotes)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->isOpen() && $record->deposit_paid_at === null)
            ->requiresConfirmation()
            ->modalHeading(fn (Booking $record): string => 'Mark the $'.number_format($record->deposit_usd).' deposit as received?')
            ->modalDescription('Use this when you took the deposit yourself: cash, Zelle or a card in person. Card payments on the website are marked automatically.')
            ->modalSubmitActionLabel('Mark as received')
            ->action(fn (Booking $record) => self::run(
                fn (BookingManager $manager) => $manager->markDepositPaid($record),
                'Deposit marked as received',
            ));
    }

    /**
     * Gives the card deposit back once the car is returned: in full, or less the fees from
     * the Rental Terms (late return, fuel, cleaning...). Goes through Stripe; one refund per booking.
     */
    public static function refundDeposit(): Action
    {
        return Action::make('refundDeposit')
            ->label('Refund deposit')
            ->icon(Heroicon::OutlinedArrowUturnLeft)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->depositRefundable() && $record->status !== BookingStatus::Cancelled)
            ->modalHeading('Refund the deposit?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).' The money goes back to the card it was paid with; the customer gets an email. This can be done once.')
            ->modalSubmitActionLabel('Refund')
            ->schema([
                TextInput::make('amount')
                    ->label('Amount to refund')
                    ->prefix('$')
                    ->numeric()
                    ->required()
                    ->minValue(0.01)
                    ->maxValue(fn (Booking $record): int => $record->deposit_usd)
                    ->default(fn (Booking $record): int => $record->deposit_usd)
                    ->helperText('Lower it to keep fees, for example $50 for an hour late.'),
                Textarea::make('note')
                    ->label('Note to the customer (optional)')
                    ->placeholder('For example: $50 kept for returning the car an hour late.')
                    ->rows(3)
                    ->maxLength(500),
            ])
            ->action(fn (Booking $record, array $data) => self::run(
                fn (BookingManager $manager) => $manager->refundDeposit($record, (float) $data['amount'], $data['note'] ?? null),
                'Deposit refunded',
            ));
    }

    /** Records a rental paid outside the website: cash, Zelle, a card in person. */
    public static function markRentalPaid(): Action
    {
        return Action::make('markRentalPaid')
            ->label('Rental paid')
            ->icon(Heroicon::OutlinedBanknotes)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->rentalDue())
            ->requiresConfirmation()
            ->modalHeading('Mark the rental as paid?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).' Use this when the customer paid $'
                .number_format($record->totalWithTax(), 2).' another way. Card payments on the website are marked automatically.')
            ->modalSubmitActionLabel('Mark as paid')
            ->action(fn (Booking $record) => self::run(
                fn (BookingManager $manager) => $manager->markRentalPaid($record),
                'Rental marked as paid',
            ));
    }

    /** The car is back. Starts the clock on the thank-you email with the review link. */
    public static function markReturned(): Action
    {
        return Action::make('markReturned')
            ->label('Mark as returned')
            ->icon(Heroicon::OutlinedFlag)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->status === BookingStatus::Confirmed)
            ->requiresConfirmation()
            ->modalIcon(Heroicon::OutlinedFlag)
            ->modalHeading('Mark the car as returned?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).' '.(filled(config('rental.review_url'))
                ? "{$record->email} gets a thank-you email with a link to leave a review about "
                    .config('rental.review_delay_hours').' '.str('hour')->plural(config('rental.review_delay_hours')).' from now.'
                : 'No thank-you email goes out: no review link is set (GOOGLE_REVIEW_URL).'))
            ->modalSubmitActionLabel('Mark as returned')
            ->action(fn (Booking $record) => self::run(
                fn (BookingManager $manager) => $manager->markReturned($record),
                'Marked as returned',
            ));
    }

    /**
     * Sends the review request now instead of waiting, or again after a failed send. The job
     * still sends it once per booking at most.
     */
    public static function sendReviewRequest(): Action
    {
        return Action::make('sendReviewRequest')
            ->label('Send review request')
            ->icon(Heroicon::OutlinedStar)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->status === BookingStatus::Returned && $record->review_requested_at === null)
            ->disabled(fn (): bool => blank(config('rental.review_url')))
            ->tooltip(fn (): ?string => blank(config('rental.review_url')) ? 'No review link is set (GOOGLE_REVIEW_URL).' : null)
            ->requiresConfirmation()
            ->modalHeading('Send the review request now?')
            ->modalDescription(fn (Booking $record): string => "{$record->email} gets a short thank-you with a link to leave a review. It goes out once per booking.")
            ->modalSubmitActionLabel('Send now')
            ->action(function (Booking $record): void {
                try {
                    // Right here rather than through the queue, so the owner sees how it went.
                    SendReviewRequest::dispatchSync($record->id);
                } catch (Throwable $error) {
                    report($error);
                }

                if ($record->refresh()->review_requested_at === null) {
                    Notification::make()
                        ->title('Not sent')
                        ->body('The email could not be sent. Try again in a few minutes.')
                        ->danger()
                        ->send();

                    return;
                }

                Notification::make()->title('Review request sent')->success()->send();
            });
    }

    /** Emails the customer a fresh link to the upload page (the one in their first email expires). */
    public static function sendUploadLink(): Action
    {
        return Action::make('sendUploadLink')
            ->label('Send upload link')
            ->icon(Heroicon::OutlinedEnvelope)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->acceptsUploads())
            ->requiresConfirmation()
            ->modalHeading('Email an upload link?')
            ->modalDescription(fn (Booking $record): string => "{$record->email} gets a link to upload (or replace) their license and insurance. It works for "
                .config('rental.upload_link_days').' days.')
            ->modalSubmitActionLabel('Send link')
            ->action(function (Booking $record) {
                Mail::to($record->email)->send(new DocumentsRequest($record->load('car')));
                Notification::make()->title('Upload link sent')->success()->send();
            });
    }

    public static function editNotes(): Action
    {
        return Action::make('editNotes')
            ->label('Notes')
            ->icon(Heroicon::OutlinedPencilSquare)
            ->color('gray')
            ->modalHeading('Your notes')
            ->modalDescription('Only you see these. The customer never does.')
            ->fillForm(fn (Booking $record): array => ['owner_notes' => $record->owner_notes])
            ->schema([
                Textarea::make('owner_notes')
                    ->hiddenLabel()
                    ->rows(6)
                    ->maxLength(5000),
            ])
            ->action(function (Booking $record, array $data): void {
                $record->update(['owner_notes' => trim((string) $data['owner_notes']) ?: null]);

                Notification::make()->title('Notes saved')->success()->send();
            });
    }

    private static function summary(Booking $record): string
    {
        return "{$record->name}, {$record->pickup_date->format('M j')} to {$record->return_date->format('M j, Y')}.";
    }

    /** Runs a booking change and tells the owner how it went. */
    private static function run(Closure $change, string $success): void
    {
        try {
            app()->call($change);
        } catch (BookingActionRefused $refused) {
            Notification::make()
                ->title('Not done')
                ->body($refused->getMessage())
                ->danger()
                ->persistent()
                ->send();

            return;
        }

        Notification::make()->title($success)->success()->send();
    }
}
