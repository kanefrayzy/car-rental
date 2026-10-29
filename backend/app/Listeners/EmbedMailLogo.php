<?php

namespace App\Listeners;

use Illuminate\Mail\Events\MessageSending;
use Symfony\Component\Mime\Email;

/**
 * Puts the logo inside every email whose header asks for it (cid:bueno-logo, see
 * resources/views/vendor/mail/html/header.blade.php). An embedded image shows even where an
 * email client blocks images from the web, which new sending domains often run into.
 * The file comes from scripts/brand.mjs.
 */
class EmbedMailLogo
{
    public function handle(MessageSending $event): void
    {
        $message = $event->message;

        if ($message instanceof Email && str_contains((string) $message->getHtmlBody(), 'cid:bueno-logo')) {
            $message->embedFromPath(resource_path('brand/email-logo.png'), 'bueno-logo', 'image/png');
        }
    }
}
