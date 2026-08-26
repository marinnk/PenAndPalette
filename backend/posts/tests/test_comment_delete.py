from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Comment
from posts.tests.conftest import create_comment, create_post
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class CommentDeleteTests(APITestCase):
    def setUp(self):
        self.user = create_user(username="owner", email="owner@example.com", display_name="Owner")
        self.other = create_user(username="other", email="other@example.com", display_name="Other")
        self.post = create_post(self.user, body="投稿")
        self.comment = create_comment(self.post, self.user, content="削除確認用コメント")

    def _login(self, email="owner@example.com"):
        self.client.post("/api/auth/login", {"email": email, "password": DEFAULT_PASSWORD})

    def _url(self, comment_id=None):
        return f"/api/comments/{comment_id or self.comment.id}"

    def test_delete_without_login_returns_401(self):
        response = self.client.delete(self._url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertTrue(Comment.objects.filter(id=self.comment.id).exists())

    def test_delete_by_non_author_returns_403(self):
        self._login(email="other@example.com")

        response = self.client.delete(self._url())

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Comment.objects.filter(id=self.comment.id).exists())

    def test_delete_with_nonexistent_id_returns_404(self):
        self._login()

        response = self.client.delete(self._url(self.comment.id + 999))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_returns_204_and_removes_comment(self):
        self._login()

        response = self.client.delete(self._url())

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Comment.objects.filter(id=self.comment.id).exists())

    def test_delete_decrements_post_comment_count(self):
        create_comment(self.post, self.other, content="残るコメント")
        self._login()

        self.client.delete(self._url())

        response = self.client.get(f"/api/posts/{self.post.id}")
        self.assertEqual(response.json()["comment_count"], 1)

    def test_delete_removes_image_from_storage(self):
        comment = create_comment(
            self.post, self.user, content="画像付き", image_url="https://example.com/1.jpg"
        )
        self._login()

        with patch("common.storage.delete_image") as mock_delete:
            self.client.delete(self._url(comment.id))

        mock_delete.assert_called_once_with("https://example.com/1.jpg")

    def test_delete_comment_without_image_does_not_call_delete_image(self):
        self._login()

        with patch("common.storage.delete_image") as mock_delete:
            self.client.delete(self._url())

        mock_delete.assert_not_called()
