<?php

namespace App\Filament\Resources\BlockedPeriods\Pages;

use App\Filament\Resources\BlockedPeriods\BlockedPeriodResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditBlockedPeriod extends EditRecord
{
    protected static string $resource = BlockedPeriodResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make()->label('Reopen these dates'),
        ];
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
