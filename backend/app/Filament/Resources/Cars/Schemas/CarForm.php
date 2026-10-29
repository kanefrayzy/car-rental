<?php

namespace App\Filament\Resources\Cars\Schemas;

use Filament\Forms\Components\TextInput;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Schema;

class CarForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                Section::make(fn ($record): string => $record?->full_name ?? 'Car')
                    ->description('The website shows the new price within a minute or two. Requests already sent keep the price they were made at.')
                    ->schema([
                        TextInput::make('price_per_day')
                            ->label('Price per day')
                            ->prefix('$')
                            ->integer()
                            ->minValue(1)
                            ->maxValue(100000)
                            ->required(),
                    ]),
            ]);
    }
}
