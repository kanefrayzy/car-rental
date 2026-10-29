<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use App\Models\PostSlugRedirect;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The blog for the website (frontend/lib/blog.ts). Only live posts: drafts and posts
 * scheduled for later answer 404 like posts that do not exist. A draft is seen only through
 * its signed preview link.
 */
class BlogPostController extends Controller
{
    /** GET /api/blog/posts?page=1&perPage=12, newest first. */
    public function index(Request $request): JsonResponse
    {
        $perPage = min(max((int) $request->query('perPage', config('blog.per_page')), 1), config('blog.max_per_page'));
        $page = max((int) $request->query('page', 1), 1);

        $posts = Post::live()->newestFirst()->paginate($perPage, page: $page);

        return response()->json([
            'data' => PostResource::collection($posts->getCollection())->resolve($request),
            'meta' => [
                'page' => $posts->currentPage(),
                'perPage' => $posts->perPage(),
                'total' => $posts->total(),
                'lastPage' => $posts->lastPage(),
            ],
        ]);
    }

    /**
     * GET /api/blog/posts/{slug}. The old slug of a renamed post answers 301 with the new one
     * (in Location and in the body), so the website can send the visitor on.
     */
    public function show(Request $request, string $slug): JsonResponse
    {
        $post = Post::live()->where('slug', $slug)->first();
        if ($post) {
            return response()->json(['data' => (new PostResource($post))->full()->resolve($request)]);
        }

        $current = PostSlugRedirect::where('old_slug', $slug)->first()?->post;
        if ($current?->isLive()) {
            return response()->json(
                ['slug' => $current->slug],
                301,
                ['Location' => url("/api/blog/posts/{$current->slug}")],
            );
        }

        return response()->json(['message' => 'Post not found.'], 404);
    }

    /** GET /api/blog/preview/{post}?expires=…&signature=… (signed): any post, for its preview link. */
    public function preview(Request $request, Post $post): JsonResponse
    {
        return response()->json([
            'data' => (new PostResource($post))->full()->resolve($request),
            'state' => $post->state(),
        ]);
    }
}
