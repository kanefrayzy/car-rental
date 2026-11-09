<?php

namespace App\Http\Controllers\Api;

use App\Enums\PostStatus;
use App\Http\Controllers\Controller;
use App\Models\Post;
use App\Services\BlogCoverPool;
use App\Services\BlogImages;
use App\Support\BlogMarkdown;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * POST /api/blog/publish: the scheduled blog agent (scripts/blog-agent/) publishes a post.
 * Bearer token `blog.publish.token`; without one configured the address does not exist. It
 * only creates a live post, with a cover from the pool, and refuses a second one within
 * `blog.publish.min_hours_between` hours, so a run that fires twice cannot double-post.
 */
class BlogPublishController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $token = (string) config('blog.publish.token');
        abort_if($token === '', 404);
        if (! hash_equals($token, (string) $request->bearerToken())) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $limits = config('blog.limits');
        $data = $request->validate([
            'title' => ['required', 'string', 'max:'.$limits['title']],
            'slug' => ['nullable', 'string', 'max:'.$limits['slug'], 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::notIn(config('blog.reserved_slugs'))],
            'excerpt' => ['required', 'string', 'max:'.$limits['excerpt']],
            'content' => ['required', 'string', 'min:'.config('blog.publish.min_content_chars'), 'max:100000'],
            'meta_title' => ['required', 'string', 'max:'.$limits['meta_title']],
            'meta_description' => ['required', 'string', 'max:'.$limits['meta_description']],
            'cover' => ['nullable', Rule::in(BlogCoverPool::keys())],
        ]);

        foreach (config('blog.publish.banned_words') as $word) {
            foreach ($data as $field => $value) {
                if (is_string($value) && Str::contains($value, $word, ignoreCase: true)) {
                    throw ValidationException::withMessages([$field => "The {$field} must not contain \"{$word}\"."]);
                }
            }
        }

        $slug = $data['slug'] ?? rtrim(Str::limit(Str::slug($data['title']), $limits['slug'], ''), '-');
        if (Post::slugTaken($slug)) {
            return response()->json(['message' => "A post with the slug \"{$slug}\" exists already.", 'slug' => $slug], 409);
        }

        $hours = config('blog.publish.min_hours_between');
        $last = Post::query()->where('origin', 'api')->latest('id')->first();
        if ($last && $last->created_at->gt(now()->subHours($hours))) {
            return response()->json([
                'message' => "The last post came in {$last->created_at->diffForHumans()}; wait {$hours} hours between posts.",
                'slug' => $last->slug,
            ], 429);
        }

        $coverKey = $data['cover'] ?? BlogCoverPool::pick();
        $cover = BlogImages::store(BlogCoverPool::path($coverKey), BlogImages::COVERS);

        try {
            $post = Post::create([
                'title' => $data['title'],
                'slug' => $slug,
                'excerpt' => $data['excerpt'],
                // The page shows the title as its H1; an article that opens with it would show it twice.
                'content' => BlogMarkdown::withoutLeadingHeading($data['content']),
                'cover_image' => $cover,
                'cover_alt' => BlogCoverPool::alt($coverKey),
                'cover_source' => $coverKey,
                'meta_title' => $data['meta_title'],
                'meta_description' => $data['meta_description'],
                'status' => PostStatus::Published,
                'origin' => 'api',
                'published_at' => now(),
            ]);
        } catch (Throwable $error) {
            BlogImages::delete($cover);
            throw $error;
        }

        return response()->json([
            'slug' => $post->slug,
            'url' => $post->url(),
            'cover' => $coverKey,
            'readingTime' => $post->reading_time,
            'publishedAt' => $post->published_at->toIso8601String(),
        ], 201);
    }
}
