from django.apps import AppConfig


class UsersConfig(AppConfig):
    # 基本設計書 4.2章: 各テーブルのidはBIGINT。デフォルトの32bit AutoFieldではなく
    # BigAutoFieldを明示する（core/apps.pyはモデルを持たないため未指定のまま）
    default_auto_field = "django.db.models.BigAutoField"
    name = "users"
