from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from users.tests.conftest import DEFAULT_PASSWORD, create_user


def make_image(name="avatar.jpg", content_type="image/jpeg", content=b"jpeg-bytes"):
    return SimpleUploadedFile(name, content, content_type=content_type)


class MeAvatarTests(APITestCase):
    url = "/api/users/me/avatar"

    def setUp(self):
        self.user = create_user(username="meuser", email="me@example.com", display_name="Me User")

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "me@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_upload_without_login_returns_401(self):
        response = self.client.post(self.url, {"file": make_image()}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_upload_registers_avatar_and_returns_profile(self):
        self._login()

        with patch(
            "users.serializers.upload_image", return_value="https://example.com/avatars/1.jpg"
        ):
            response = self.client.post(self.url, {"file": make_image()}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["avatar_url"], "https://example.com/avatars/1.jpg")
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar_url, "https://example.com/avatars/1.jpg")

    def test_upload_replaces_existing_avatar_and_deletes_old_one(self):
        self.user.avatar_url = "https://example.com/avatars/old.jpg"
        self.user.save(update_fields=["avatar_url"])
        self._login()

        with (
            patch(
                "users.serializers.upload_image",
                return_value="https://example.com/avatars/new.jpg",
            ),
            patch("users.views.delete_image") as mock_delete,
        ):
            response = self.client.post(self.url, {"file": make_image()}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["avatar_url"], "https://example.com/avatars/new.jpg")
        mock_delete.assert_called_once_with("https://example.com/avatars/old.jpg")

    def test_upload_without_file_returns_400(self):
        self._login()

        response = self.client.post(self.url, {}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_with_invalid_content_type_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {"file": make_image("avatar.txt", "text/plain")},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.avatar_url)

    def test_upload_with_oversized_file_returns_400(self):
        self._login()
        oversized = make_image(content=b"0" * (5 * 1024 * 1024 + 1))

        response = self.client.post(self.url, {"file": oversized}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_upload_succeeds_even_if_old_avatar_delete_fails(self):
        # DBの更新は既に確定しているため、後始末のS3削除が失敗してもレスポンス自体は成功させる
        self.user.avatar_url = "https://example.com/avatars/old.jpg"
        self.user.save(update_fields=["avatar_url"])
        self._login()

        with (
            patch(
                "users.serializers.upload_image",
                return_value="https://example.com/avatars/new.jpg",
            ),
            patch("users.views.delete_image", side_effect=OSError),
        ):
            response = self.client.post(self.url, {"file": make_image()}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_delete_without_login_returns_401(self):
        response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_delete_removes_avatar_and_deletes_s3_object(self):
        self.user.avatar_url = "https://example.com/avatars/old.jpg"
        self.user.save(update_fields=["avatar_url"])
        self._login()

        with patch("users.views.delete_image") as mock_delete:
            response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.json()["avatar_url"])
        mock_delete.assert_called_once_with("https://example.com/avatars/old.jpg")
        self.user.refresh_from_db()
        self.assertIsNone(self.user.avatar_url)

    def test_delete_when_avatar_not_set_returns_200_idempotently(self):
        self._login()

        with patch("users.views.delete_image") as mock_delete:
            response = self.client.delete(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.json()["avatar_url"])
        mock_delete.assert_not_called()
