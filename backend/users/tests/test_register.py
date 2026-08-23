from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from users.tests.conftest import create_user

User = get_user_model()


class RegisterTests(APITestCase):
    url = "/api/auth/register"

    def test_register_success_returns_201_and_sets_cookies(self):
        response = self.client.post(
            self.url,
            {
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "a-very-strong-pw-1",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["username"], "newuser")
        self.assertEqual(body["display_name"], "newuser")
        self.assertIsNone(body["avatar_url"])
        self.assertIn("access_token", response.cookies)
        self.assertIn("refresh_token", response.cookies)

    def test_register_success_hashes_password(self):
        self.client.post(
            self.url,
            {
                "username": "newuser",
                "email": "newuser@example.com",
                "password": "a-very-strong-pw-1",
            },
        )

        user = User.objects.get(username="newuser")
        self.assertNotEqual(user.password, "a-very-strong-pw-1")
        self.assertTrue(user.check_password("a-very-strong-pw-1"))

    def test_register_with_duplicate_email_returns_400(self):
        create_user(username="existing", email="dup@example.com")

        response = self.client.post(
            self.url,
            {"username": "newuser", "email": "dup@example.com", "password": "a-very-strong-pw-1"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.json())
        self.assertEqual(User.objects.filter(username="newuser").count(), 0)

    def test_register_with_duplicate_username_returns_400(self):
        create_user(username="dupuser", email="original@example.com")

        response = self.client.post(
            self.url,
            {
                "username": "dupuser",
                "email": "newuser@example.com",
                "password": "a-very-strong-pw-1",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("username", response.json())

    def test_register_with_missing_fields_returns_400(self):
        response = self.client.post(self.url, {"username": "newuser"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.json())
        self.assertIn("password", response.json())

    def test_register_with_weak_password_returns_400(self):
        response = self.client.post(
            self.url,
            {"username": "newuser", "email": "newuser@example.com", "password": "1234"},
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.json())
