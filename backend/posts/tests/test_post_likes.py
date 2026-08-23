from rest_framework import status
from rest_framework.test import APITestCase

from posts.tests.conftest import create_post
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class PostLikeTests(APITestCase):
    def setUp(self):
        self.user = create_user(
            username="likeuser", email="like@example.com", display_name="Like User"
        )
        self.other = create_user(
            username="otherowner", email="otherowner@example.com", display_name="Other Owner"
        )
        self.post = create_post(self.other, body="他人の投稿")
        self.url = f"/api/posts/{self.post.id}/likes"

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "like@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_like_without_login_returns_401(self):
        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_like_returns_200_with_updated_count(self):
        self._login()

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"like_count": 1, "liked_by_me": True})

    def test_liking_twice_is_idempotent(self):
        self._login()
        self.client.post(self.url)

        response = self.client.post(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"like_count": 1, "liked_by_me": True})

    def test_unlike_returns_200_with_decremented_count(self):
        self._login()
        self.client.post(self.url)

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"like_count": 0, "liked_by_me": False})

    def test_unliking_when_never_liked_is_idempotent(self):
        self._login()

        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"like_count": 0, "liked_by_me": False})

    def test_liking_nonexistent_post_returns_404(self):
        self._login()

        response = self.client.post(f"/api/posts/{self.post.id + 999}/likes")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_want_count_is_unaffected_by_like(self):
        self._login()

        response = self.client.post(self.url)

        # like_count/liked_by_meのみを返す仕様（基本設計書6.5章）で、wantには影響しないことの確認
        self.assertNotIn("want_count", response.json())
        self.assertEqual(self.post.wants.count(), 0)
