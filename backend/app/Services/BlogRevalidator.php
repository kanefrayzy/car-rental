<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Tells the website that the blog changed, so it drops its cached /blog pages, the sitemap
 * and the RSS feed at once instead of within a few minutes. The website's side is
 * frontend/app/internal/revalidate/route.ts; both share BLOG_REVALIDATE_SECRET.
 */
class BlogRevalidator
{
    public function enabled(): bool
    {
        return filled(config('blog.revalidate_url')) && filled(config('blog.revalidate_secret'));
    }

    /**
     * @param  list<string>  $slugs  The posts that changed (old and new slugs), for the website's log.
     * @return bool Whether the website confirmed it. Never throws: a failed call only means the
     *              site shows the change a few minutes later.
     */
    public function revalidate(array $slugs = []): bool
    {
        if (! $this->enabled()) {
            return false;
        }

        try {
            $response = Http::timeout(5)
                ->acceptJson()
                ->withToken(config('blog.revalidate_secret'))
                ->post(config('blog.revalidate_url'), ['tags' => ['blog'], 'slugs' => array_values(array_unique($slugs))]);

            if ($response->successful()) {
                return true;
            }

            Log::warning('The website refused the blog revalidation.', ['status' => $response->status()]);
        } catch (Throwable $exception) {
            Log::warning('The website could not be told about a blog change.', ['error' => $exception->getMessage()]);
        }

        return false;
    }
}
