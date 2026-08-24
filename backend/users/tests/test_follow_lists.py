from rest_framework import status
from rest_framework.test import APITestCase

from users.models import Follow
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class FollowListTests(APITestCase):
    """GET /api/users/{id}/followers・/following（基本設計書6.6章）。"""

    def setUp(self):
        self.viewer = create_user(
            username="viewer", email="viewer@example.com", display_name="Viewer"
        )
        self.center = create_user(
            username="center", email="center@example.com", display_name="Center"
        )
        self.follower_of_center = create_user(
            username="follower_of_center",
            email="follower_of_center@example.com",
            display_name="Follower Of Center",
        )
        self.followee_of_center = create_user(
            username="followee_of_center",
            email="followee_of_center@example.com",
            display_name="Followee Of Center",
        )
        Follow.objects.add(self.follower_of_center, self.center)
        Follow.objects.add(self.center, self.followee_of_center)

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "viewer@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_followers_without_login_returns_401(self):
        response = self.client.get(f"/api/users/{self.center.id}/followers")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_followers_returns_users_following_the_target(self):
        self._login()

        response = self.client.get(f"/api/users/{self.center.id}/followers")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["id"] for row in response.json()], [self.follower_of_center.id])

    def test_following_returns_users_the_target_follows(self):
        self._login()

        response = self.client.get(f"/api/users/{self.center.id}/following")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["id"] for row in response.json()], [self.followee_of_center.id])

    def test_followers_of_nonexistent_user_returns_404(self):
        self._login()

        response = self.client.get(f"/api/users/{self.center.id + 999}/followers")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
