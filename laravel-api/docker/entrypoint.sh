#!/usr/bin/env sh
set -e

if [ ! -f .env ]; then
  cp .env.example .env
fi

php artisan key:generate --force --no-interaction || true
php artisan config:clear || true
php artisan migrate --force --no-interaction || true

exec /usr/bin/supervisord -c /etc/supervisord.conf
