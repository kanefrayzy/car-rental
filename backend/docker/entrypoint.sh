#!/bin/sh
# Runs every time an API container starts: the web server (backend), the nightly-jobs
# runner (scheduler, APP_ROLE=scheduler) or the queue worker (queue, APP_ROLE=queue).
set -e
cd /var/www/html

# storage/ is a volume (uploads and logs must survive a rebuild). Make sure the folders
# Laravel expects exist in it.
mkdir -p storage/app/private storage/app/public storage/logs \
    storage/framework/cache/data storage/framework/sessions storage/framework/views

# The app key signs the document links in the owner's emails, so it has to stay the same
# across restarts. Use APP_KEY if one is given; otherwise create one once and keep it in
# the storage volume.
if [ -z "$APP_KEY" ]; then
    key_file=storage/app/private/.app_key
    if [ -n "$APP_ROLE" ]; then
        # The web container creates the key; wait for it rather than making a second one.
        tries=0
        until [ -s "$key_file" ]; do
            tries=$((tries + 1))
            [ "$tries" -ge 60 ] && { echo "No app key from the backend container. Giving up." >&2; exit 1; }
            sleep 2
        done
    fi
    [ -s "$key_file" ] || php artisan key:generate --show --no-ansi > "$key_file"
    APP_KEY="$(cat "$key_file")"
    export APP_KEY
fi

# The scheduler and the queue worker only run jobs; the web container owns the database setup.
if [ -n "$APP_ROLE" ]; then
    exec "$@"
fi

# Create or update the tables. The database container may still be starting, so retry.
tries=0
until php artisan migrate --force --no-interaction; do
    tries=$((tries + 1))
    if [ "$tries" -ge 20 ]; then
        echo "The database did not become reachable. Giving up." >&2
        exit 1
    fi
    echo "Waiting for the database..."
    sleep 3
done

# Adds the car on a first run; never overwrites changes (see CarSeeder).
php artisan db:seed --force --no-interaction

# The owner's admin panel account, made once from ADMIN_EMAIL and ADMIN_PASSWORD. A password
# changed later in the panel is kept: an existing account is left alone.
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    php artisan admin:user "$ADMIN_EMAIL" --password="$ADMIN_PASSWORD" --keep-existing --no-interaction
fi

php artisan config:cache
php artisan route:cache
php artisan view:cache

# The commands above ran as root; Apache runs as www-data and must be able to write here.
chown -R www-data:www-data storage bootstrap/cache

exec "$@"
