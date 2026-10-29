#!/bin/sh
# Daily backup of the database and the API's storage (customer documents and the app key),
# kept for 14 days in /var/backups/bueno. Run by cron on the server:
#   15 4 * * * /opt/bueno/deploy/backup.sh
# These copies sit on the same server: also copy them somewhere else now and then.
set -eu

dir=/var/backups/bueno
stamp=$(date +%Y-%m-%d)
mkdir -p "$dir"
chmod 700 "$dir"
cd /opt/bueno/deploy

docker compose exec -T db sh -c 'mariadb-dump -uroot -p"$MARIADB_ROOT_PASSWORD" --single-transaction --routines rental' \
    | gzip > "$dir/db-$stamp.sql.gz"
docker compose exec -T backend tar -czf - -C /var/www/html storage/app > "$dir/storage-$stamp.tgz"

find "$dir" -type f -mtime +14 -delete
