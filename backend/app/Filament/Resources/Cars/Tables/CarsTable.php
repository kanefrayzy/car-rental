<?php

namespace App\Filament\Resources\Cars\Tables;

use Filament\Actions\EditAction;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;

class CarsTable
{
    public static function configure(Table $table): Table
    {
        return $table
            ->defaultSort('position')
            ->paginated(false)
            ->columns([
                TextColumn::make('name')
                    ->label('Car')
                    ->weight('medium')
                    ->description(fn ($record): string => $record->full_name),
                TextColumn::make('price_per_day')
                    ->label('Price per day')
                    ->money('USD', decimalPlaces: 0),
            ])
            ->recordActions([
                EditAction::make()->label('Change price'),
            ]);
    }
}
