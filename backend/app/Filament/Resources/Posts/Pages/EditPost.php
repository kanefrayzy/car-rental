<?php

namespace App\Filament\Resources\Posts\Pages;

use App\Filament\Resources\Posts\PostResource;
use App\Models\Post;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;
use Filament\Support\Icons\Heroicon;

/** @property Post $record */
class EditPost extends EditRecord
{
    use ManagesPublishing;

    protected static string $resource = PostResource::class;

    public function getTitle(): string
    {
        return $this->record->title;
    }

    protected function getHeaderActions(): array
    {
        return [
            Action::make('view')
                ->label('View on site')
                ->icon(Heroicon::OutlinedArrowTopRightOnSquare)
                ->color('gray')
                ->url(fn (): string => $this->record->url(), shouldOpenInNewTab: true)
                ->visible(fn (): bool => $this->record->isLive()),
            Action::make('preview')
                ->label('Preview')
                ->icon(Heroicon::OutlinedEye)
                ->color('gray')
                ->tooltip('The last saved version, as the website shows it. The link works for '.config('blog.preview_link_days').' days and is hidden from search engines.')
                ->url(fn (): string => $this->record->previewUrl(), shouldOpenInNewTab: true),
            DeleteAction::make()
                ->modalDescription('The post disappears from the website at once, with its cover. This cannot be undone.'),
        ];
    }

    protected function getFormActions(): array
    {
        return [...$this->publishingActions($this->record), $this->getCancelFormAction()];
    }

    protected function saveRecord(): void
    {
        $this->save();
    }

    protected function mutateFormDataBeforeSave(array $data): array
    {
        return $this->applyPublishing($data, $this->record);
    }

    protected function getSavedNotificationTitle(): ?string
    {
        return $this->publishingNotificationTitle();
    }

    /** Reloads the page, so the status box and the buttons match the new status. */
    protected function getRedirectUrl(): ?string
    {
        return $this->getResource()::getUrl('edit', ['record' => $this->record]);
    }
}
