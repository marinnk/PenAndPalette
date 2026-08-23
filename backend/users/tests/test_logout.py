from rest_framework import status
from rest_framework.test import APITestCase

from users.models import RefreshToken
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class LogoutTests(APITestCase):
    def setUp(self):
        self.user = create_user(username="logoutuser", email="logout@example.com")

    def test_logout_revokes_cookies_and_db_refresh_token(self):
        self.client.post(
            "/api/auth/login", {"email": "logout@example.com", "password": DEFAULT_PASSWORD}
        )
        self.assertEqual(
            RefreshToken.objects.filter(user=self.user, revoked_at__isnull=True).count(), 1
        )

        response = self.client.post("/api/auth/logout")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertEqual(int(response.cookies["access_token"]["max-age"]), 0)
        self.assertEqual(int(response.cookies["refresh_token"]["max-age"]), 0)
        self.assertEqual(
            RefreshToken.objects.filter(user=self.user, revoked_at__isnull=True).count(), 0
        )

    def test_logout_without_login_returns_401(self):
        response = self.client.post("/api/auth/logout")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
