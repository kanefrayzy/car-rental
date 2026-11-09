<?php

/*
 * The blog (2026-10-21): posts written in the admin panel (/be/posts), read by the website's
 * /blog pages through GET /api/blog/posts.
 */
return [

    // Posts per page of GET /api/blog/posts when the caller does not say, and the most it may ask for.
    'per_page' => 12,
    'max_per_page' => 100,

    // Addresses that are pages of their own on the website (/blog/page/2, /blog/preview,
    // /blog/rss.xml), so no post may take them as its slug.
    'reserved_slugs' => ['page', 'preview', 'rss', 'feed', 'tag', 'category', 'author'],

    // Lengths the admin form and the API enforce. Search results cut titles at about 60
    // characters and descriptions at about 160.
    'limits' => [
        'title' => 150,
        'slug' => 100,
        'excerpt' => 160,
        'meta_title' => 60,
        'meta_description' => 160,
        'cover_alt' => 150,
    ],

    // How long a draft's preview link works.
    'preview_link_days' => 7,

    // Words a minute for the reading time shown on the site.
    'words_per_minute' => 220,

    /*
     * Uploaded pictures (covers and pictures inside a post) are re-encoded as WebP on the
     * public disk. Re-encoding also drops whatever else the file carried (metadata, payloads).
     * Smaller copies are written next to each one for the website's srcset; the file name
     * carries the size ("…_1600x900.webp"), so the site knows both the shape and which copies
     * exist without asking.
     */
    'images' => [
        'max_width' => 1600,
        'widths' => [480, 800, 1200],
        'quality' => 80,
        // Upload limit in kilobytes, and the accepted types (checked by content).
        'max_kb' => 8192,
        'types' => ['image/jpeg', 'image/png', 'image/webp'],
        // Bigger pictures would not fit in PHP's memory while being resized.
        'max_side' => 6000,
        // Google asks for article images at least 1200 px wide (Article structured data).
        'cover_min_width' => 1200,
    ],

    /*
     * On-demand revalidation: after a post is published, changed or deleted, the API asks the
     * website to drop its cached blog pages (frontend/app/internal/revalidate/route.ts).
     * Empty URL: nothing is sent, and the site picks changes up on its own within a few minutes.
     */
    'revalidate_url' => env('BLOG_REVALIDATE_URL'),
    'revalidate_secret' => env('BLOG_REVALIDATE_SECRET'),

    /*
     * POST /api/blog/publish (2026-11-09): the scheduled blog agent publishes through it,
     * three times a week. It can only create a live post: no edits, no deletes, nothing else.
     * Empty token: the address answers 404.
     */
    'publish' => [
        'token' => env('BLOG_PUBLISH_TOKEN'),
        // A second post within this many hours of the last one is refused (a run fired twice).
        'min_hours_between' => 12,
        // A post shorter than this is not a post worth publishing.
        'min_content_chars' => 2500,
        // Words no published field may contain (user, 2026-10-21: posts without "Hellcat";
        // the engine is not final either, see CLAUDE.md).
        'banned_words' => ['hellcat'],
    ],

    /*
     * Covers for posts published through the API: real photos of the car, 16:9, in
     * resources/blog-covers/<key>.webp (built by scripts/images.mjs, which lists the same keys).
     * A new post gets the picture unused longest whose view differs from the newest post's,
     * so the blog and the home page never show the same angle twice in a row.
     */
    'cover_pool' => [
        'front-three-quarter-day' => ['view' => 'front', 'alt' => 'The silver Charger Widebody from the front right in daylight, black hood and red calipers'],
        'front-dusk-blue' => ['view' => 'front', 'alt' => 'The silver Charger Widebody head-on at dusk, headlights on'],
        'rear-seats' => ['view' => 'interior', 'alt' => 'The red leather rear seats of the Charger through the open rear door'],
        'rear-sunset' => ['view' => 'rear', 'alt' => 'The Charger Widebody from the rear at sunset, tail lights on'],
        'side-driveway' => ['view' => 'side', 'alt' => 'The silver Charger Widebody from the front left in a driveway'],
        'interior-seats' => ['view' => 'interior', 'alt' => "Red leather front seats and the steering wheel through the open driver's door"],
        'rear-tail-sunset' => ['view' => 'rear', 'alt' => 'The lit full-width tail light of the silver Charger Widebody at sunset'],
        'front-three-quarter-dusk' => ['view' => 'front', 'alt' => 'The silver Charger Widebody at dusk with its headlights on, lamps lit behind it'],
        'front-dusk-lamps' => ['view' => 'front', 'alt' => 'The Charger Widebody head-on on a rooftop at dusk, headlights on, lamps behind it'],
        'front-dusk-low' => ['view' => 'front', 'alt' => 'A low front view of the silver Charger Widebody at dusk, headlights on'],
        'front-headlight-flare' => ['view' => 'front', 'alt' => 'The Charger Widebody at dusk, its headlights flaring toward the camera'],
        'front-dusk-wide' => ['view' => 'front', 'alt' => 'The silver Charger Widebody on an empty rooftop car park at dusk'],
        'hood-headlight' => ['view' => 'detail', 'alt' => 'Close-up of the satin black hood, smoked headlight and grille of the Charger Widebody'],
        'wheel-caliper' => ['view' => 'detail', 'alt' => 'Close-up of a satin black wheel and red brake caliper under the widebody flare'],
        'rear-sunset-wide' => ['view' => 'rear', 'alt' => 'The silver Charger Widebody from the rear at sunset, the sky orange behind it'],
        'side-wheels' => ['view' => 'side', 'alt' => 'The silver Charger Widebody from the front left, black wheels and red calipers'],
    ],

];
