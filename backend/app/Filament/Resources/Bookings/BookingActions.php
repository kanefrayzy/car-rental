<?php

namespace App\Filament\Resources\Bookings;

use App\Enums\BookingStatus;
use App\Enums\HoldStatus;
use App\Exceptions\BookingActionRefused;
use App\Jobs\SendReviewRequest;
use App\Mail\DocumentsRequest;
use App\Models\Booking;
use App\Services\BookingManager;
use App\Services\DepositHolds;
use Closure;
use Filament\Actions\Action;
use Filament\Forms\Components\CheckboxList;
use Filament\Forms\Components\Radio;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Utilities\Set;
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
                // The email reads differently (owner, 2026-11-10), and only a customer's own late
                // cancellation carries the fee.
                Radio::make('cancelledBy')
                    ->label('Who is cancelling?')
                    ->options([
                        'us' => 'We are (the customer gets "We can’t go ahead with your booking")',
                        'customer' => 'The customer asked (they get "Your booking is cancelled")',
                    ])
                    ->default('us')
                    ->required()
                    ->live()
                    ->afterStateUpdated(fn (?string $state, Set $set, Booking $record) => $set('lateFee', $state === 'customer' ? self::lateFeeFor($record) : 0)),
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
                TextInput::make('lateFee')
                    ->label('Late cancellation fee')
                    ->prefix('$')
                    ->numeric()
                    ->required()
                    ->minValue(0)
                    ->maxValue(fn (): int => config('rental.deposit.max_extra_charge_usd'))
                    // Offered when the customer cancels: see lateFeeFor().
                    ->default(0)
                    ->helperText(fn (Booking $record): string => 'Charged to the saved card ('.($record->card_label ?? 'card').') before cancelling. '
                        .'Free up to '.config('rental.free_cancellation_hours').' hours before pick-up; later, one day ($'.number_format($record->price_per_day).'). '
                        .'0 charges nothing. Any hold on the card is released.')
                    ->visible(fn (Booking $record): bool => $record->usesHold() && $record->hasSavedCard()),
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
                    lateFeeUsd: (float) ($data['lateFee'] ?? 0),
                    byCustomer: ($data['cancelledBy'] ?? 'us') === 'customer',
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

    /**
     * Authorise the deposit on the saved card now: before the scheduled time, or again after a
     * failed hold (the customer may have topped up the card or called their bank).
     */
    public static function placeHoldNow(): Action
    {
        return Action::make('placeHoldNow')
            ->label(fn (Booking $record): string => $record->hold_status === HoldStatus::Failed ? 'Try hold again' : 'Place hold now')
            ->icon(Heroicon::OutlinedLockClosed)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->usesHold() && $record->hasSavedCard() && $record->isOpen()
                && in_array($record->hold_status, [HoldStatus::Scheduled, HoldStatus::Failed], true))
            ->requiresConfirmation()
            ->modalIcon(Heroicon::OutlinedLockClosed)
            ->modalHeading(fn (Booking $record): string => 'Place the $'.number_format($record->deposit_usd).' hold now?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).' The amount is authorised on '.($record->card_label ?? 'the saved card')
                .'. Nothing is charged. It is otherwise placed automatically on '.$record->holdDueAt()->format('M j \a\t g:i A').'.')
            ->modalSubmitActionLabel('Place hold')
            ->action(function (Booking $record): void {
                try {
                    $result = app(DepositHolds::class)->placeHold($record, notifyOnFailure: false);
                } catch (BookingActionRefused $refused) {
                    Notification::make()->title('Not done')->body($refused->getMessage())->danger()->persistent()->send();

                    return;
                }

                $result->status === 'held'
                    ? Notification::make()->title('Hold placed')->body('$'.number_format($record->deposit_usd).' is on hold on '.($record->card_label ?? 'the card').'.')->success()->send()
                    : Notification::make()->title('Hold failed')->body($result->reason().' The customer was not emailed; tell them, or wait for them to confirm it.')->danger()->persistent()->send();
            });
    }

    /** Gives the hold back: nothing is taken. The customer gets an email. */
    public static function releaseHold(): Action
    {
        return Action::make('releaseHold')
            ->label('Release hold')
            ->icon(Heroicon::OutlinedLockOpen)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->usesHold() && (bool) $record->hold_status?->isOpen() && $record->status !== BookingStatus::Cancelled)
            ->requiresConfirmation()
            ->modalIcon(Heroicon::OutlinedLockOpen)
            ->modalHeading(fn (Booking $record): string => $record->hold_payment_intent_id ? 'Release the $'.number_format($record->deposit_usd).' hold?' : 'Cancel the scheduled hold?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).($record->hold_payment_intent_id
                ? ' Nothing is taken and the customer gets an email. Charges that come in later can still go to the saved card with Extra charge.'
                : ' No hold is placed on the card for this booking.'))
            ->modalSubmitActionLabel('Release')
            ->action(fn (Booking $record) => self::run(
                fn (DepositHolds $holds) => $holds->release($record),
                'Hold released',
            ));
    }

    /** Takes part of the hold for an agreed reason; the rest goes back at once. */
    public static function captureHold(): Action
    {
        $reasons = collect(config('rental.charge_reasons'))
            ->filter(fn (array $reason) => $reason['capture'])
            ->map(fn (array $reason) => $reason['label'])
            ->all();

        return Action::make('captureHold')
            ->label('Capture')
            ->icon(Heroicon::OutlinedBanknotes)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->usesHold() && $record->hasCapturableHold())
            ->modalHeading('Capture from the hold?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).' The amount is charged to '.($record->card_label ?? 'the card')
                .'; the rest of the $'.number_format($record->deposit_usd).' hold is released at once. This can be done once. The customer gets an email with the reason.')
            ->modalSubmitActionLabel('Capture')
            ->schema([
                TextInput::make('amount')
                    ->label('Amount')
                    ->prefix('$')
                    ->numeric()
                    ->required()
                    ->minValue(0.01)
                    ->maxValue(fn (Booking $record): int => $record->deposit_usd)
                    ->helperText('Up to the hold. For more, capture this and add an Extra charge.'),
                CheckboxList::make('reasons')
                    ->label('Reason')
                    ->options($reasons)
                    ->columns(2)
                    ->required(),
                Textarea::make('note')
                    ->label('Details for the customer (optional)')
                    ->placeholder('For example: 2 hours late, 40 extra miles.')
                    ->rows(2)
                    ->maxLength(300),
            ])
            ->action(fn (Booking $record, array $data) => self::run(
                fn (DepositHolds $holds) => $holds->capture($record, (float) $data['amount'], $data['reasons'], $data['note'] ?? null),
                'Captured',
            ));
    }

    /** Charges the saved card on top of the hold, for a charge listed in the Rental Terms. */
    public static function extraCharge(): Action
    {
        return Action::make('extraCharge')
            ->label('Extra charge')
            ->icon(Heroicon::OutlinedCreditCard)
            ->color('gray')
            ->visible(fn (Booking $record): bool => $record->usesHold() && $record->hasSavedCard() && $record->status !== BookingStatus::PendingDeposit)
            ->modalHeading('Charge the saved card?')
            ->modalDescription(fn (Booking $record): string => self::summary($record).' Charged now to '.($record->card_label ?? 'the saved card')
                .', without the customer. Only for charges in the Rental Terms. The customer gets an email with the reason and a receipt from Stripe.')
            ->modalSubmitActionLabel('Charge card')
            ->schema([
                Select::make('reason')
                    ->label('Reason')
                    ->options(collect(config('rental.charge_reasons'))->map(fn (array $reason) => $reason['label'])->all())
                    ->required(),
                TextInput::make('amount')
                    ->label('Amount')
                    ->prefix('$')
                    ->numeric()
                    ->required()
                    ->minValue(0.01)
                    ->maxValue(fn (): int => config('rental.deposit.max_extra_charge_usd')),
                Textarea::make('note')
                    ->label('Details for the customer (optional)')
                    ->placeholder('For example: toll on the Verrazzano Bridge, Nov 14, $19.00 plus the $25 processing fee.')
                    ->rows(2)
                    ->maxLength(300),
            ])
            ->action(fn (Booking $record, array $data) => self::run(
                fn (DepositHolds $holds) => $holds->extraCharge($record, (float) $data['amount'], $data['reason'], $data['note'] ?? null),
                'Card charged',
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

    /** The Rental Terms: free up to 48 hours before pick-up, then one day's price. */
    private static function lateFeeFor(Booking $record): int
    {
        $pickup = $record->pickupAt();

        return $pickup->isFuture() && $pickup->diffInHours(now(), absolute: true) < config('rental.free_cancellation_hours')
            ? $record->price_per_day
            : 0;
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
