<?php

namespace App\Filament\Resources\BlockedPeriods\Pages;

use App\Filament\Resources\BlockedPeriods\BlockedPeriodResource;
use Filament\Resources\Pages\CreateRecord;

class CreateBlockedPeriod extends CreateRecord
{
    protected static string $resource = BlockedPeriodResource::class;

    protected static bool $canCreateAnother = false;

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('index');
    }
}
