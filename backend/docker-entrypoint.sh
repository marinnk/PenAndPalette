#!/bin/sh
set -e

# DBスキーマを最新化してから（分類タグのシードもマイグレーションで入る）アプリを起動する
python manage.py migrate --noinput

exec gunicorn config.wsgi:application \
    --bind "0.0.0.0:${PORT:-8000}" \
    --workers "${GUNICORN_WORKERS:-2}" \
    --access-logfile - \
    --error-logfile -
