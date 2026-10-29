<?php

namespace App\Jobs;

use App\Services\BlogRevalidator;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;

/**
 * Asks the website to refresh its blog pages after a post was published, changed or deleted.
 * Queued so that saving in the admin panel never waits on the website; the `queue` container
 * runs it within seconds. Retried a few times while the website is down (during a deploy).
 */
class RevalidateBlog implements ShouldQueue
{
    use Queueable;

    public int $tries = 4;

    /** @var list<int> */
    public array $backoff = [10, 60, 300];

    /** @param  list<string>  $slugs */
    public function __construct(public array $slugs = []) {}

    public function handle(BlogRevalidator $revalidator): void
    {
        if (! $revalidator->enabled() || $revalidator->revalidate($this->slugs)) {
            return;
        }

        if ($this->attempts() < $this->tries) {
            $this->release($this->backoff[$this->attempts() - 1] ?? 300);
        }
    }
}
