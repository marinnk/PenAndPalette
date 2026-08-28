"""本番（DJANGO_DEBUG=false）向けの設定が意図どおりに解決されることを検証する。

config/settings.py はプロセス起動時に一度だけ評価されるため、環境変数ごとの分岐は
importlib.reload では正確に再現できない。ここでは実際の設定モジュールを、制御した
環境変数でサブプロセスとして読み込み、その結果を確認する。
"""

import json
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent

# サブプロセス側で django.setup() まで済ませ、要求された設定値を JSON で吐く。
# 例外時は {"error": "<例外クラス名>"} を返す。
_PROBE = """
import json, sys
import django
try:
    django.setup()
    from django.conf import settings
    keys = json.loads(sys.argv[1])
    out = {}
    for key in keys:
        out[key] = getattr(settings, key, "<undefined>")
    print(json.dumps(out, default=str))
except Exception as exc:
    # 設定読み込み時の例外（ImproperlyConfigured 等）をクラス名だけ返す
    print(json.dumps({"error": type(exc).__name__}))
"""


def load_settings(env_overrides, keys):
    """制御した環境変数で設定モジュールを読み込み、keys の値（または {"error": ...}）を返す。"""
    env = {
        "PATH": "/usr/bin:/bin:/usr/sbin:/sbin",
        "DJANGO_SETTINGS_MODULE": "config.settings",
        "PYTHONPATH": str(BACKEND_DIR),
        # .env ファイル（ローカルにのみ存在）に依存しないよう、テストが関知する変数は必ず明示する
        **env_overrides,
    }
    result = subprocess.run(
        [sys.executable, "-c", _PROBE, json.dumps(keys)],
        cwd=BACKEND_DIR,
        env=env,
        capture_output=True,
        text=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


PROD_ENV = {
    "DJANGO_DEBUG": "false",
    "DJANGO_SECRET_KEY": "x" * 50,
    "DJANGO_ALLOWED_HOSTS": "app.example.com",
}


def test_missing_secret_key_in_production_aborts_startup():
    result = load_settings(
        {"DJANGO_DEBUG": "false", "DJANGO_SECRET_KEY": "", "DJANGO_ALLOWED_HOSTS": "x"},
        ["SECRET_KEY"],
    )
    assert result == {"error": "ImproperlyConfigured"}


def test_debug_mode_falls_back_to_dev_secret_key():
    result = load_settings({"DJANGO_DEBUG": "true", "DJANGO_SECRET_KEY": ""}, ["SECRET_KEY"])
    assert result["SECRET_KEY"].startswith("django-insecure-")


def test_production_enables_secure_cookies_without_ssl_redirect():
    result = load_settings(
        PROD_ENV,
        [
            "SESSION_COOKIE_SECURE",
            "CSRF_COOKIE_SECURE",
            "SECURE_SSL_REDIRECT",
            "AUTH_COOKIE_SECURE",
        ],
    )
    assert result["SESSION_COOKIE_SECURE"] is True
    assert result["CSRF_COOKIE_SECURE"] is True
    assert result["AUTH_COOKIE_SECURE"] is True
    # HTTPSリダイレクトはCloudFront側で行う。Django側で行うとALBヘルスチェックが壊れる
    assert result["SECURE_SSL_REDIRECT"] is False


def test_production_trusts_cloudfront_forwarded_proto_header():
    result = load_settings(PROD_ENV, ["SECURE_PROXY_SSL_HEADER"])
    assert result["SECURE_PROXY_SSL_HEADER"] == ["HTTP_CLOUDFRONT_FORWARDED_PROTO", "https"]


def test_whitenoise_middleware_is_enabled_only_in_production():
    prod = load_settings(PROD_ENV, ["MIDDLEWARE"])
    assert "whitenoise.middleware.WhiteNoiseMiddleware" in prod["MIDDLEWARE"]

    dev = load_settings({"DJANGO_DEBUG": "true", "DJANGO_SECRET_KEY": ""}, ["MIDDLEWARE"])
    assert "whitenoise.middleware.WhiteNoiseMiddleware" not in dev["MIDDLEWARE"]


def test_cors_and_csrf_origins_come_from_env():
    result = load_settings(
        {
            **PROD_ENV,
            "CORS_ALLOWED_ORIGIN_REGEXES": r"^https://.*\.cloudfront\.net$",
            "CSRF_TRUSTED_ORIGINS": "https://d123.cloudfront.net",
        },
        ["CORS_ALLOWED_ORIGIN_REGEXES", "CSRF_TRUSTED_ORIGINS"],
    )
    assert result["CORS_ALLOWED_ORIGIN_REGEXES"] == [r"^https://.*\.cloudfront\.net$"]
    assert result["CSRF_TRUSTED_ORIGINS"] == ["https://d123.cloudfront.net"]


def test_hsts_is_opt_in_via_env():
    default = load_settings(PROD_ENV, ["SECURE_HSTS_SECONDS"])
    assert default["SECURE_HSTS_SECONDS"] == 0

    enabled = load_settings({**PROD_ENV, "SECURE_HSTS_SECONDS": "3600"}, ["SECURE_HSTS_SECONDS"])
    assert enabled["SECURE_HSTS_SECONDS"] == 3600


def test_json_log_format_configures_single_line_json_logging():
    result = load_settings({**PROD_ENV, "LOG_FORMAT": "json"}, ["LOGGING"])
    assert "json" in result["LOGGING"]["formatters"]


@pytest.mark.parametrize("style", ["path", "virtual"])
def test_s3_addressing_style_is_configurable(style):
    result = load_settings({**PROD_ENV, "AWS_S3_ADDRESSING_STYLE": style}, ["STORAGES"])
    assert result["STORAGES"]["default"]["OPTIONS"]["addressing_style"] == style


def test_s3_serves_images_through_cloudfront_when_configured():
    # 基本設計書 7章: 本番の画像用バケットは非公開で、CloudFront の /media/* 経由で配信する
    result = load_settings(
        {
            **PROD_ENV,
            "AWS_S3_CUSTOM_DOMAIN": "d123.cloudfront.net",
            "AWS_S3_LOCATION": "media",
        },
        ["STORAGES"],
    )
    opts = result["STORAGES"]["default"]["OPTIONS"]
    assert opts["custom_domain"] == "d123.cloudfront.net"
    assert opts["location"] == "media"


def test_s3_credentials_fall_back_to_boto3_default_chain_when_unset():
    # 本番は ECS タスクロールを使うため、キーは明示しない（None のとき boto3 の既定チェーン）
    result = load_settings(
        {**PROD_ENV, "AWS_ACCESS_KEY_ID": "", "AWS_SECRET_ACCESS_KEY": ""},
        ["STORAGES"],
    )
    opts = result["STORAGES"]["default"]["OPTIONS"]
    assert opts["access_key"] is None
    assert opts["secret_key"] is None
