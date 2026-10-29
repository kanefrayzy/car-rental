<?php

/*
 * Router for PHP's built-in server (`composer serve`). Real files under public/ (the admin
 * panel's CSS, JS and fonts) are served as they are; every other request goes to Laravel.
 * Without this, the built-in server hands the stylesheets to Laravel too and the admin
 * panel loads unstyled.
 */
$path = urldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?? '/');

if ($path !== '/' && is_file(__DIR__.'/public'.$path)) {
    return false;
}

// The blog's pictures (the public disk), without the public/storage link that Docker makes:
// creating a link needs extra rights on Windows.
$file = realpath(__DIR__.'/storage/app/public/'.substr($path, strlen('/storage/')));
if (str_starts_with($path, '/storage/') && $file && str_starts_with($file, realpath(__DIR__.'/storage/app/public')) && is_file($file)) {
    header('Content-Type: '.(mime_content_type($file) ?: 'application/octet-stream'));
    header('Cache-Control: public, max-age=31536000, immutable');
    readfile($file);

    return true;
}

require __DIR__.'/public/index.php';
