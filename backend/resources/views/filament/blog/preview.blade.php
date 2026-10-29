{{-- The live preview beside the Markdown editor. $html comes from BlogMarkdown::previewHtml,
     which escapes raw HTML and unsafe links; it is the same text the website shows, in the
     panel's own typography (the site's look is on the preview link). --}}
<div class="blog-preview">
    <div class="blog-preview__bar">
        <span>Preview</span>
        <span>{{ $readingTime }} min read</span>
    </div>
    @if ($imagesWithoutAlt > 0)
        <p class="blog-preview__warning">
            {{ $imagesWithoutAlt }} {{ \Illuminate\Support\Str::plural('picture', $imagesWithoutAlt) }} without a description:
            write what it shows between the square brackets, like ![Hellcat at the venue](…).
        </p>
    @endif
    <article class="blog-preview__body fi-prose">
        @if (filled($title))
            <h1>{{ $title }}</h1>
        @endif
        @if (filled($html))
            {!! $html !!}
        @else
            <p class="blog-preview__empty">The text appears here as you type or paste it.</p>
        @endif
    </article>
</div>

<style>
    .blog-preview { border: 1px solid var(--gray-200); border-radius: .75rem; overflow: hidden; background: var(--gray-50); }
    .blog-preview__bar { display: flex; justify-content: space-between; padding: .5rem 1rem; font-size: .75rem; font-weight: 600; color: var(--gray-500); border-bottom: 1px solid var(--gray-200); text-transform: uppercase; letter-spacing: .04em; }
    .blog-preview__warning { margin: .75rem 1rem 0; padding: .5rem .75rem; border-radius: .5rem; font-size: .8125rem; background: var(--warning-50); color: var(--warning-700); }
    .blog-preview__body { padding: 1rem 1.25rem 1.5rem; max-height: 44rem; overflow: auto; background: white; }
    .blog-preview__body img { max-width: 100%; height: auto; border-radius: .5rem; }
    .blog-preview__body table { display: block; overflow-x: auto; border-collapse: collapse; }
    .blog-preview__body th, .blog-preview__body td { border: 1px solid var(--gray-200); padding: .375rem .625rem; text-align: left; }
    .blog-preview__body th { background: var(--gray-50); }
    .blog-preview__empty { color: var(--gray-400); }
    .dark .blog-preview { border-color: var(--gray-700); background: var(--gray-900); }
    .dark .blog-preview__bar { border-color: var(--gray-700); }
    .dark .blog-preview__body { background: var(--gray-950); }
</style>
