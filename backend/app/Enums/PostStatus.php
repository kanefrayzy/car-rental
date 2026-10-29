<?php

namespace App\Enums;

/**
 * What the owner chose for a post. A published post whose publish time is still ahead is
 * "scheduled" (Post::state()); it stays hidden from the website until then.
 */
enum PostStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
}
