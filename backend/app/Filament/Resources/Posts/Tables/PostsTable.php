<?php

namespace App\Filament\Resources\Posts\Tables;

use App\Enums\PostStatus;
use App\Models\Post;
use Filament\Actions\Action;
use Filament\Actions\ActionGroup;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteAction;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;

class PostsTable
{
    public static function configure(Table $table): Table
    {
        $tz = config('rental.timezone');

        return $table
            ->defaultSort(fn (Builder $query) => $query->orderByRaw('published_at is null desc')->orderByDesc('published_at')->orderByDesc('id'))
            ->emptyStateHeading('No posts yet')
            ->emptyStateDescription('Write one, or paste a finished article in Markdown.')
            ->columns([
                TextColumn::make('title')
                    ->weight('medium')
                    ->searchable()
                    ->wrap()
                    ->description(fn (Post $record): string => '/blog/'.$record->slug),
                TextColumn::make('state')
                    ->label('Status')
                    ->state(fn (Post $record): string => $record->state())
                    ->badge()
                    ->formatStateUsing(fn (string $state): string => ucfirst($state))
                    ->color(fn (string $state): string => match ($state) {
                        'published' => 'success',
                        'scheduled' => 'warning',
                        default => 'gray',
                    }),
                TextColumn::make('published_at')
                    ->label('Publish date')
                    ->dateTime('M j, Y g:i A', $tz)
                    ->placeholder('—')
                    ->sortable(),
                TextColumn::make('updated_at')
                    ->label('Last saved')
                    ->since($tz)
                    ->sortable()
                    ->toggleable(),
                TextColumn::make('reading_time')
                    ->label('Read')
                    ->formatStateUsing(fn (int $state): string => "{$state} min")
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('state')
                    ->label('Status')
                    ->options(['draft' => 'Draft', 'scheduled' => 'Scheduled', 'published' => 'Published'])
                    ->query(fn (Builder $query, array $data) => match ($data['value'] ?? null) {
                        'draft' => $query->where('status', PostStatus::Draft),
                        'scheduled' => $query->where('status', PostStatus::Published)->where('published_at', '>', now()),
                        'published' => $query->live(),
                        default => $query,
                    }),
            ])
            ->recordActions([
                EditAction::make(),
                ActionGroup::make([
                    Action::make('view')
                        ->label('View on site')
                        ->icon(Heroicon::OutlinedArrowTopRightOnSquare)
                        ->url(fn (Post $record): string => $record->url(), shouldOpenInNewTab: true)
                        ->visible(fn (Post $record): bool => $record->isLive()),
                    Action::make('preview')
                        ->label('Preview')
                        ->icon(Heroicon::OutlinedEye)
                        ->url(fn (Post $record): string => $record->previewUrl(), shouldOpenInNewTab: true)
                        ->visible(fn (Post $record): bool => ! $record->isLive()),
                    DeleteAction::make()
                        ->modalDescription('The post disappears from the website at once, with its cover. This cannot be undone.'),
                ]),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make()
                        ->modalDescription('The selected posts disappear from the website at once. This cannot be undone.'),
                ]),
            ]);
    }
}
