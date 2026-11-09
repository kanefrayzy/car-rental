<?php

namespace App\Services;

use App\Models\Post;
use InvalidArgumentException;

/**
 * The cover pool for posts published through the API (config blog.cover_pool): real photos of
 * the car in resources/blog-covers. Picks the next cover so the same angle never follows itself
 * and every picture comes round before any repeats.
 */
class BlogCoverPool
{
    /** @return list<string> */
    public static function keys(): array
    {
        return array_keys(config('blog.cover_pool'));
    }

    public static function path(string $key): string
    {
        if (! array_key_exists($key, config('blog.cover_pool'))) {
            throw new InvalidArgumentException("Unknown cover: {$key}");
        }

        return resource_path("blog-covers/{$key}.webp");
    }

    public static function alt(string $key): string
    {
        return config("blog.cover_pool.{$key}.alt");
    }

    public static function view(?string $key): ?string
    {
        return $key ? config("blog.cover_pool.{$key}.view") : null;
    }

    /**
     * The picture unused longest (never used first, then pool order), skipping the view of the
     * newest post's cover.
     */
    public static function pick(): string
    {
        $pool = config('blog.cover_pool');

        // When each picture was last given to a post (the highest post id that wears it).
        $lastUsed = Post::query()
            ->whereNotNull('cover_source')
            ->selectRaw('cover_source, max(id) as last_id')
            ->groupBy('cover_source')
            ->pluck('last_id', 'cover_source');

        $newestView = self::view(Post::query()->newestFirst()->value('cover_source'));

        $candidates = array_keys(array_filter($pool, fn (array $cover) => $cover['view'] !== $newestView)) ?: array_keys($pool);
        $order = array_flip(array_keys($pool));

        usort($candidates, fn (string $a, string $b) => [(int) ($lastUsed[$a] ?? 0), $order[$a]] <=> [(int) ($lastUsed[$b] ?? 0), $order[$b]]);

        return $candidates[0];
    }
}
