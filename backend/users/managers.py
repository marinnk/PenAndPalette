from django.contrib.auth.base_user import BaseUserManager


class UserManager(BaseUserManager):
    """`email`を識別子（USERNAME_FIELD）として利用者を作成するマネージャー。"""

    use_in_migrations = True

    def _create_user(self, username, email, display_name, password, **extra_fields):
        if not username:
            raise ValueError("ユーザー名は必須です。")
        if not email:
            raise ValueError("メールアドレスは必須です。")

        email = self.normalize_email(email)
        user = self.model(
            username=username,
            email=email,
            display_name=display_name or username,
            **extra_fields,
        )
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, username, email, password=None, display_name=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(username, email, display_name, password, **extra_fields)

    def create_superuser(self, username, email, password=None, display_name=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("createsuperuserはis_staff=Trueである必要があります。")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("createsuperuserはis_superuser=Trueである必要があります。")

        return self._create_user(username, email, display_name, password, **extra_fields)
