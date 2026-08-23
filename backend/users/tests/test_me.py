from rest_framework import status
from rest_framework.test import APITestCase

from users.tests.conftest import DEFAULT_PASSWORD, create_user


class MeTests(APITestCase):
    url = "/api/auth/me"

    def setUp(self):
        self.user = create_user(username="meuser", email="me@example.com", display_name="Me User")

    def test_me_without_login_returns_401(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_me_after_login_returns_current_user(self):
        self.client.post(
            "/api/auth/login", {"email": "me@example.com", "password": DEFAULT_PASSWORD}
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "id": self.user.id,
                "username": "meuser",
                "display_name": "Me User",
                "avatar_url": None,
            },
        )

    def test_me_with_invalid_access_token_returns_401(self):
        self.client.post(
            "/api/auth/login", {"email": "me@example.com", "password": DEFAULT_PASSWORD}
        )
        # 期限切れトークンを直接用意する代わりに、不正なトークン値で同じ検証失敗経路を確認する
        self.client.cookies["access_token"] = "invalid-or-expired-token"

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
