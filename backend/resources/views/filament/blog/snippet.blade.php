{{-- Roughly how Google shows the post: it cuts titles at about 600 px (60 characters) and
     descriptions at about 160 characters. --}}
@php
    $host = parse_url($url, PHP_URL_HOST);
    $path = trim((string) parse_url($url, PHP_URL_PATH), '/');
    $crumbs = $path === '' ? '' : ' › '.str_replace('/', ' › ', $path);
    $shownTitle = \Illuminate\Support\Str::limit((string) $title, 60, '…');
    $shownDescription = \Illuminate\Support\Str::limit((string) $description, 158, ' …', preserveWords: true);
@endphp

<div class="blog-snippet" aria-label="Search result preview">
    <p class="blog-snippet__label">Google preview</p>
    <div class="blog-snippet__site">
        <span class="blog-snippet__icon">B</span>
        <span>
            <span class="blog-snippet__name">{{ config('app.name') }}</span>
            <span class="blog-snippet__url">{{ $host }}{{ $crumbs }}</span>
        </span>
    </div>
    <p class="blog-snippet__title">{{ $shownTitle ?: 'Post title' }}</p>
    <p class="blog-snippet__description">{{ $shownDescription ?: 'The excerpt or the first paragraph shows here.' }}</p>
</div>

<style>
    .blog-snippet { border: 1px solid var(--gray-200); border-radius: .75rem; padding: 1rem 1.25rem; background: white; font-family: Arial, sans-serif; max-width: 40rem; }
    .blog-snippet__label { font-family: inherit; font-size: .6875rem; font-weight: 600; text-transform: uppercase; letter-spacing: .04em; color: var(--gray-400); margin-bottom: .75rem; }
    .blog-snippet__site { display: flex; align-items: center; gap: .625rem; }
    .blog-snippet__icon { display: inline-flex; width: 1.75rem; height: 1.75rem; border-radius: 9999px; align-items: center; justify-content: center; background: #0a1730; color: white; font-weight: 700; font-size: .75rem; }
    .blog-snippet__name { display: block; font-size: .875rem; color: #202124; }
    .blog-snippet__url { display: block; font-size: .75rem; color: #4d5156; word-break: break-all; }
    .blog-snippet__title { margin-top: .5rem; font-size: 1.25rem; line-height: 1.3; color: #1a0dab; }
    .blog-snippet__description { margin-top: .25rem; font-size: .875rem; line-height: 1.58; color: #4d5156; }
    .dark .blog-snippet { background: #1f1f1f; border-color: var(--gray-700); }
    .dark .blog-snippet__name { color: #dadce0; }
    .dark .blog-snippet__url, .dark .blog-snippet__description { color: #bdc1c6; }
    .dark .blog-snippet__title { color: #99c3ff; }
</style>
