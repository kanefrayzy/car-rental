<?php

namespace App\Filament\Resources\Posts\Schemas;

use App\Models\Post;
use App\Services\BlogImages;
use App\Support\BlogMarkdown;
use Closure;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\MarkdownEditor;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Notifications\Notification;
use Filament\Schemas\Components\Grid;
use Filament\Schemas\Components\Group;
use Filament\Schemas\Components\Section;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Utilities\Set;
use Filament\Schemas\Components\View;
use Filament\Schemas\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;
use RuntimeException;

/**
 * The post editor: title and address, the Markdown with a live preview beside it, the
 * cover, and what search engines show. Status and publish time are not fields: the page's
 * buttons set them (Save draft, Publish, Schedule; ManagesPublishing).
 */
class PostForm
{
    public static function configure(Schema $schema): Schema
    {
        $limits = config('blog.limits');

        return $schema
            ->columns(['default' => 1, 'lg' => 3])
            ->components([
                Group::make([
                    Section::make('Post')
                        ->schema([
                            TextInput::make('title')
                                ->label('Title (the page’s H1)')
                                // A pasted article that opens with "# Its title" brings its own.
                                ->required(fn (Get $get): bool => BlogMarkdown::leadingHeading($get('content')) === null)
                                ->validationMessages(['required' => 'Give the post a title, or start the text with “# Title”.'])
                                ->maxLength($limits['title'])
                                ->live(onBlur: true)
                                ->afterStateUpdated(function (?string $state, ?string $old, Get $get, Set $set, ?Post $record) {
                                    // The address follows the title until it is edited by hand, and
                                    // never changes by itself once the post exists.
                                    if (! $record && (blank($get('slug')) || $get('slug') === Str::slug((string) $old))) {
                                        $set('slug', filled($state) ? Post::uniqueSlug($state) : null);
                                    }
                                }),
                            TextInput::make('slug')
                                ->label('Address')
                                ->prefix(fn (): string => Str::after(rtrim(explode(',', (string) config('rental.frontend_url'))[0], '/'), '://').'/blog/')
                                ->helperText(fn (?Post $record): string => $record?->isLive()
                                    ? 'Changing it keeps the old address working: it sends visitors and search engines to the new one (301).'
                                    : 'Lowercase letters, digits and hyphens. Left empty, it is made from the title.')
                                ->maxLength($limits['slug'])
                                ->regex('/^[a-z0-9]+(?:-[a-z0-9]+)*$/')
                                ->validationMessages(['regex' => 'Use lowercase letters, digits and single hyphens, like “best-car-for-prom”.'])
                                ->rule(fn (?Post $record): Closure => function (string $attribute, mixed $value, Closure $fail) use ($record) {
                                    if (in_array($value, config('blog.reserved_slugs'), true)) {
                                        $fail('This address is taken by a page of the blog. Pick another.');
                                    } elseif (Post::slugTaken((string) $value, $record?->id)) {
                                        $fail('Another post has this address, now or before a rename. Pick another.');
                                    }
                                })
                                ->live(onBlur: true),
                            Textarea::make('excerpt')
                                ->label('Excerpt')
                                ->helperText('One or two sentences for the blog list and the RSS feed. Left empty, it is taken from the first paragraph.')
                                ->rows(2)
                                ->maxLength($limits['excerpt'])
                                ->live(debounce: 400)
                                ->hint(fn (?string $state): string => self::count($state, $limits['excerpt']))
                                ->hintColor(fn (?string $state): string => self::countColor($state, $limits['excerpt'])),
                        ]),
                ])->columnSpan(['lg' => 2]),

                Group::make([
                    Section::make('Status')
                        ->schema([
                            View::make('filament.blog.status')
                                ->viewData(fn (?Post $record): array => ['post' => $record]),
                        ]),
                    Section::make('Cover')
                        ->description('Shown above the post, in the blog list and in link previews. At least '.number_format(config('blog.images.cover_min_width')).' px wide; it is saved as WebP, 1,600 px at most.')
                        ->schema([
                            FileUpload::make('cover_image')
                                ->hiddenLabel()
                                ->disk('public')
                                ->image()
                                ->acceptedFileTypes(config('blog.images.types'))
                                ->maxSize(config('blog.images.max_kb'))
                                ->rule('dimensions:min_width='.config('blog.images.cover_min_width').',max_width='.config('blog.images.max_side').',max_height='.config('blog.images.max_side'))
                                ->validationMessages([
                                    'dimensions' => 'Use a picture at least '.number_format(config('blog.images.cover_min_width')).' pixels wide and at most '.number_format(config('blog.images.max_side')).' on each side.',
                                    'max' => 'The picture is over '.(config('blog.images.max_kb') / 1024).' MB. Use a smaller one.',
                                ])
                                ->saveUploadedFileUsing(function (TemporaryUploadedFile $file): string {
                                    try {
                                        return BlogImages::store($file->getRealPath(), BlogImages::COVERS);
                                    } catch (InvalidArgumentException|RuntimeException $exception) {
                                        throw ValidationException::withMessages(['data.cover_image' => $exception->getMessage()]);
                                    }
                                })
                                // The old picture is deleted by the model once the post is saved.
                                ->deleteUploadedFileUsing(fn () => null)
                                ->imagePreviewHeight('170'),
                            TextInput::make('cover_alt')
                                ->label('Describe the picture (alt text)')
                                ->placeholder('Silver Dodge Charger Hellcat Widebody outside a wedding venue')
                                ->helperText('For screen readers and image search. Left empty, the title is used.')
                                ->maxLength($limits['cover_alt']),
                        ]),
                ])->columnSpan(['lg' => 1]),

                Section::make('Text')
                    ->description('Markdown. Paste a finished article as it is: a first line “# Title” becomes the title. Use ## for sections (they make the table of contents) and ### below them. Drop, paste or attach pictures (JPG, PNG, WebP up to '.(config('blog.images.max_kb') / 1024).' MB) and describe each between the square brackets: ![What the picture shows](…).')
                    ->columnSpanFull()
                    ->schema([
                        Grid::make(['default' => 1, 'xl' => 2])->schema([
                            MarkdownEditor::make('content')
                                ->hiddenLabel()
                                ->required()
                                ->live(debounce: 700)
                                ->minHeight('34rem')
                                ->toolbarButtons([
                                    ['bold', 'italic', 'strike', 'link'],
                                    ['heading'],
                                    ['blockquote', 'codeBlock', 'bulletList', 'orderedList'],
                                    ['table', 'attachFiles'],
                                    ['undo', 'redo'],
                                ])
                                ->fileAttachmentsDisk('public')
                                ->fileAttachmentsDirectory(BlogImages::CONTENT)
                                ->fileAttachmentsAcceptedFileTypes(config('blog.images.types'))
                                ->fileAttachmentsMaxSize(config('blog.images.max_kb'))
                                ->saveUploadedFileAttachmentUsing(function (TemporaryUploadedFile $file): ?string {
                                    try {
                                        return BlogImages::store($file->getRealPath(), BlogImages::CONTENT);
                                    } catch (InvalidArgumentException|RuntimeException $exception) {
                                        Notification::make()->title($exception->getMessage())->danger()->send();

                                        return null;
                                    }
                                }),
                            View::make('filament.blog.preview')
                                ->viewData(fn (Get $get): array => [
                                    'title' => $get('title') ?: BlogMarkdown::leadingHeading($get('content')),
                                    'html' => BlogMarkdown::previewHtml(BlogMarkdown::withoutLeadingHeading((string) $get('content'))),
                                    'readingTime' => BlogMarkdown::readingTime((string) $get('content')),
                                    'imagesWithoutAlt' => preg_match_all('/!\[\s*\]\(/', (string) $get('content')),
                                ]),
                        ]),
                    ]),

                Section::make('Search engines')
                    ->description('What Google shows for the post. Left empty, the title and the excerpt are used.')
                    ->columnSpanFull()
                    ->schema([
                        Grid::make(['default' => 1, 'xl' => 2])->schema([
                            Group::make([
                                TextInput::make('meta_title')
                                    ->label('SEO title')
                                    ->placeholder(fn (Get $get): string => self::defaultSearchTitle($get))
                                    ->maxLength($limits['meta_title'])
                                    ->live(debounce: 400)
                                    ->hint(fn (?string $state): string => self::count($state, $limits['meta_title']))
                                    ->hintColor(fn (?string $state): string => self::countColor($state, $limits['meta_title'])),
                                Textarea::make('meta_description')
                                    ->label('SEO description')
                                    ->placeholder(fn (Get $get): string => (string) ($get('excerpt') ?: BlogMarkdown::excerpt((string) $get('content'))))
                                    ->rows(3)
                                    ->maxLength($limits['meta_description'])
                                    ->live(debounce: 400)
                                    ->hint(fn (?string $state): string => self::count($state, $limits['meta_description']))
                                    ->hintColor(fn (?string $state): string => self::countColor($state, $limits['meta_description'])),
                            ]),
                            View::make('filament.blog.snippet')
                                ->viewData(fn (Get $get): array => [
                                    'title' => $get('meta_title') ?: self::defaultSearchTitle($get),
                                    'url' => rtrim(explode(',', (string) config('rental.frontend_url'))[0], '/').'/blog/'.($get('slug') ?: Str::slug((string) $get('title'))),
                                    'description' => $get('meta_description') ?: ($get('excerpt') ?: BlogMarkdown::excerpt((string) $get('content'))),
                                ]),
                        ]),
                    ]),
            ]);
    }

    /** What Post::searchTitle() gives while the SEO title is empty. */
    private static function defaultSearchTitle(Get $get): string
    {
        $title = (string) ($get('title') ?: BlogMarkdown::leadingHeading($get('content')));

        return (new Post(['title' => $title]))->searchTitle();
    }

    private static function count(?string $state, int $limit): string
    {
        return mb_strlen((string) $state).' / '.$limit;
    }

    private static function countColor(?string $state, int $limit): string
    {
        $length = mb_strlen((string) $state);

        return match (true) {
            $length === 0 => 'gray',
            $length > $limit => 'danger',
            $length >= $limit * 0.9 => 'warning',
            default => 'success',
        };
    }
}
