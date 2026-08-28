# syntax=docker/dockerfile:1
# 本番（AWS ECS Fargate）用のバックエンドイメージ。
# terraform 側で ARM64（Graviton）指定のため、ビルドは `docker buildx build --platform linux/arm64` で行う。
ARG PYTHON_VERSION=3.14

# --- build stage: mysqlclient のコンパイルに必要なものを入れて依存関係をインストール ---
FROM python:${PYTHON_VERSION}-slim AS build

ENV PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        pkg-config \
        default-libmysqlclient-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt

# --- runtime stage: 実行に必要な共有ライブラリのみ ---
FROM python:${PYTHON_VERSION}-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_DEBUG=false

RUN apt-get update && apt-get install -y --no-install-recommends \
        libmariadb3 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --create-home --uid 1000 appuser

COPY --from=build /install /usr/local

WORKDIR /app
COPY . .

# /admin の静的ファイルを収集する。DJANGO_SECRET_KEY はビルド時のダミーで足りる
# （実行時に Secrets Manager 由来の本物へ差し替わる）。
RUN DJANGO_SECRET_KEY=build-time-only-dummy-key-000000000000000000000000 \
    DJANGO_ALLOWED_HOSTS=localhost \
    python manage.py collectstatic --noinput \
    && chown -R appuser:appuser /app

USER appuser
EXPOSE 8000

# 起動時に migrate してから gunicorn を起動する（単一タスク前提。複数タスク化する場合は
# migrate を独立した ECS run-task に分離すること。docs/infrastructure-design.md 参照）。
ENTRYPOINT ["./docker-entrypoint.sh"]
