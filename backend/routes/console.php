<?php

use App\Models\Post;
use App\Models\User;
use App\Services\BlogRevalidator;
use App\Services\DocumentRetention;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/*
 * Creates an admin panel account, or sets a new password on an existing one.
 *
 *   php artisan admin:user owner@example.com                 asks for the password
 *   php artisan admin:user owner@example.com --password=...  for scripts
 *   ... --keep-existing                                       leave an existing account alone
 */
Artisan::command('admin:user {email} {--name=Owner} {--password=} {--keep-existing}', function (string $email) {
    $email = strtolower(trim($email));
    $user = User::where('email', $email)->first();

    if ($user && $this->option('keep-existing')) {
        $this->info("{$email} already has an account; left as it is.");

        return 0;
    }

    $password = $this->option('password') ?: $this->secret('Password (at least 10 characters)');
    $validator = Validator::make(
        ['email' => $email, 'password' => $password],
        ['email' => ['required', 'email'], 'password' => ['required', 'string', 'min:10']],
    );

    if ($validator->fails()) {
        foreach ($validator->errors()->all() as $error) {
            $this->error($error);
        }

        return 1;
    }

    $user ??= new User(['email' => $email, 'name' => $this->option('name')]);
    $user->password = $password;
    $user->remember_token = Str::random(60);
    $user->save();

    $this->info($user->wasRecentlyCreated ? "Account created for {$email}." : "Password changed for {$email}.");

    return 0;
})->purpose('Create an admin panel account or change its password');

/*
 * Deletes customers' documents that are past the retention period (config/rental.php).
 * Runs every night from the scheduler; `--dry-run` only counts.
 */
Artisan::command('bookings:prune-documents {--dry-run}', function (DocumentRetention $retention) {
    if ($this->option('dry-run')) {
        $this->info($retention->due()->count().' booking(s) have documents past the retention period.');

        return 0;
    }

    $count = $retention->prune();
    $this->info("Deleted the documents of {$count} booking(s).");

    return 0;
})->purpose('Delete licences and insurance cards past the retention period');

Schedule::command('bookings:prune-documents')->dailyAt('03:30')->timezone(config('rental.timezone'));

/*
 * Tells the website about scheduled posts whose time has come (saving a post tells it at
 * once; a scheduled one has nothing to save when its time arrives). Every minute.
 */
Artisan::command('blog:revalidate-due', function (BlogRevalidator $revalidator) {
    $due = Post::live()
        ->where(fn ($query) => $query->whereNull('revalidated_at')->orWhereColumn('revalidated_at', '<', 'published_at'))
        ->get(['id', 'slug']);

    if ($due->isEmpty() || ! $revalidator->enabled()) {
        return 0;
    }

    if ($revalidator->revalidate($due->pluck('slug')->all())) {
        // Without touching updated_at: that is the post's "last updated" date on the site.
        Post::query()->whereKey($due->modelKeys())->toBase()->update(['revalidated_at' => now()]);
        $this->info('Told the website about '.$due->count().' post(s).');
    }

    return 0;
})->purpose('Refresh the website\'s blog pages for scheduled posts that went live');

/* Refreshes every blog page on the website now, e.g. after a deploy. */
Artisan::command('blog:revalidate', function (BlogRevalidator $revalidator) {
    if (! $revalidator->enabled()) {
        $this->error('BLOG_REVALIDATE_URL and BLOG_REVALIDATE_SECRET are not set.');

        return 1;
    }

    $ok = $revalidator->revalidate();
    $ok ? $this->info('The website refreshed its blog pages.') : $this->error('The website did not answer; see the log.');

    return $ok ? 0 : 1;
})->purpose('Refresh the website\'s blog pages now');

Schedule::command('blog:revalidate-due')->everyMinute()->withoutOverlapping();
