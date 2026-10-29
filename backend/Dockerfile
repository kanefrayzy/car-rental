# The booking API: PHP 8.3 with Apache (mod_php), one container.
# Pinned to the patch release: 8.3.36 (2026-10-21) fixes the unauthenticated RCEs CVE-2026-109618
# and CVE-2026-109619, worst under mod_php. Bump the tag with each PHP security release.
FROM php:8.3.36-apache-trixie

# PHP extensions the app needs: MySQL, plus intl, zip and opcache for the framework, and gd
# (with WebP) and exif for the blog's pictures (app/Services/BlogImages.php).
ADD --chmod=0755 https://github.com/mlocati/docker-php-extension-installer/releases/latest/download/install-php-extensions /usr/local/bin/
RUN install-php-extensions pdo_mysql intl zip opcache gd exif

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Serve /public, let Laravel's .htaccess route everything to index.php.
RUN a2enmod rewrite headers
COPY docker/vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/app.ini

WORKDIR /var/www/html

# Dependencies first, so this layer is reused until composer.json changes.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-scripts --no-autoloader

COPY . .
# public/storage -> storage/app/public: the blog's pictures, served by Apache. storage/ is a
# volume, so the link points into it at run time.
RUN composer dump-autoload --optimize --no-dev \
    && ln -sfn ../storage/app/public public/storage \
    && chown -R www-data:www-data storage bootstrap/cache

COPY --chmod=0755 docker/entrypoint.sh /usr/local/bin/app-entrypoint

EXPOSE 80
ENTRYPOINT ["app-entrypoint"]
CMD ["apache2-foreground"]
