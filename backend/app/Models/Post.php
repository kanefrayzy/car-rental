<?php

namespace App\Models;

use App\Enums\PostStatus;
use App\Jobs\RevalidateBlog;
use App\Services\BlogImages;
use App\Support\BlogMarkdown;
use Database\Factories\PostFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\Str;

/**
 * A blog post. Visible on the website when it is published and its publish time has come
 * (scopeLive); a published post with a later time is scheduled. Saving keeps the derived
 * fields up to date (slug, reading time, excerpt), keeps the old address of a live post
 * working after a slug change (PostSlugRedirect), and tells the website when what it shows
 * has changed (RevalidateBlog).
 *
 * @property PostStatus $status
 * @property Carbon|null $published_at
 */
class Post extends Model
{
    /** @use HasFactory<PostFactory> */
    use HasFactory;

    protected $fillable = [
        'title',
        'slug',
        'excerpt',
        'content',
        'cover_image',
        'cover_alt',
        'meta_title',
        'meta_description',
        'status',
        'published_at',
    ];

    protected $attributes = [
        'status' => 'draft',
        'content' => '',
    ];

    /** Whether the save in progress changes anything (set while saving; `wasChanged()` can be stale). */
    private bool $changesOnSave = false;

    protected function casts(): array
    {
        return [
            'status' => PostStatus::class,
            'published_at' => 'datetime',
            'revalidated_at' => 'datetime',
            'reading_time' => 'integer',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Post $post) {
            $post->changesOnSave = ! $post->exists || $post->isDirty();
            $post->slug = filled($post->slug) ? Str::slug($post->slug) : static::uniqueSlug($post->title, $post->id);
            $post->reading_time = BlogMarkdown::readingTime((string) $post->content);
            if (blank($post->excerpt)) {
                $post->excerpt = BlogMarkdown::excerpt((string) $post->content) ?: null;
            }
            // The website hears about it now (saved, below), so blog:revalidate-due can skip it.
            if ($post->changesOnSave && $post->isLive()) {
                $post->revalidated_at = now();
            }
        });

        static::updating(function (Post $post) {
            if (! $post->isDirty('slug')) {
                return;
            }
            // The post takes back an address it had before: that is no longer a redirect.
            $post->redirects()->where('old_slug', $post->slug)->delete();
            // Links and search results point at the old address of a live post: send them on.
            if ($post->wasLive()) {
                PostSlugRedirect::updateOrCreate(['old_slug' => $post->getOriginal('slug')], ['post_id' => $post->id]);
            }
        });

        static::updated(function (Post $post) {
            if ($post->wasChanged('cover_image')) {
                BlogImages::delete($post->getOriginal('cover_image'));
            }
        });

        static::saved(function (Post $post) {
            if ($post->changesOnSave && ($post->wasLive() || $post->isLive())) {
                RevalidateBlog::dispatch(array_values(array_filter([$post->getOriginal('slug'), $post->slug])))->afterCommit();
            }
        });

        static::deleted(function (Post $post) {
            BlogImages::delete($post->cover_image);
            if ($post->isLive()) {
                RevalidateBlog::dispatch([$post->slug])->afterCommit();
            }
        });
    }

    /** @return HasMany<PostSlugRedirect, $this> */
    public function redirects(): HasMany
    {
        return $this->hasMany(PostSlugRedirect::class);
    }

    /** Posts the website shows: published, with the publish time come. */
    public function scopeLive(Builder $query): void
    {
        $query->where('status', PostStatus::Published)
            ->whereNotNull('published_at')
            ->where('published_at', '<=', now());
    }

    /** Newest first, as the blog lists them. */
    public function scopeNewestFirst(Builder $query): void
    {
        $query->orderByDesc('published_at')->orderByDesc('id');
    }

    public function isLive(): bool
    {
        return $this->status === PostStatus::Published && $this->published_at?->lte(now());
    }

    public function isScheduled(): bool
    {
        return $this->status === PostStatus::Published && $this->published_at?->isFuture();
    }

    /** Whether the website showed this post before the change being saved. */
    public function wasLive(): bool
    {
        // A post being created has no original values (until its save is over).
        $status = $this->getOriginal('status');
        $publishedAt = $this->getOriginal('published_at');

        return $status === PostStatus::Published && $publishedAt instanceof Carbon && $publishedAt->lte(now());
    }

    /** draft, scheduled or published: what the admin panel shows. */
    public function state(): string
    {
        return match (true) {
            $this->isLive() => 'published',
            $this->isScheduled() => 'scheduled',
            default => 'draft',
        };
    }

    /** The title in search results: the SEO title if set, else the title with the site's name if it fits. */
    public function searchTitle(): string
    {
        if (filled($this->meta_title)) {
            return $this->meta_title;
        }

        $withName = "{$this->title} | ".config('app.name');

        return mb_strlen($withName) <= config('blog.limits.meta_title') ? $withName : $this->title;
    }

    public function searchDescription(): string
    {
        return (string) ($this->meta_description ?: $this->excerpt);
    }

    /** The post's address on the website. */
    public function url(): string
    {
        return self::frontendUrl()."/blog/{$this->slug}";
    }

    /** A link that shows the post on the website whatever its status, for `blog.preview_link_days`. Not indexed. */
    public function previewUrl(): string
    {
        $signed = URL::temporarySignedRoute(
            'blog.preview',
            now()->addDays(config('blog.preview_link_days')),
            ['post' => $this->id],
            absolute: false,
        );
        parse_str((string) parse_url($signed, PHP_URL_QUERY), $query);

        return self::frontendUrl().'/blog/preview?'.http_build_query([
            'post' => $this->id,
            'expires' => $query['expires'],
            'signature' => $query['signature'],
        ]);
    }

    /** A slug made from the title, with -2, -3… if another post or an old address has it. */
    public static function uniqueSlug(?string $title, ?int $ignoreId = null): string
    {
        $base = Str::limit(Str::slug((string) $title), config('blog.limits.slug') - 4, '') ?: 'post';
        $base = rtrim($base, '-');
        if (in_array($base, config('blog.reserved_slugs'), true)) {
            $base .= '-post';
        }

        $slug = $base;
        for ($n = 2; static::slugTaken($slug, $ignoreId); $n++) {
            $slug = "{$base}-{$n}";
        }

        return $slug;
    }

    /** Whether another post uses the slug, or it is the old address of another post. */
    public static function slugTaken(string $slug, ?int $ignoreId = null): bool
    {
        return static::where('slug', $slug)->when($ignoreId, fn ($query) => $query->whereKeyNot($ignoreId))->exists()
            || PostSlugRedirect::where('old_slug', $slug)->when($ignoreId, fn ($query) => $query->where('post_id', '!=', $ignoreId))->exists();
    }

    private static function frontendUrl(): string
    {
        // FRONTEND_URL may list several addresses for CORS; the first is the site itself.
        return rtrim(trim(explode(',', (string) config('rental.frontend_url'))[0]), '/');
    }
}
