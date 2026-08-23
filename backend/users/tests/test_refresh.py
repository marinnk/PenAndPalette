from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import RefreshToken
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class RefreshTests(APITestCase):
    def setUp(self):
        self.user = create_user(username="refreshuser", email="refresh@example.com")

    def _login(self):
        response = self.client.post(
            "/api/auth/login", {"email": "refresh@example.com", "password": DEFAULT_PASSWORD}
        )
        return response.cookies["refresh_token"].value

    def test_refresh_with_valid_token_rotates_and_returns_200(self):
        old_raw_token = self._login()

        response = self.client.post("/api/auth/refresh")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new_raw_token = response.cookies["refresh_token"].value
        self.assertNotEqual(old_raw_token, new_raw_token)
        self.assertEqual(
            RefreshToken.objects.filter(user=self.user, revoked_at__isnull=True).count(), 1
        )
        self.assertEqual(RefreshToken.objects.filter(user=self.user).count(), 2)

    def test_refresh_without_cookie_returns_401(self):
        response = self.client.post("/api/auth/refresh")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_refresh_with_expired_token_returns_401(self):
        self._login()
        token = RefreshToken.objects.get(user=self.user)
        token.expires_at = timezone.now() - timedelta(days=1)
        token.save(update_fields=["expires_at"])

        response = self.client.post("/api/auth/refresh")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_reused_revoked_token_revokes_all_user_tokens(self):
        """失効済みトークンの再利用は漏えいの兆候とみなし、当該ユーザーの全トークンを失効させる。"""
        old_raw_token = self._login()
        self.client.post("/api/auth/refresh")  # 1回目のrefreshでold_raw_tokenを失効させる

        # 失効済みの古いトークンをCookieに戻して再利用する（トークン漏えいシナリオの再現）
        self.client.cookies["refresh_token"] = old_raw_token

        response = self.client.post("/api/auth/refresh")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(
            RefreshToken.objects.filter(user=self.user, revoked_at__isnull=True).count(), 0
        )
