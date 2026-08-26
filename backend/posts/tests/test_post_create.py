from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Post, PostImage, Tag
from users.tests.conftest import DEFAULT_PASSWORD, create_user


def make_image(name="image.jpg", content_type="image/jpeg", content=b"jpeg-bytes"):
    return SimpleUploadedFile(name, content, content_type=content_type)


class PostCreateTests(APITestCase):
    """イラスト投稿（画像1〜4枚必須・本文任意280文字）を中心に、投稿作成の共通挙動
    （認証・画像形式・タグ）を確認する（基本設計書6.3章）。小説投稿固有の規則は
    NovelPostCreateTestsを参照。
    """

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
        response = self.client.post(
            self.url, {"post_type": "illustration", "images": [make_image()]}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_illustration_with_image_and_body_returns_201(self):
        self._login()

        response = self.client.post(
            self.url,
            {"post_type": "illustration", "body": "はじめての投稿です", "images": [make_image()]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["post_type"], "illustration")
        self.assertEqual(body["title"], "")
        self.assertEqual(body["body"], "はじめての投稿です")
        self.assertEqual(body["author"]["id"], self.user.id)
        self.assertEqual(body["like_count"], 0)
        self.assertEqual(body["want_count"], 0)
        self.assertEqual(body["comment_count"], 0)
        self.assertEqual(len(body["images"]), 1)
        self.assertEqual(body["tags"], [])
        self.assertFalse(body["liked_by_me"])

    def test_create_without_post_type_returns_400(self):
        self._login()

        response = self.client.post(self.url, {"images": [make_image()]}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("post_type", response.json())

    def test_create_with_invalid_post_type_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {"post_type": "comic", "images": [make_image()]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("post_type", response.json())

    def test_create_illustration_with_too_long_body_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {"post_type": "illustration", "body": "あ" * 281, "images": [make_image()]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_illustration_with_multiple_images_returns_201_with_urls(self):
        self._login()

        response = self.client.post(
            self.url,
            {
                "post_type": "illustration",
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

    def test_create_illustration_image_only_succeeds(self):
        self._login()

        response = self.client.post(
            self.url,
            {"post_type": "illustration", "images": [make_image()]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["body"], "")
        self.assertEqual(len(body["images"]), 1)

    def test_create_illustration_without_images_returns_400(self):
        self._login()

        response = self.client.post(
            self.url, {"post_type": "illustration", "body": "画像なし"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("images", response.json())

    def test_create_illustration_with_more_than_4_images_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {
                "post_type": "illustration",
                "body": "5枚添付",
                "images": [make_image(f"{i}.jpg") for i in range(5)],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_illustration_with_title_returns_400(self):
        # イラスト投稿ではtitleを送らない前提（基本設計書6.3章）。想定外の組み合わせとして
        # 黙って無視せず400にする
        self._login()

        response = self.client.post(
            self.url,
            {
                "post_type": "illustration",
                "title": "イラストのタイトル",
                "images": [make_image()],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.json())

    def test_create_with_invalid_image_type_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {
                "post_type": "illustration",
                "body": "不正な形式",
                "images": [make_image("a.txt", "text/plain")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_oversized_image_returns_400(self):
        self._login()
        oversized = make_image(content=b"x" * (5 * 1024 * 1024 + 1))

        response = self.client.post(
            self.url,
            {"post_type": "illustration", "body": "5MB超過", "images": [oversized]},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_preserves_image_order(self):
        self._login()

        response = self.client.post(
            self.url,
            {
                "post_type": "illustration",
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
                {
                    "post_type": "illustration",
                    "body": "アップロード失敗",
                    "images": [make_image("a.jpg"), make_image("b.jpg")],
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.assertEqual(Post.objects.count(), posts_before)
        self.assertEqual(
            PostImage.objects.filter(image_url="https://example.com/1.jpg").count(), 0
        )

    def test_create_with_tag_ids_returns_tags_in_display_order(self):
        self._login()
        tags = list(Tag.objects.order_by("display_order")[:3])

        response = self.client.post(
            self.url,
            {
                "post_type": "illustration",
                "images": [make_image()],
                "tag_ids": [tags[2].id, tags[0].id, tags[1].id],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        returned_tag_ids = [tag["id"] for tag in response.json()["tags"]]
        self.assertEqual(returned_tag_ids, [tags[0].id, tags[1].id, tags[2].id])

    def test_create_with_more_than_5_tags_returns_400(self):
        self._login()
        tag_ids = list(Tag.objects.order_by("display_order").values_list("id", flat=True)[:6])

        response = self.client.post(
            self.url,
            {"post_type": "illustration", "images": [make_image()], "tag_ids": tag_ids},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_duplicate_tag_ids_returns_400(self):
        self._login()
        tag_id = Tag.objects.order_by("display_order").first().id

        response = self.client.post(
            self.url,
            {
                "post_type": "illustration",
                "images": [make_image()],
                "tag_ids": [tag_id, tag_id],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_nonexistent_tag_id_returns_400(self):
        self._login()
        nonexistent_id = Tag.objects.order_by("-id").first().id + 999

        response = self.client.post(
            self.url,
            {
                "post_type": "illustration",
                "images": [make_image()],
                "tag_ids": [nonexistent_id],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class NovelPostCreateTests(APITestCase):
    """小説投稿（タイトル・本文必須、画像0〜1枚）固有のバリデーションを確認する
    （基本設計書6.3章）。
    """

    url = "/api/posts"

    def setUp(self):
        self.user = create_user(
            username="novelist", email="novelist@example.com", display_name="Novelist"
        )

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "novelist@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_create_novel_with_title_and_body_returns_201(self):
        self._login()

        response = self.client.post(
            self.url,
            {"post_type": "novel", "title": "はじめての小説", "body": "本文" * 10},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["post_type"], "novel")
        self.assertEqual(body["title"], "はじめての小説")
        self.assertEqual(body["body"], "本文" * 10)
        self.assertEqual(body["images"], [])

    def test_create_novel_with_cover_image_returns_201(self):
        self._login()

        response = self.client.post(
            self.url,
            {
                "post_type": "novel",
                "title": "カバー画像付き小説",
                "body": "本文",
                "images": [make_image("cover.jpg")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(len(response.json()["images"]), 1)

    def test_create_novel_with_two_images_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {
                "post_type": "novel",
                "title": "画像2枚",
                "body": "本文",
                "images": [make_image("a.jpg"), make_image("b.jpg")],
            },
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("images", response.json())

    def test_create_novel_without_title_returns_400(self):
        self._login()

        response = self.client.post(
            self.url, {"post_type": "novel", "body": "本文"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.json())

    def test_create_novel_with_too_long_title_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {"post_type": "novel", "title": "あ" * 101, "body": "本文"},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_novel_without_body_returns_400(self):
        self._login()

        response = self.client.post(
            self.url, {"post_type": "novel", "title": "本文なし"}, format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("body", response.json())

    def test_create_novel_with_4000_char_body_returns_201(self):
        self._login()

        response = self.client.post(
            self.url,
            {"post_type": "novel", "title": "上限ちょうど", "body": "あ" * 4000},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_create_novel_with_too_long_body_returns_400(self):
        self._login()

        response = self.client.post(
            self.url,
            {"post_type": "novel", "title": "上限超過", "body": "あ" * 4001},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("body", response.json())
