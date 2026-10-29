<?php

namespace App\Filament\Resources\Posts\Pages;

use App\Filament\Resources\Posts\PostResource;
use Filament\Resources\Pages\CreateRecord;

class CreatePost extends CreateRecord
{
    use ManagesPublishing;

    protected static string $resource = PostResource::class;

    protected static bool $canCreateAnother = false;

    public function getTitle(): string
    {
        return 'New post';
    }

    protected function getFormActions(): array
    {
        return [...$this->publishingActions(null), $this->getCancelFormAction()];
    }

    protected function saveRecord(): void
    {
        $this->create();
    }

    protected function mutateFormDataBeforeCreate(array $data): array
    {
        return $this->applyPublishing($data, null);
    }

    protected function getCreatedNotificationTitle(): ?string
    {
        return $this->publishingNotificationTitle();
    }

    protected function getRedirectUrl(): string
    {
        return $this->getResource()::getUrl('edit', ['record' => $this->getRecord()]);
    }
}
