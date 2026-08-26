from rest_framework import status
from rest_framework.test import APITestCase

from posts.tests.conftest import create_comment, create_post, create_post_image
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class PostDetailTests(APITestCase):
    def setUp(self):
        self.user = create_user(
            username="detailuser", email="detail@example.com", display_name="Detail User"
        )
        self.post = create_post(self.user, body="詳細確認用の投稿")

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "detail@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_detail_without_login_returns_401(self):
        response = self.client.get(f"/api/posts/{self.post.id}")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_detail_returns_post(self):
        self._login()

        response = self.client.get(f"/api/posts/{self.post.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["id"], self.post.id)
        self.assertEqual(response.json()["body"], "詳細確認用の投稿")

    def test_detail_with_nonexistent_id_returns_404(self):
        self._login()

        response = self.client.get(f"/api/posts/{self.post.id + 999}")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_detail_returns_comment_count(self):
        create_comment(self.post, self.user, content="1件目")
        create_comment(self.post, self.user, content="2件目")
        self._login()

        response = self.client.get(f"/api/posts/{self.post.id}")

        self.assertEqual(response.json()["comment_count"], 2)

    def test_detail_returns_image_urls(self):
        image = create_post_image(
            self.post, image_url="https://example.com/detail.jpg", display_order=0
        )
        self._login()

        response = self.client.get(f"/api/posts/{self.post.id}")

        body = response.json()
        self.assertEqual(body["images"], ["https://example.com/detail.jpg"])
        self.assertEqual(body["image_ids"], [image.id])
