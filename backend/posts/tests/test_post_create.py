from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Post, PostImage
from users.tests.conftest import DEFAULT_PASSWORD, create_user


def make_image(name="image.jpg", content_type="image/jpeg", content=b"jpeg-bytes"):
    return SimpleUploadedFile(name, content, content_type=content_type)


class PostCreateTests(APITestCase):
    url = "/api/posts"

    def setUp(self):
        self.user = create_user(
            username="creator", email="creator@example.com", display_name="Creator"
        )

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "creator@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_create_without_login_returns_401(self):
        response = self.client.post(self.url, {"body": "本文"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_with_valid_body_returns_201(self):
        self._login()

        response = self.client.post(self.url, {"body": "はじめての投稿です"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["body"], "はじめての投稿です")
        self.assertEqual(body["author"]["id"], self.user.id)
        self.assertEqual(body["like_count"], 0)
        self.assertEqual(body["want_count"], 0)
        self.assertEqual(body["comment_count"], 0)
        self.assertEqual(body["images"], [])
        self.assertFalse(body["liked_by_me"])

    def test_create_with_empty_body_returns_400(self):
        self._login()

        response = self.client.post(self.url, {"body": ""})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_too_long_body_returns_400(self):
        self._login()

        response = self.client.post(self.url, {"body": "あ" * 281})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_images_returns_201_with_urls(self):
        self._login()

        response = self.client.post(
            self.url,
            {
                "body": "画像付き投稿",
                "images": [make_image("a.jpg"), make_image("b.png", "image/png")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(len(body["images"]), 2)
        for url in body["images"]:
            self.assertTrue(url)

    def test_create_images_only_succeeds(self):
        self._login()

        response = self.client.post(self.url, {"images": [make_image()]}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["body"], "")
        self.assertEqual(len(body["images"]), 1)

    def test_create_without_body_or_images_returns_400(self):
        self._login()

        response = self.client.post(self.url, {}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_more_than_4_images_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {"body": "5枚添付", "images": [make_image(f"{i}.jpg") for i in range(5)]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_invalid_image_type_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {"body": "不正な形式", "images": [make_image("a.txt", "text/plain")]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_oversized_image_returns_400(self):
        self._login()
        oversized = make_image(content=b"x" * (5 * 1024 * 1024 + 1))

        response = self.client.post(
            self.url, {"body": "5MB超過", "images": [oversized]}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_preserves_image_order(self):
        self._login()

        response = self.client.post(
            self.url,
            {
                "body": "順番確認",
                "images": [
                    make_image("first.jpg"),
                    make_image("second.jpg"),
                    make_image("third.jpg"),
                ],
            },
            format="multipart",
        )

        post_id = response.json()["id"]
        urls_in_order = list(
            PostImage.objects.filter(post_id=post_id)
            .order_by("display_order")
            .values_list("image_url", flat=True)
        )
        self.assertEqual(urls_in_order, response.json()["images"])

    def test_create_rolls_back_post_and_images_when_upload_fails_midway(self):
        """2枚目の画像アップロードが失敗した場合、1枚目の画像もPost自体もDBに
        残らないこと（transaction.atomicによるロールバック）を確認する。
        """
        self._login()
        posts_before = Post.objects.count()
        # ビュー内で送出された例外をpytestまで伝播させず、通常のHTTPレスポンス（500）として
        # 受け取れるようにする
        self.client.raise_request_exception = False

        with patch(
            "posts.serializers.upload_image", side_effect=["https://example.com/1.jpg", OSError]
        ):
            response = self.client.post(
                self.url,
                {"body": "アップロード失敗", "images": [make_image("a.jpg"), make_image("b.jpg")]},
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(Post.objects.count(), posts_before)
        self.assertEqual(
            PostImage.objects.filter(image_url="https://example.com/1.jpg").count(), 0
        )
