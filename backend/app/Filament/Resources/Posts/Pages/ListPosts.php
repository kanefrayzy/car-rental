<?php

namespace App\Filament\Resources\Posts\Pages;

use App\Filament\Resources\Posts\PostResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListPosts extends ListRecords
{
    protected static string $resource = PostResource::class;

    public function getTitle(): string
    {
        return 'Blog';
    }

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->label('New post'),
        ];
    }
}
