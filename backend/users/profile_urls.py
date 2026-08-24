"""`/api/users/`配下のエンドポイント。`users/urls.py`（`/api/auth/`配下）とは別プレフィックスのため
モジュールを分けている。F-7（フォロー機能：/follow・/followers・/following）、F-9（ユーザー検索：
GET /api/users?q=）も今後ここに追加していく。
"""

from django.urls import path

from users.views import UserProfileView

urlpatterns = [
    path("<int:user_id>", UserProfileView.as_view(), name="user-profile"),
]
