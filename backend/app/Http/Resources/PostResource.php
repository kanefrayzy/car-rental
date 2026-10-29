<?php

namespace App\Http\Resources;

use App\Models\Post;
use App\Services\BlogImages;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A blog post in the shape of `BlogPost` in frontend/lib/blog.ts. Lists get the summary;
 * a single post (`full()`) adds the Markdown and the search fields.
 *
 * @mixin Post
 */
class PostResource extends JsonResource
{
    private bool $full = false;

    public function full(): static
    {
        $this->full = true;

        return $this;
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $size = BlogImages::size($this->cover_image);

        return [
            'slug' => $this->slug,
            'title' => $this->title,
            'excerpt' => (string) $this->excerpt,
            'cover' => $size ? [
                'url' => BlogImages::url($this->cover_image),
                'width' => $size['width'],
                'height' => $size['height'],
                'alt' => (string) ($this->cover_alt ?: $this->title),
            ] : null,
            'publishedAt' => $this->published_at?->toIso8601String(),
            'updatedAt' => $this->updated_at?->toIso8601String(),
            'readingTime' => $this->reading_time,
            ...($this->full ? [
                'content' => $this->content,
                'metaTitle' => $this->searchTitle(),
                'metaDescription' => $this->searchDescription(),
            ] : []),
        ];
    }
}
