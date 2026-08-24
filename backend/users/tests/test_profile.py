from rest_framework import status
from rest_framework.test import APITestCase

from users.tests.conftest import DEFAULT_PASSWORD, create_user


class UserProfileTests(APITestCase):
    def setUp(self):
        self.viewer = create_user(
            username="viewer", email="viewer@example.com", display_name="Viewer"
        )
        self.target = create_user(
            username="target",
            email="target@example.com",
            display_name="Target User",
            bio="よろしくお願いします",
        )

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "viewer@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_profile_without_login_returns_401(self):
        response = self.client.get(f"/api/users/{self.target.id}")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_profile_returns_target_user_info(self):
        self._login()

        response = self.client.get(f"/api/users/{self.target.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "id": self.target.id,
                "username": "target",
                "display_name": "Target User",
                "bio": "よろしくお願いします",
                "avatar_url": None,
            },
        )

    def test_profile_with_nonexistent_id_returns_404(self):
        self._login()

        response = self.client.get(f"/api/users/{self.target.id + 999}")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
