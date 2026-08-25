"""`/api/requests/`配下のエンドポイント。宛先固定で送る側のPOSTは`/api/users/{id}/requests`
（users/profile_urls.py）にあるため、ここには受信一覧のGETのみを置く。
"""

from django.urls import path

from requests_app.views import ReceivedRequestListView

urlpatterns = [
    path("requests/received", ReceivedRequestListView.as_view(), name="request-received"),
]
