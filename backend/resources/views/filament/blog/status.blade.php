@php
    /** @var \App\Models\Post|null $post */
    $tz = config('rental.timezone');
    $state = $post?->state() ?? 'draft';
    $when = $post?->published_at?->copy()->setTimezone($tz)->format('M j, Y, g:i A');
@endphp

<div class="blog-status">
    <span @class(['blog-status__badge', "blog-status__badge--{$state}"])>{{ ucfirst($state) }}</span>

    <p class="blog-status__text">
        @if ($state === 'published')
            On the website since {{ $when }} (New York time).
        @elseif ($state === 'scheduled')
            Goes live on {{ $when }} (New York time). Until then only the preview link shows it.
        @else
            Not on the website. Only the preview link shows it.
        @endif
    </p>

    @if ($post?->exists)
        <p class="blog-status__meta">
            {{ $post->reading_time }} min read · last saved {{ $post->updated_at->copy()->setTimezone($tz)->format('M j, g:i A') }}
        </p>
        @if ($state === 'published')
            <a class="blog-status__link" href="{{ $post->url() }}" target="_blank" rel="noopener">{{ $post->url() }}</a>
        @endif
    @endif
</div>

<style>
    .blog-status { display: grid; gap: .5rem; justify-items: start; }
    .blog-status__badge { font-size: .75rem; font-weight: 600; padding: .125rem .5rem; border-radius: .375rem; background: var(--gray-100); color: var(--gray-700); }
    .blog-status__badge--published { background: var(--success-50); color: var(--success-700); }
    .blog-status__badge--scheduled { background: var(--warning-50); color: var(--warning-700); }
    .blog-status__text { font-size: .875rem; }
    .blog-status__meta { font-size: .8125rem; color: var(--gray-500); }
    .blog-status__link { font-size: .8125rem; color: var(--primary-600); word-break: break-all; }
    .blog-status__link:hover { text-decoration: underline; }
    .dark .blog-status__badge { background: var(--gray-800); color: var(--gray-200); }
    .dark .blog-status__badge--published { background: color-mix(in oklab, var(--success-500) 20%, transparent); color: var(--success-300); }
    .dark .blog-status__badge--scheduled { background: color-mix(in oklab, var(--warning-500) 20%, transparent); color: var(--warning-300); }
</style>
