from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Comment
from posts.tests.conftest import create_post, make_image
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class CommentCreateTests(APITestCase):
    def setUp(self):
        self.user = create_user(
            username="commenter", email="commenter@example.com", display_name="Commenter"
        )
        self.author = create_user(
            username="author", email="author@example.com", display_name="Author"
        )
        self.post = create_post(self.author, body="コメント対象の投稿")

    def _login(self, email="commenter@example.com"):
        self.client.post("/api/auth/login", {"email": email, "password": DEFAULT_PASSWORD})

    def _url(self, post_id=None):
        return f"/api/posts/{post_id or self.post.id}/comments"

    def test_create_without_login_returns_401(self):
        response = self.client.post(self._url(), {"content": "本文"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_with_nonexistent_post_returns_404(self):
        self._login()

        response = self.client.post(self._url(self.post.id + 999), {"content": "本文"})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_with_content_only_returns_201(self):
        self._login()

        response = self.client.post(self._url(), {"content": "はじめてのコメントです"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["content"], "はじめてのコメントです")
        self.assertIsNone(body["image_url"])
        self.assertEqual(body["author"]["id"], self.user.id)

    def test_create_can_comment_on_own_post(self):
        # 投稿者本人も自分の投稿にコメントできる（comment.md 3章）
        self._login(email="author@example.com")

        response = self.client.post(self._url(), {"content": "自分の投稿にコメント"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_increments_post_comment_count(self):
        self._login()

        self.client.post(self._url(), {"content": "1件目"})
        self.client.post(self._url(), {"content": "2件目"})

        response = self.client.get(f"/api/posts/{self.post.id}")
        self.assertEqual(response.json()["comment_count"], 2)

    def test_create_with_image_only_succeeds(self):
        self._login()

        response = self.client.post(self._url(), {"image": make_image()}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["content"], "")
        self.assertTrue(body["image_url"])

    def test_create_without_content_or_image_returns_400(self):
        self._login()

        response = self.client.post(self._url(), {}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_too_long_content_returns_400(self):
        self._login()

        response = self.client.post(self._url(), {"content": "あ" * 281})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_invalid_image_type_returns_400(self):
        self._login()

        response = self.client.post(
            self._url(),
            {"content": "不正な形式", "image": make_image("a.txt", "text/plain")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_oversized_image_returns_400(self):
        self._login()
        oversized = make_image(content=b"x" * (5 * 1024 * 1024 + 1))

        response = self.client.post(
            self._url(), {"content": "5MB超過", "image": oversized}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_upload_failure_does_not_create_comment(self):
        self._login()
        comments_before = Comment.objects.count()
        self.client.raise_request_exception = False

        with patch("posts.serializers.upload_image", side_effect=OSError):
            response = self.client.post(self._url(), {"image": make_image()}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(Comment.objects.count(), comments_before)
