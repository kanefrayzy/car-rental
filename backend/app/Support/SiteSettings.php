<?php

namespace App\Support;

use App\Models\Setting;

/**
 * What the owner sets on the admin panel's Settings page, with the config values as defaults.
 * The website reads the same values from GET /api/settings.
 */
class SiteSettings
{
    /** The deposit a new request asks for, in whole dollars. Requests already sent keep theirs. */
    public static function depositUsd(): int
    {
        $value = Setting::find('deposit_usd')?->value;

        return $value !== null ? (int) $value : (int) config('rental.deposit_usd');
    }

    /** The business's Instagram page, or null to hide it on the site. */
    public static function instagramUrl(): ?string
    {
        return Setting::find('instagram_url')?->value ?: null;
    }

    public static function save(int $depositUsd, ?string $instagramUrl): void
    {
        Setting::updateOrCreate(['key' => 'deposit_usd'], ['value' => (string) $depositUsd]);
        Setting::updateOrCreate(['key' => 'instagram_url'], ['value' => $instagramUrl ?: null]);
    }
}
