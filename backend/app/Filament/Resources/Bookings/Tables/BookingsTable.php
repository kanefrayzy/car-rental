<?php

namespace App\Filament\Resources\Bookings\Tables;

use App\Enums\BookingStatus;
use App\Filament\Resources\Bookings\BookingActions;
use App\Models\Booking;
use App\Support\RentalTime;
use Filament\Actions\ActionGroup;
use Filament\Actions\ViewAction;
use Filament\Forms\Components\DatePicker;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class BookingsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('created_at', 'desc')
            ->columns(self::columns())
            ->filters([
                SelectFilter::make('status')
                    ->options(BookingStatus::class)
                    ->multiple(),
                SelectFilter::make('occasion')
                    ->options(config('rental.occasions'))
                    ->multiple(),
                Filter::make('dates')
                    ->label('Rental dates')
                    ->schema([
                        DatePicker::make('from')->label('Driving on or after'),
                        DatePicker::make('until')->label('Driving on or before'),
                    ])
                    ->query(fn (Builder $query, array $data): Builder => $query
                        ->when($data['from'] ?? null, fn (Builder $query, string $from) => $query->whereDate('return_date', '>=', $from))
                        ->when($data['until'] ?? null, fn (Builder $query, string $until) => $query->whereDate('pickup_date', '<=', $until)))
                    ->indicateUsing(function (array $data): array {
                        return array_values(array_filter([
                            ($data['from'] ?? null) ? 'From '.date('M j, Y', strtotime($data['from'])) : null,
                            ($data['until'] ?? null) ? 'Until '.date('M j, Y', strtotime($data['until'])) : null,
                        ]));
                    }),
            ])
            ->recordActions([
                BookingActions::confirm()->button()->size('sm'),
                ActionGroup::make([
                    ViewAction::make()->label('Open'),
                    BookingActions::markDepositPaid(),
                    BookingActions::refundDeposit(),
                    BookingActions::markRentalPaid(),
                    BookingActions::markReturned(),
                    BookingActions::sendReviewRequest(),
                    BookingActions::editNotes(),
                    BookingActions::cancel(),
                ]),
            ])
            ->emptyStateHeading('Nothing here')
            ->emptyStateDescription('Booking requests from the website show up here.');
    }

    /** Also used by the dashboard's list of requests. */
    public static function columns(): array
    {
        return [
            // Phones get one column: name, dates and status stacked, so nothing scrolls sideways.
            TextColumn::make('summary')
                ->label('Booking')
                ->hiddenFrom('md')
                ->state(fn (Booking $record): string => $record->name)
                ->weight('medium')
                ->wrap()
                ->description(fn (Booking $record): string => self::dates($record)
                    .($record->occasion ? ' · '.$record->occasionLabel() : '')
                    .' · '.self::statusText($record)),
            TextColumn::make('status')
                ->visibleFrom('md')
                ->badge()
                ->description(fn (Booking $record): ?string => $record->holdExpired() ? 'Dates no longer held' : null),
            TextColumn::make('name')
                ->label('Customer')
                ->visibleFrom('md')
                ->searchable(['name', 'email', 'phone', 'public_id'])
                ->weight('medium')
                ->description(fn (Booking $record): string => $record->displayPhone()),
            TextColumn::make('pickup_date')
                ->label('Dates')
                ->visibleFrom('md')
                ->sortable()
                ->formatStateUsing(fn (Booking $record): string => self::dates($record))
                ->description(fn (Booking $record): string => $record->days.' '.str('day')->plural($record->days)),
            TextColumn::make('occasion')
                ->visibleFrom('xl')
                ->formatStateUsing(fn (Booking $record): ?string => $record->occasionLabel())
                ->placeholder('—'),
            TextColumn::make('total_usd')
                ->label('Total')
                ->visibleFrom('lg')
                ->state(fn (Booking $record): float => $record->totalWithTax())
                ->money('USD')
                ->description('with tax')
                ->sortable()
                ->alignEnd(),
            TextColumn::make('rental_paid_at')
                ->label('Rental')
                ->visibleFrom('xl')
                ->badge()
                ->state(fn (Booking $record): string => match (true) {
                    $record->rental_refunded_at !== null => 'Refunded',
                    $record->rental_paid_at !== null => 'Paid',
                    $record->rentalDue() => 'Due',
                    default => '—',
                })
                ->color(fn (string $state): string => match ($state) {
                    'Paid' => 'success',
                    'Due' => 'warning',
                    'Refunded' => 'info',
                    default => 'gray',
                }),
            TextColumn::make('documents_uploaded_at')
                ->label('Documents')
                ->visibleFrom('md')
                ->badge()
                ->state(fn (Booking $record): string => $record->hasAllDocuments() ? 'Uploaded' : 'Not uploaded')
                ->color(fn (string $state): string => $state === 'Uploaded' ? 'success' : 'warning'),
            TextColumn::make('deposit_paid_at')
                ->label('Deposit')
                ->visibleFrom('lg')
                ->badge()
                ->state(fn (Booking $record): string => match (true) {
                    $record->deposit_refunded_at !== null => 'Refunded',
                    $record->deposit_paid_at !== null => 'Paid',
                    default => 'Not paid',
                })
                ->color(fn (string $state): string => match ($state) {
                    'Paid' => 'success',
                    'Refunded' => 'info',
                    default => 'gray',
                }),
            TextColumn::make('created_at')
                ->label('Received')
                ->visibleFrom('lg')
                ->since(config('rental.timezone'))
                ->dateTimeTooltip('M j, Y g:i A', config('rental.timezone'))
                ->sortable(),
        ];
    }

    private static function statusText(Booking $record): string
    {
        return $record->holdExpired() ? 'Request, dates no longer held' : $record->status->getLabel();
    }

    /** "Oct 20, 10:00 AM – Oct 23, 2026, 10:00 AM" (New York time). */
    public static function dates(Booking $record): string
    {
        $from = $record->pickup_date;
        $to = $record->return_date;
        $fromTime = RentalTime::label($record->pickup_time);
        $toTime = RentalTime::label($record->return_time);

        return ($from->year === $to->year ? $from->format('M j') : $from->format('M j, Y'))
            .", {$fromTime} – ".$to->format('M j, Y').", {$toTime}";
    }
}
