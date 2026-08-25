from django.apps import AppConfig


class RequestsAppConfig(AppConfig):
    # 基本設計書 4.2章: 各テーブルのidはBIGINT。デフォルトの32bit AutoFieldではなく
    # BigAutoFieldを明示する（users/apps.py・posts/apps.pyと同じ方針）
    default_auto_field = "django.db.models.BigAutoField"
    # アプリ名を"requests"にすると、PyPIの`requests`ライブラリをどこかで`import requests`
    # した際にこのアプリパッケージが優先されてしまう恐れがあるため、"requests_app"にする。
    # DBのテーブル名（Meta.db_table）・URLパスは基本設計書・画面設計書通り"requests"のまま
    name = "requests_app"
