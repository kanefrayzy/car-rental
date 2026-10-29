<?php

/*
 * Business rules for the rental. The frontend shows the same numbers from
 * frontend/config/site.ts; when one changes, change the other.
 */
return [

    // Who is told about new booking requests. Empty: no owner email is sent.
    'owner_email' => env('RENTAL_OWNER_EMAIL'),

    // Where the website's contact form sends questions (user, 2026-10-16). The site shows the
    // same address: site.email in frontend/config/site.ts.
    'contact_email' => env('RENTAL_CONTACT_EMAIL', 'info@buenoexoticsny.com'),

    // Shown in the footer of every email. The site has the same in frontend/config/site.ts.
    'business' => [
        'city' => 'Patchogue, NY',
        'phone' => '(631) 459-1929',
        'phone_e164' => '+16314591929',
    ],

    // The site that calls this API. Used for CORS.
    'frontend_url' => env('FRONTEND_URL', 'http://localhost:3000'),

    // "Today" for date rules is the business's day, not the server's.
    'timezone' => env('RENTAL_TIMEZONE', 'America/New_York'),

    // Pick-up and return times: half-hour slots from open to close, in `timezone`. The site
    // offers the same slots (site.booking.hours in frontend/config/site.ts). Change both together.
    'hours' => [
        'open' => '07:00',
        'close' => '23:00',
        'slot_minutes' => 30,
    ],

    // What a booking may say the car is for (the Occasions cards on the site; optional in the
    // form). The site has the same keys and titles: `occasions` in frontend/config/content.ts.
    // Change both together.
    'occasions' => [
        'photoshoot' => 'Photoshoot',
        'music-video' => 'Music video',
        'wedding' => 'Wedding',
        'birthday' => 'Birthday',
        'prom' => 'Prom',
        'event' => 'Event or party',
    ],

    // The contact form's "Occasion" list (user, 2026-10-16): the booking occasions plus a plain
    // rental and "Other". The site has the same list: `contactTopics` in
    // frontend/config/content.ts. Change both together.
    'contact_topics' => [
        'rental' => 'Rental',
        'photoshoot' => 'Photoshoot',
        'music-video' => 'Music video',
        'wedding' => 'Wedding',
        'prom' => 'Prom',
        'birthday' => 'Birthday',
        'event' => 'Event',
        'other' => 'Other',
    ],

    // Rentals are charged per 24 hours from the pick-up time; a part of a day counts as a day.
    'min_rental_days' => (int) env('RENTAL_MIN_DAYS', 1),
    'max_rental_days' => (int) env('RENTAL_MAX_DAYS', 30),

    // How far ahead a pick-up date may be.
    'max_advance_days' => (int) env('RENTAL_MAX_ADVANCE_DAYS', 365),

    'deposit_usd' => (int) env('RENTAL_DEPOSIT_USD', 1000),

    // Percent charged on the rental. TODO: confirm with the client's accountant (NY adds a
    // special passenger car rental tax on top of sales tax). The site shows the same rate:
    // taxRatePercent in frontend/config/terms.ts. Change both together.
    'tax_rate' => (float) env('RENTAL_TAX_RATE', 8.625),

    // A request that has not paid its deposit keeps the dates for this long, then frees them.
    'hold_hours' => (int) env('RENTAL_HOLD_HOURS', 24),

    'uploads' => [
        // Private disk: licences and insurance cards are never publicly reachable.
        'disk' => env('RENTAL_UPLOAD_DISK', 'local'),
        'max_kb' => 10 * 1024,
        'mimes' => ['jpg', 'jpeg', 'png', 'webp', 'pdf'],
    ],

    // How long the customer's link to the document upload page keeps working.
    'upload_link_days' => (int) env('RENTAL_UPLOAD_LINK_DAYS', 7),

    // How long the document links in the owner's email keep working.
    'document_link_days' => (int) env('RENTAL_DOCUMENT_LINK_DAYS', 14),

    // Licences and insurance cards are deleted this many days after the return date (or
    // after a cancellation). The site's privacy page states the same number:
    // documentRetentionDays in frontend/config/site.ts. Change both together.
    'document_retention_days' => (int) env('RENTAL_DOCUMENT_RETENTION_DAYS', 180),

    // The "Leave a review" link in the thank-you email after a rental: the Google Business
    // Profile's "Ask for reviews" link. Empty: no review request is sent.
    'review_url' => env('GOOGLE_REVIEW_URL'),

    // How long after the owner marks the car returned the thank-you email goes out.
    'review_delay_hours' => (int) env('RENTAL_REVIEW_DELAY_HOURS', 3),

    'rate_limits' => [
        'api_per_minute' => (int) env('RENTAL_API_RATE', 60),
        'bookings_per_minute' => (int) env('RENTAL_BOOKING_RATE', 6),
        // Contact form messages per IP address per hour; refused ones are not counted.
        'contact_per_hour' => (int) env('RENTAL_CONTACT_RATE', 5),
        // Blog reads per IP address per minute (the website's server makes nearly all of them).
        'blog_per_minute' => (int) env('RENTAL_BLOG_RATE', 300),
    ],

];
