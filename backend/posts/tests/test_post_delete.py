from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Like, Post, Want
from posts.tests.conftest import create_post, create_post_image
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class PostDeleteTests(APITestCase):
    def setUp(self):
        self.user = create_user(username="owner", email="owner@example.com", display_name="Owner")
        self.other = create_user(username="other", email="other@example.com", display_name="Other")
        self.post = create_post(self.user, body="削除確認用の投稿")

    def _login(self, email="owner@example.com"):
        self.client.post("/api/auth/login", {"email": email, "password": DEFAULT_PASSWORD})

    def _url(self, post_id=None):
        return f"/api/posts/{post_id or self.post.id}"

    def test_delete_without_login_returns_401(self):
        response = self.client.delete(self._url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Post.objects.filter(id=self.post.id).exists())

    def test_delete_by_non_author_returns_403(self):
        self._login(email="other@example.com")

        response = self.client.delete(self._url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Post.objects.filter(id=self.post.id).exists())

    def test_delete_with_nonexistent_id_returns_404(self):
        self._login()

        response = self.client.delete(self._url(self.post.id + 999))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_returns_204_and_removes_post(self):
        self._login()

        response = self.client.delete(self._url())

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Post.objects.filter(id=self.post.id).exists())

    def test_delete_cascades_likes_and_wants(self):
        Like.objects.create(post=self.post, user=self.other)
        Want.objects.create(post=self.post, user=self.other)
        self._login()

        self.client.delete(self._url())

        self.assertEqual(Like.objects.filter(post_id=self.post.id).count(), 0)
        self.assertEqual(Want.objects.filter(post_id=self.post.id).count(), 0)

    def test_delete_removes_images_from_storage(self):
        create_post_image(self.post, image_url="https://example.com/1.jpg", display_order=0)
        create_post_image(self.post, image_url="https://example.com/2.jpg", display_order=1)
        self._login()

        with patch("posts.views.delete_image") as mock_delete:
            self.client.delete(self._url())

        self.assertEqual(mock_delete.call_count, 2)
        mock_delete.assert_any_call("https://example.com/1.jpg")
        mock_delete.assert_any_call("https://example.com/2.jpg")

    def test_delete_post_without_images_does_not_call_delete_image(self):
        self._login()

        with patch("posts.views.delete_image") as mock_delete:
            self.client.delete(self._url())

        mock_delete.assert_not_called()
