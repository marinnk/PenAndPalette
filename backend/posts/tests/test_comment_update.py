from unittest.mock import patch

from rest_framework import status
from rest_framework.test import APITestCase

from posts.tests.conftest import create_comment, create_post, make_image
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class CommentUpdateTests(APITestCase):
    def setUp(self):
        self.user = create_user(username="owner", email="owner@example.com", display_name="Owner")
        self.other = create_user(username="other", email="other@example.com", display_name="Other")
        self.post = create_post(self.user, body="投稿")
        self.comment = create_comment(self.post, self.user, content="編集前のコメント")

    def _login(self, email="owner@example.com"):
        self.client.post("/api/auth/login", {"email": email, "password": DEFAULT_PASSWORD})

    def _url(self, comment_id=None):
        return f"/api/comments/{comment_id or self.comment.id}"

    def test_update_without_login_returns_401(self):
        response = self.client.put(self._url(), {"content": "更新後"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_by_non_author_returns_403(self):
        self._login(email="other@example.com")

        response = self.client.put(self._url(), {"content": "更新後"}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.content, "編集前のコメント")
        # IsOwnerはPost・Commentで共用するため、エラーメッセージが「投稿」固定になっておらず
        # 「コメント」にも言及していることを確認する（common/permissions.py参照）
        self.assertIn("コメント", response.json()["detail"])

    def test_update_with_nonexistent_id_returns_404(self):
        self._login()

        response = self.client.put(
            self._url(self.comment.id + 999), {"content": "更新後"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_content_only_returns_200(self):
        self._login()

        response = self.client.put(
            self._url(), {"content": "更新後のコメント"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["content"], "更新後のコメント")
        self.comment.refresh_from_db()
        self.assertEqual(self.comment.content, "更新後のコメント")

    def test_update_without_content_or_image_returns_400(self):
        # 本文を空にし、画像も無い（remove_imageも送らない）状態で更新しようとすると400
        self._login()

        response = self.client.put(self._url(), {"content": ""}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_keeps_existing_image_when_neither_image_nor_remove_image_sent(self):
        comment = create_comment(
            self.post, self.user, content="画像付き", image_url="https://example.com/1.jpg"
        )
        self._login()

        response = self.client.put(
            self._url(comment.id), {"content": "本文だけ更新"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["image_url"], "https://example.com/1.jpg")

    def test_update_without_content_field_keeps_existing_content(self):
        # contentキー自体を送らない場合（空文字を明示的に送るのとは違う）は、既存の本文を
        # 維持する。imageを省略した場合に既存画像を維持するのと同じ挙動に揃える
        comment = create_comment(
            self.post, self.user, content="既存の本文", image_url="https://example.com/1.jpg"
        )
        self._login()

        response = self.client.put(
            self._url(comment.id), {"remove_image": "false"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["content"], "既存の本文")
        comment.refresh_from_db()
        self.assertEqual(comment.content, "既存の本文")

    def test_update_replaces_image(self):
        comment = create_comment(
            self.post, self.user, content="画像付き", image_url="https://example.com/old.jpg"
        )
        self._login()

        with patch("common.storage.delete_image") as mock_delete:
            response = self.client.put(
                self._url(comment.id),
                {"content": "画像を差し替え", "image": make_image("new.jpg")},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        new_url = response.json()["image_url"]
        self.assertNotEqual(new_url, "https://example.com/old.jpg")
        mock_delete.assert_called_once_with("https://example.com/old.jpg")

    def test_update_with_remove_image_true_clears_image(self):
        comment = create_comment(
            self.post, self.user, content="画像付き", image_url="https://example.com/1.jpg"
        )
        self._login()

        with patch("common.storage.delete_image") as mock_delete:
            response = self.client.put(
                self._url(comment.id),
                {"content": "画像を削除", "remove_image": "true"},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.json()["image_url"])
        mock_delete.assert_called_once_with("https://example.com/1.jpg")

    def test_update_with_remove_image_true_and_no_content_returns_400_if_no_image_would_remain(
        self,
    ):
        comment = create_comment(
            self.post, self.user, content=None, image_url="https://example.com/1.jpg"
        )
        self._login()

        response = self.client.put(
            self._url(comment.id), {"remove_image": "true"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_with_invalid_image_type_returns_400(self):
        self._login()

        response = self.client.put(
            self._url(),
            {"content": "不正な画像", "image": make_image("a.txt", "text/plain")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
