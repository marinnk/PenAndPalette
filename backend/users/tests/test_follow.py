from rest_framework import status
from rest_framework.test import APITestCase

from users.models import Follow
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class FollowTests(APITestCase):
    def setUp(self):
        self.user = create_user(
            username="follower", email="follower@example.com", display_name="Follower"
        )
        self.target = create_user(
            username="followee", email="followee@example.com", display_name="Followee"
        )
        self.url = f"/api/users/{self.target.id}/follow"

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "follower@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_follow_without_login_returns_401(self):
        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_follow_returns_200_with_updated_stats(self):
        self._login()

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"followed_by_me": True, "follower_count": 1})
        self.assertTrue(Follow.objects.filter(follower=self.user, followee=self.target).exists())

    def test_following_twice_is_idempotent(self):
        self._login()
        self.client.post(self.url)

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"followed_by_me": True, "follower_count": 1})
        self.assertEqual(Follow.objects.filter(followee=self.target).count(), 1)

    def test_unfollow_returns_200_with_decremented_count(self):
        self._login()
        self.client.post(self.url)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"followed_by_me": False, "follower_count": 0})

    def test_unfollowing_when_never_followed_is_idempotent(self):
        self._login()

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"followed_by_me": False, "follower_count": 0})

    def test_self_follow_returns_400(self):
        self._login()

        response = self.client.post(f"/api/users/{self.user.id}/follow")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(Follow.objects.filter(follower=self.user, followee=self.user).exists())

    def test_following_nonexistent_user_returns_404(self):
        self._login()

        response = self.client.post(f"/api/users/{self.target.id + 999}/follow")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
