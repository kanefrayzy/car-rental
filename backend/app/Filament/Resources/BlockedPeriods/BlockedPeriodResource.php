<?php

namespace App\Filament\Resources\BlockedPeriods;

use App\Filament\Resources\BlockedPeriods\Pages\CreateBlockedPeriod;
use App\Filament\Resources\BlockedPeriods\Pages\EditBlockedPeriod;
use App\Filament\Resources\BlockedPeriods\Pages\ListBlockedPeriods;
use App\Filament\Resources\BlockedPeriods\Schemas\BlockedPeriodForm;
use App\Filament\Resources\BlockedPeriods\Tables\BlockedPeriodsTable;
use App\Models\BlockedPeriod;
use BackedEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Table;

/** Dates the owner closes by hand. The website will not take requests for them. */
class BlockedPeriodResource extends Resource
{
    protected static ?string $model = BlockedPeriod::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedNoSymbol;

    protected static ?string $slug = 'closed-dates';

    protected static ?string $modelLabel = 'closed dates';

    protected static ?string $pluralModelLabel = 'closed dates';

    protected static ?string $navigationLabel = 'Closed dates';

    protected static ?int $navigationSort = 3;

    public static function form(Schema $schema): Schema
    {
        return BlockedPeriodForm::configure($schema);
    }

    public static function table(Table $table): Table
    {
        return BlockedPeriodsTable::configure($table);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListBlockedPeriods::route('/'),
            'create' => CreateBlockedPeriod::route('/create'),
            'edit' => EditBlockedPeriod::route('/{record}/edit'),
        ];
    }
}
