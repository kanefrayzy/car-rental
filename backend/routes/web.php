<?php

use Illuminate\Support\Facades\Route;

// This app is an API only; the website is the Next.js app in /frontend.
Route::get('/', fn () => response()->json([
    'name' => config('app.name').' API',
    'status' => 'ok',
]));
