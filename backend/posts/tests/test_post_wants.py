from rest_framework import status
from rest_framework.test import APITestCase

from posts.tests.conftest import create_post
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class PostWantTests(APITestCase):
    def setUp(self):
        self.user = create_user(
            username="wantuser", email="want@example.com", display_name="Want User"
        )
        self.other = create_user(
            username="otherowner2", email="otherowner2@example.com", display_name="Other Owner2"
        )
        self.post = create_post(self.other, body="他人の投稿")
        self.url = f"/api/posts/{self.post.id}/wants"

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "want@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_want_without_login_returns_401(self):
        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_want_returns_200_with_updated_count(self):
        self._login()

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"want_count": 1, "wanted_by_me": True})

    def test_wanting_twice_is_idempotent(self):
        self._login()
        self.client.post(self.url)

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"want_count": 1, "wanted_by_me": True})

    def test_unwant_returns_200_with_decremented_count(self):
        self._login()
        self.client.post(self.url)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"want_count": 0, "wanted_by_me": False})

    def test_unwanting_when_never_wanted_is_idempotent(self):
        self._login()

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"want_count": 0, "wanted_by_me": False})

    def test_wanting_nonexistent_post_returns_404(self):
        self._login()

        response = self.client.post(f"/api/posts/{self.post.id + 999}/wants")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_like_count_is_unaffected_by_want(self):
        self._login()

        response = self.client.post(self.url)

        self.assertNotIn("like_count", response.json())
        self.assertEqual(self.post.likes.count(), 0)
