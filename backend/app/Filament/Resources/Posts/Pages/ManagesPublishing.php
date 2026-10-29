<?php

namespace App\Filament\Resources\Posts\Pages;

use App\Enums\PostStatus;
use App\Models\Post;
use App\Support\BlogMarkdown;
use Carbon\CarbonImmutable;
use Filament\Actions\Action;
use Filament\Forms\Components\DateTimePicker;
use Illuminate\Support\Carbon;

/**
 * The buttons under the post editor, for the create and the edit page. Status and publish
 * time are set here, not in the form:
 *
 *  - Save draft: not on the website.
 *  - Publish: on the website now (a post published before keeps its first date).
 *  - Schedule: published, from a date and time ahead (New York time).
 *  - Save (scheduled or live post): keeps its status.
 *  - Move to drafts: takes a scheduled or live post off the website.
 */
trait ManagesPublishing
{
    /** What the button pressed asks for: draft, publish, schedule or keep. */
    protected string $intent = 'keep';

    protected ?Carbon $scheduleAt = null;

    /** @return list<Action> */
    protected function publishingActions(?Post $post): array
    {
        $state = $post?->state() ?? 'draft';

        $draft = Action::make('saveDraft')
            ->label($state === 'draft' ? 'Save draft' : 'Move to drafts')
            ->color('gray')
            ->action(fn () => $this->persist('draft'));
        if ($state !== 'draft') {
            $draft->requiresConfirmation()
                ->modalHeading('Take the post off the website?')
                ->modalDescription('It stays here as a draft; its address answers “not found” until it is published again.');
        }

        $publish = Action::make('publish')
            ->label($state === 'scheduled' ? 'Publish now' : 'Publish')
            ->color('success')
            ->action(fn () => $this->persist('publish'));

        $schedule = Action::make('schedule')
            ->label($state === 'scheduled' ? 'Reschedule' : 'Schedule')
            ->color('gray')
            ->icon('heroicon-o-clock')
            ->modalHeading('Schedule the post')
            ->modalDescription('It goes live by itself at this time, and the blog, the sitemap and the RSS feed update then.')
            ->modalSubmitActionLabel('Schedule')
            ->fillForm(fn (): array => ['published_at' => $post?->isScheduled() ? $post->published_at : now()->addDay()->setTime(9, 0)])
            ->schema([
                DateTimePicker::make('published_at')
                    ->label('Publish on (New York time)')
                    ->timezone(config('rental.timezone'))
                    ->seconds(false)
                    ->native(false)
                    ->minDate(fn () => now()->startOfDay())
                    ->after('now')
                    ->validationMessages(['after' => 'Pick a time that is still ahead.'])
                    ->required(),
            ])
            ->action(fn (array $data) => $this->persist('schedule', Carbon::parse($data['published_at'])));

        $save = Action::make('saveKeep')
            ->label('Save changes')
            ->keyBindings(['mod+s'])
            ->action(fn () => $this->persist('keep'));

        return match ($state) {
            'published' => [$save, $draft],
            'scheduled' => [$save, $publish, $schedule, $draft],
            default => [$draft->keyBindings(['mod+s']), $publish, $schedule],
        };
    }

    protected function persist(string $intent, ?Carbon $scheduleAt = null): void
    {
        $this->intent = $intent;
        $this->scheduleAt = $scheduleAt;

        $this->saveRecord();
    }

    /** Saves through the page's own create() or save(), so validation and hooks run as usual. */
    abstract protected function saveRecord(): void;

    /**
     * Applies the button to the form data.
     *
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    protected function applyPublishing(array $data, ?Post $post): array
    {
        // A pasted article that opens with "# Its title": the title field, not a second H1.
        $content = (string) ($data['content'] ?? '');
        if (($heading = BlogMarkdown::leadingHeading($content)) !== null) {
            $data['title'] = filled($data['title'] ?? null) ? $data['title'] : $heading;
            $data['content'] = BlogMarkdown::withoutLeadingHeading($content);
        }

        $publishedAt = $post?->published_at;

        return match ($this->intent) {
            'draft' => [...$data, 'status' => PostStatus::Draft],
            'publish' => [
                ...$data,
                'status' => PostStatus::Published,
                'published_at' => $publishedAt && $publishedAt->isPast() ? $publishedAt : now(),
            ],
            'schedule' => [...$data, 'status' => PostStatus::Published, 'published_at' => $this->scheduleAt],
            default => $data,
        };
    }

    protected function publishingNotificationTitle(): string
    {
        return match ($this->intent) {
            'draft' => 'Draft saved',
            'publish' => 'Published: the post is on the website',
            'schedule' => 'Scheduled for '.CarbonImmutable::parse($this->scheduleAt)->setTimezone(config('rental.timezone'))->format('M j, g:i A'),
            default => 'Saved',
        };
    }
}
