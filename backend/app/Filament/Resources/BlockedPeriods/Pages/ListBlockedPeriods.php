<?php

namespace App\Filament\Resources\BlockedPeriods\Pages;

use App\Filament\Resources\BlockedPeriods\BlockedPeriodResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListBlockedPeriods extends ListRecords
{
    protected static string $resource = BlockedPeriodResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->label('Close dates'),
        ];
    }
}
