<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An address a live post had before its slug was changed. GET /api/blog/posts/{old} answers
 * 301 with the current slug, and the website sends visitors on. Points at the post, not at
 * a slug, so a post renamed twice never makes a chain of redirects.
 */
class PostSlugRedirect extends Model
{
    protected $fillable = ['post_id', 'old_slug'];

    /** @return BelongsTo<Post, $this> */
    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }
}
