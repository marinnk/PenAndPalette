from django.conf import settings
from rest_framework_simplejwt.tokens import AccessToken

from users.models import RefreshToken, User

ACCESS_COOKIE_NAME = settings.SIMPLE_JWT["AUTH_COOKIE"]  # "access_token"
REFRESH_COOKIE_NAME = "refresh_token"
REFRESH_COOKIE_PATH = "/api/auth/"


def issue_auth_cookies(response, user: User) -> None:
    """会員登録・ログイン成功時に、アクセス・リフレッシュ両トークンを新規発行しCookieにセットする。"""
    raw_refresh_token = RefreshToken.objects.issue(user)
    _set_access_cookie(response, user)
    _set_refresh_cookie(response, raw_refresh_token)


def refresh_auth_cookies(response, user: User, raw_refresh_token: str) -> None:
    """`POST /api/auth/refresh`成功時に、ローテーション済みの両トークンをCookieにセットする。"""
    _set_access_cookie(response, user)
    _set_refresh_cookie(response, raw_refresh_token)


def clear_auth_cookies(response) -> None:
    """ログアウト時に両Cookieを失効させる。

    delete_cookie()はセット時と同じpath/samesiteを指定しないとブラウザ上で別Cookie扱いになり
    消えないため、発行時と揃えている。
    """
    response.delete_cookie(ACCESS_COOKIE_NAME, path="/", samesite="Lax")
    response.delete_cookie(REFRESH_COOKIE_NAME, path=REFRESH_COOKIE_PATH, samesite="Strict")


def _set_access_cookie(response, user: User) -> None:
    access_token = str(AccessToken.for_user(user))
    response.set_cookie(
        ACCESS_COOKIE_NAME,
        access_token,
        max_age=int(settings.SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        samesite="Lax",
        path="/",
    )


def _set_refresh_cookie(response, raw_refresh_token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        raw_refresh_token,
        max_age=int(settings.AUTH_REFRESH_TOKEN_LIFETIME.total_seconds()),
        httponly=True,
        secure=settings.AUTH_COOKIE_SECURE,
        # refresh_tokenはJSからは読めず/api/auth/配下にしか送られない（Pathで絞っている）ため、
        # トップレベルナビゲーション経由で送る必要が無くStrictにしても機能上のデメリットが無い
        samesite="Strict",
        path=REFRESH_COOKIE_PATH,
    )
