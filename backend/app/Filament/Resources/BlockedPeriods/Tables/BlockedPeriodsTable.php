<?php

namespace App\Filament\Resources\BlockedPeriods\Tables;

use App\Models\BlockedPeriod;
use App\Models\Car;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\TernaryFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class BlockedPeriodsTable
{
    public static function configure(Table $table): Table
    {
        $today = today(config('rental.timezone'))->toDateString();

        return $table
            ->defaultSort('starts_on')
            ->columns([
                TextColumn::make('starts_on')
                    ->label('Dates')
                    ->sortable()
                    ->formatStateUsing(fn (BlockedPeriod $record): string => $record->starts_on->equalTo($record->ends_on)
                        ? $record->starts_on->format('M j, Y')
                        : $record->starts_on->format('M j').' – '.$record->ends_on->format('M j, Y'))
                    ->description(function (BlockedPeriod $record): string {
                        $days = (int) $record->starts_on->diffInDays($record->ends_on) + 1;

                        return $days.' '.str('day')->plural($days);
                    }),
                TextColumn::make('note')
                    ->label('Reason')
                    ->placeholder('—'),
                TextColumn::make('car.name')
                    ->label('Car')
                    ->visible(fn (): bool => Car::count() > 1),
            ])
            ->filters([
                TernaryFilter::make('upcoming')
                    ->label('Show')
                    ->placeholder('All')
                    ->trueLabel('Today and later')
                    ->falseLabel('Past')
                    ->default(true)
                    ->queries(
                        true: fn (Builder $query) => $query->whereDate('ends_on', '>=', $today),
                        false: fn (Builder $query) => $query->whereDate('ends_on', '<', $today),
                        blank: fn (Builder $query) => $query,
                    ),
            ])
            ->recordActions([
                EditAction::make(),
                DeleteAction::make()->label('Reopen')->modalHeading('Reopen these dates?')->modalDescription('Customers can request them on the website again.'),
            ])
            ->emptyStateHeading('No closed dates')
            ->emptyStateDescription('Close dates when the car is not available: service, a private trip. The website will not take requests for them.');
    }
}
