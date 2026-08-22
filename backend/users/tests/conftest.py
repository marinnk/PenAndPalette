from users.models import User

DEFAULT_PASSWORD = "correct-horse-battery-staple"


def create_user(
    username="testuser", email="testuser@example.com", password=DEFAULT_PASSWORD, **extra_fields
):
    """テストで使う利用者を1件作成するヘルパー。

    RegisterSerializer経由ではなくUser.objects.create_user()を直接呼ぶため、
    パスワード強度バリデーション（AUTH_PASSWORD_VALIDATORS）は通らない点に注意。
    """
    display_name = extra_fields.pop("display_name", username)
    return User.objects.create_user(
        username=username,
        email=email,
        password=password,
        display_name=display_name,
        **extra_fields,
    )
