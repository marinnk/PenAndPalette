import hashlib
import secrets

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, PermissionsMixin
from django.db import models
from django.utils import timezone

from users.managers import UserManager


class User(AbstractBaseUser, PermissionsMixin):
    """基本設計書 4.2章 usersテーブルに対応するカスタムUserモデル。

    Djangoの`AbstractUser`は`first_name`/`last_name`等、設計書に無いカラムや
    `username`の文字種・文字数制限（150字・記号制限）を持ち込むため使わない。
    `AbstractBaseUser` + `PermissionsMixin`を土台に、設計書のカラム構成を再現する。
    """

    username = models.CharField(max_length=50, unique=True)
    email = models.EmailField(max_length=255, unique=True)
    # AbstractBaseUserのpasswordフィールド（デフォルトの物理カラム名"password"）を、
    # 設計書のusers.password_hash（VARCHAR(255)）に合わせて物理カラム名だけ上書きする。
    # set_password()/check_password()等の挙動・Python側の属性名(user.password)は変わらない
    password = models.CharField(max_length=255, db_column="password_hash")
    display_name = models.CharField(max_length=50)
    bio = models.CharField(max_length=160, blank=True, null=True)
    avatar_url = models.CharField(max_length=500, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # 設計書4.2章には無いが、django.contrib.admin/authが既にINSTALLED_APPSにある以上、
    # Djangoのユーザーモデルとして機能させるために必要な最小限のフィールド
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)

    objects = UserManager()

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["username", "display_name"]

    class Meta:
        db_table = "users"

    def __str__(self):
        return self.username


def hash_token(raw_token: str) -> str:
    """リフレッシュトークンの生の値からSHA-256ハッシュを計算する。

    DBには生の値ではなくこのハッシュ値のみを保存する（基本設計書 4.2章 refresh_tokens）。
    """
    return hashlib.sha256(raw_token.encode()).hexdigest()


class InvalidRefreshToken(Exception):
    """リフレッシュトークンが無効（存在しない・期限切れ・失効済み）な場合に送出する。"""


class RefreshTokenManager(models.Manager):
    def issue(self, user: "User") -> str:
        """新しいリフレッシュトークンを発行し、生の値を返す（DBにはハッシュのみ保存する）。"""
        raw_token = secrets.token_urlsafe(32)
        self.create(
            user=user,
            token_hash=hash_token(raw_token),
            expires_at=timezone.now() + settings.AUTH_REFRESH_TOKEN_LIFETIME,
        )
        return raw_token

    def rotate(self, raw_token: str) -> tuple["User", str]:
        """リフレッシュトークンを検証し、失効させた上で新しいトークンを発行する（ローテーション）。

        失効済みトークンが再度使われた場合はトークン漏えいの兆候とみなし、
        そのユーザーの有効な全リフレッシュトークンを失効させる（基本設計書3章）。

        同一トークンでの同時リクエスト（競合状態）に対する行ロック（select_for_update）は
        学習規模のスコープでは想定しにくいため今回は入れていない。必要になれば追って強化する。
        """
        try:
            existing = self.select_related("user").get(token_hash=hash_token(raw_token))
        except self.model.DoesNotExist as exc:
            raise InvalidRefreshToken from exc

        if existing.revoked_at is not None:
            self.filter(user_id=existing.user_id, revoked_at__isnull=True).update(
                revoked_at=timezone.now()
            )
            raise InvalidRefreshToken

        if existing.expires_at < timezone.now():
            raise InvalidRefreshToken

        existing.revoked_at = timezone.now()
        existing.save(update_fields=["revoked_at"])
        return existing.user, self.issue(existing.user)

    def revoke(self, raw_token: str) -> None:
        """ログアウト時に指定のリフレッシュトークンを失効させる。"""
        self.filter(token_hash=hash_token(raw_token), revoked_at__isnull=True).update(
            revoked_at=timezone.now()
        )


class RefreshToken(models.Model):
    """基本設計書 4.2章 refresh_tokensテーブルに対応するモデル。

    1人のuserは複数のrefresh_tokensを持てる（マルチデバイスでのログインに対応するため）。
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="refresh_tokens"
    )
    token_hash = models.CharField(max_length=255, unique=True)
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = RefreshTokenManager()

    class Meta:
        db_table = "refresh_tokens"
