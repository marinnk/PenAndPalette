"""`/api/users/`配下のエンドポイント。`users/urls.py`（`/api/auth/`配下）とは別プレフィックスのため
モジュールを分けている。
"""

from django.urls import path

from requests_app.views import UserRequestCreateView
from users.views import (
    FollowersListView,
    FollowingListView,
    FollowView,
    MeAvatarView,
    MeProfileView,
    UserProfileView,
    UserSearchView,
)

urlpatterns = [
    # F-9 ユーザー検索（GET /api/users/?q=）。空文字path("")は、これ以降に続く
    # セグメントが無いリクエスト（=/api/users/そのもの）にのみ一致するため、
    # <int:user_id>等とは衝突しない
    path("", UserSearchView.as_view(), name="user-search"),
    # "me"は<int:user_id>のintコンバータには一致しないため衝突しないが、
    # 可読性のため自分自身向けのpathを先に置く
    path("me", MeProfileView.as_view(), name="user-me-profile"),
    path("me/avatar", MeAvatarView.as_view(), name="user-me-avatar"),
    path("<int:user_id>", UserProfileView.as_view(), name="user-profile"),
    path("<int:user_id>/follow", FollowView.as_view(), name="user-follow"),
    path("<int:user_id>/followers", FollowersListView.as_view(), name="user-followers"),
    path("<int:user_id>/following", FollowingListView.as_view(), name="user-following"),
    path("<int:user_id>/requests", UserRequestCreateView.as_view(), name="user-requests"),
]
