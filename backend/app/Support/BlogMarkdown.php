<?php

namespace App\Support;

use Illuminate\Support\Str;

/**
 * Plain-text facts about a post's Markdown: reading time, a leading "# Title" line and a
 * fallback excerpt, plus the HTML for the admin panel's live preview. The website renders
 * the Markdown itself (frontend/lib/markdown.ts); this is only for the panel.
 */
class BlogMarkdown
{
    /** Minutes to read, at least 1. */
    public static function readingTime(string $markdown): int
    {
        $words = preg_match_all('/[\p{L}\p{N}][\p{L}\p{N}\'’-]*/u', self::plainText($markdown));

        return max(1, (int) ceil($words / config('blog.words_per_minute')));
    }

    /**
     * The text of a "# Heading" (or "Heading\n===") that opens the Markdown, if it does. A
     * pasted article often starts with its title; the page shows the title as its H1 already.
     */
    public static function leadingHeading(?string $markdown): ?string
    {
        $markdown = ltrim((string) $markdown, "\u{FEFF} \t\r\n");

        if (preg_match('/\A#[ \t]+(.+?)[ \t#]*(?:\r?\n|\z)/', $markdown, $match)
            || preg_match('/\A([^\r\n#>|`*-][^\r\n]*)\r?\n=+[ \t]*(?:\r?\n|\z)/', $markdown, $match)) {
            $heading = trim(self::inlineText($match[1]));

            return $heading !== '' ? $heading : null;
        }

        return null;
    }

    /** The Markdown without that opening heading. */
    public static function withoutLeadingHeading(string $markdown): string
    {
        if (self::leadingHeading($markdown) === null) {
            return $markdown;
        }

        $markdown = ltrim($markdown, "\u{FEFF} \t\r\n");
        $markdown = preg_replace('/\A(?:#[ \t]+.+?[ \t#]*(?:\r?\n|\z)|[^\r\n]+\r?\n=+[ \t]*(?:\r?\n|\z))/', '', $markdown, 1);

        return ltrim($markdown, "\r\n");
    }

    /** The first paragraph as plain text, cut at a word to fit `$limit` characters. */
    public static function excerpt(string $markdown, ?int $limit = null): string
    {
        $limit ??= config('blog.limits.excerpt');
        $markdown = preg_replace('/^(```|~~~).*?^\1/ms', '', self::withoutLeadingHeading($markdown));

        foreach (preg_split('/\R\s*\R/', (string) $markdown) as $block) {
            $block = trim($block);
            // Headings, lists, tables, quotes, pictures and HTML are not an opening sentence.
            if ($block === '' || preg_match('/\A(#|[-*+] |\d+[.)] |\||>|!\[|<)/', $block)) {
                continue;
            }

            return Str::limit(trim(preg_replace('/\s+/', ' ', self::inlineText($block))), $limit - 1, '…', preserveWords: true);
        }

        return '';
    }

    /** HTML for the admin panel's preview. Raw HTML in the Markdown is shown as text, as on the site. */
    public static function previewHtml(?string $markdown): string
    {
        if (blank($markdown)) {
            return '';
        }

        // Str::markdown is GitHub-flavoured already (tables, strikethrough, autolinks).
        return (string) Str::markdown($markdown, [
            'html_input' => 'escape',
            'allow_unsafe_links' => false,
            'max_nesting_level' => 50,
        ]);
    }

    /** Words only: no code, link targets, markup or HTML tags. */
    private static function plainText(string $markdown): string
    {
        $text = preg_replace('/^(```|~~~).*?^\1/ms', ' ', $markdown);

        return self::inlineText(strip_tags((string) $text));
    }

    private static function inlineText(string $markdown): string
    {
        $text = preg_replace('/!\[([^\]]*)\]\([^)]*\)/', '$1', $markdown);
        $text = preg_replace('/\[([^\]]*)\]\([^)]*\)/', '$1', (string) $text);
        $text = preg_replace('/\[([^\]]*)\]\[[^\]]*\]/', '$1', (string) $text);
        $text = preg_replace('/<[^>]+>/', '', (string) $text);

        return trim(str_replace(['**', '__', '*', '_', '`', '~~'], '', (string) $text));
    }
}
