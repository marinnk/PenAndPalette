from rest_framework import status
from rest_framework.test import APITestCase

from users.tests.conftest import DEFAULT_PASSWORD, create_user


class LoginTests(APITestCase):
    url = "/api/auth/login"

    def setUp(self):
        self.user = create_user(username="loginuser", email="login@example.com")

    def test_login_success_returns_200_and_sets_cookies(self):
        response = self.client.post(
            self.url, {"email": "login@example.com", "password": DEFAULT_PASSWORD}
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["username"], "loginuser")
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)

    def test_login_with_wrong_password_returns_401(self):
        response = self.client.post(
            self.url, {"email": "login@example.com", "password": "wrong-password"}
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertIn("detail", response.json())

    def test_login_with_unregistered_email_returns_401(self):
        response = self.client.post(
            self.url, {"email": "unknown@example.com", "password": DEFAULT_PASSWORD}
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_login_failure_messages_are_identical_regardless_of_cause(self):
        """メールアドレスの登録有無を外部から推測されないよう、失敗理由に関わらず同じ文言にする。"""
        wrong_password_response = self.client.post(
            self.url, {"email": "login@example.com", "password": "wrong-password"}
        )
        unknown_email_response = self.client.post(
            self.url, {"email": "unknown@example.com", "password": DEFAULT_PASSWORD}
        )

        self.assertEqual(
            wrong_password_response.json()["detail"], unknown_email_response.json()["detail"]
        )
