from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import PostImage
from posts.tests.conftest import create_post, create_post_image
from users.tests.conftest import DEFAULT_PASSWORD, create_user


def make_image(name="image.jpg", content_type="image/jpeg", content=b"jpeg-bytes"):
    return SimpleUploadedFile(name, content, content_type=content_type)


class PostUpdateTests(APITestCase):
    def setUp(self):
        self.user = create_user(username="owner", email="owner@example.com", display_name="Owner")
        self.other = create_user(username="other", email="other@example.com", display_name="Other")
        self.post = create_post(self.user, body="編集前の本文")

    def _login(self, email="owner@example.com"):
        self.client.post("/api/auth/login", {"email": email, "password": DEFAULT_PASSWORD})

    def _url(self, post_id=None):
        return f"/api/posts/{post_id or self.post.id}"

    def test_update_without_login_returns_401(self):
        response = self.client.put(self._url(), {"body": "更新後"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_by_non_author_returns_403(self):
        self._login(email="other@example.com")

        response = self.client.put(self._url(), {"body": "更新後"}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.post.refresh_from_db()
        self.assertEqual(self.post.body, "編集前の本文")

    def test_update_with_nonexistent_id_returns_404(self):
        self._login()

        response = self.client.put(
            self._url(self.post.id + 999), {"body": "更新後"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_body_only_returns_200(self):
        self._login()

        response = self.client.put(self._url(), {"body": "更新後の本文"}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["body"], "更新後の本文")
        self.post.refresh_from_db()
        self.assertEqual(self.post.body, "更新後の本文")

    def test_update_without_body_or_images_returns_400(self):
        self._login()

        response = self.client.put(self._url(), {"body": ""}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_keeps_and_adds_images(self):
        image1 = create_post_image(
            self.post, image_url="https://example.com/1.jpg", display_order=0
        )
        image2 = create_post_image(
            self.post, image_url="https://example.com/2.jpg", display_order=1
        )
        self._login()

        response = self.client.put(
            self._url(),
            {
                "body": "画像を1枚追加",
                "keep_image_ids": f"{image1.id},{image2.id}",
                "images": [make_image("new.jpg")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(len(body["images"]), 3)
        self.assertEqual(body["images"][0], "https://example.com/1.jpg")
        self.assertEqual(body["images"][1], "https://example.com/2.jpg")

    def test_update_removes_images_not_in_keep_image_ids(self):
        image1 = create_post_image(
            self.post, image_url="https://example.com/1.jpg", display_order=0
        )
        create_post_image(self.post, image_url="https://example.com/2.jpg", display_order=1)
        self._login()

        with patch("posts.views.delete_image") as mock_delete:
            response = self.client.put(
                self._url(),
                {"body": "1枚だけ残す", "keep_image_ids": str(image1.id)},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["images"], ["https://example.com/1.jpg"])
        mock_delete.assert_called_once_with("https://example.com/2.jpg")

    def test_update_with_keep_image_ids_from_another_post_returns_400(self):
        other_post = create_post(self.other, body="他人の投稿")
        other_image = create_post_image(other_post, image_url="https://example.com/other.jpg")
        self._login()

        response = self.client.put(
            self._url(),
            {"body": "本文", "keep_image_ids": str(other_image.id)},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_with_more_than_4_images_total_returns_400(self):
        for i in range(3):
            create_post_image(self.post, image_url=f"https://example.com/{i}.jpg", display_order=i)
        keep_ids = ",".join(str(pk) for pk in self.post.images.values_list("id", flat=True))
        self._login()

        response = self.client.put(
            self._url(),
            {
                "body": "4枚超過",
                "keep_image_ids": keep_ids,
                "images": [make_image("a.jpg"), make_image("b.jpg")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_with_invalid_new_image_returns_400(self):
        self._login()

        response = self.client.put(
            self._url(),
            {"body": "不正な画像", "images": [make_image("a.txt", "text/plain")]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_rolls_back_and_does_not_delete_images_when_upload_fails_midway(self):
        image1 = create_post_image(
            self.post, image_url="https://example.com/1.jpg", display_order=0
        )
        self._login()
        self.client.raise_request_exception = False

        with (
            patch("posts.serializers.upload_image", side_effect=OSError),
            patch("posts.views.delete_image") as mock_delete,
        ):
            response = self.client.put(
                self._url(),
                {"body": "失敗させる", "images": [make_image("a.jpg")]},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.post.refresh_from_db()
        self.assertEqual(self.post.body, "編集前の本文")
        self.assertTrue(PostImage.objects.filter(id=image1.id).exists())
        mock_delete.assert_not_called()
