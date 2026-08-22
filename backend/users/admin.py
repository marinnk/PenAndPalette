from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from users.models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    """開発時にDjango管理サイトからDBの中身を確認するための最小限のカスタマイズ。"""

    model = User
    ordering = ["id"]
    list_display = ["id", "username", "email", "display_name", "is_staff"]
    search_fields = ["username", "email", "display_name"]
    fieldsets = (
        (None, {"fields": ("username", "email", "password")}),
        ("プロフィール", {"fields": ("display_name", "bio", "avatar_url")}),
        (
            "権限",
            {"fields": ("is_active", "is_staff", "is_superuser", "groups", "user_permissions")},
        ),
        ("日時", {"fields": ("last_login",)}),
    )
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": ("username", "email", "display_name", "password1", "password2"),
            },
        ),
    )
