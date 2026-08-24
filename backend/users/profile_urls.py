"""`/api/users/`配下のエンドポイント。`users/urls.py`（`/api/auth/`配下）とは別プレフィックスのため
モジュールを分けている。F-9（ユーザー検索：GET /api/users?q=）は今後ここに追加していく。
"""

from django.urls import path

from requests_app.views import UserRequestCreateView
from users.views import FollowersListView, FollowingListView, FollowView, UserProfileView

urlpatterns = [
    path("<int:user_id>", UserProfileView.as_view(), name="user-profile"),
    path("<int:user_id>/follow", FollowView.as_view(), name="user-follow"),
    path("<int:user_id>/followers", FollowersListView.as_view(), name="user-followers"),
    path("<int:user_id>/following", FollowingListView.as_view(), name="user-following"),
    path("<int:user_id>/requests", UserRequestCreateView.as_view(), name="user-requests"),
]
