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

];
