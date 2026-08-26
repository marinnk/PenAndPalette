from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Post, PostImage, Tag
from posts.tests.conftest import create_post, create_post_image
from users.tests.conftest import DEFAULT_PASSWORD, create_user


def make_image(name="image.jpg", content_type="image/jpeg", content=b"jpeg-bytes"):
    return SimpleUploadedFile(name, content, content_type=content_type)


class PostUpdateTests(APITestCase):
    """イラスト投稿の編集を中心に、投稿編集の共通挙動（認証・所有者チェック・画像の
    差し替え・タグ）を確認する（基本設計書6.3章）。小説投稿固有の規則は
    NovelPostUpdateTestsを参照。
    """

    def setUp(self):
        self.user = create_user(username="owner", email="owner@example.com", display_name="Owner")
        self.other = create_user(username="other", email="other@example.com", display_name="Other")
        # イラスト投稿は画像1〜4枚必須のため、編集後も種別の規則を満たせるよう
        # 画像1枚を持つ投稿をsetUpで用意する
        self.post = create_post(self.user, body="編集前の本文")
        self.image = create_post_image(
            self.post, image_url="https://example.com/original.jpg", display_order=0
        )

    def _login(self, email="owner@example.com"):
        self.client.post("/api/auth/login", {"email": email, "password": DEFAULT_PASSWORD})

    def _url(self, post_id=None):
        return f"/api/posts/{post_id or self.post.id}"

    def _payload(self, **overrides):
        payload = {
            "body": "更新後",
            "keep_image_ids": str(self.image.id),
            "tag_ids": "",
        }
        payload.update(overrides)
        return payload

    def test_update_without_login_returns_401(self):
        response = self.client.put(self._url(), self._payload(), format="multipart")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_by_non_author_returns_403(self):
        self._login(email="other@example.com")

        response = self.client.put(self._url(), self._payload(), format="multipart")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.post.refresh_from_db()
        self.assertEqual(self.post.body, "編集前の本文")
        # IsOwnerはPost・Commentで共用するため、文言から「投稿」が抜け落ちていないことを
        # 確認する（common/permissions.py参照）
        self.assertIn("投稿", response.json()["detail"])

    def test_update_with_nonexistent_id_returns_404(self):
        self._login()

        response = self.client.put(
            self._url(self.post.id + 999), self._payload(), format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_body_only_returns_200(self):
        self._login()

        response = self.client.put(
            self._url(), self._payload(body="更新後の本文"), format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["body"], "更新後の本文")
        self.post.refresh_from_db()
        self.assertEqual(self.post.body, "更新後の本文")

    def test_update_post_type_in_body_is_ignored(self):
        # post_typeは作成時に固定され編集では変更できない（基本設計書6.3章）。
        # PUTボディに含めても無視され、既存のpost_typeのまま
        self._login()

        response = self.client.put(
            self._url(), self._payload(post_type="novel"), format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["post_type"], "illustration")
        self.post.refresh_from_db()
        self.assertEqual(self.post.post_type, Post.PostType.ILLUSTRATION)

    def test_update_removing_the_only_image_without_replacement_returns_400(self):
        # イラスト投稿は画像1〜4枚必須のため、既存の唯一の画像を残さず新規画像も
        # 送らない編集は400になる
        self._login()

        response = self.client.put(
            self._url(), self._payload(keep_image_ids=""), format="multipart"
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("images", response.json())

    def test_update_without_keep_image_ids_returns_400(self):
        # keep_image_idsは必須（省略時に「画像は変更しない」ではなく「全削除」と誤解釈させない
        # ための仕様、PostUpdateSerializer.keep_image_ids参照）。省略した場合はバリデーションエラー
        self._login()
        payload = self._payload()
        del payload["keep_image_ids"]

        response = self.client.put(self._url(), payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("keep_image_ids", response.json())

    def test_update_without_tag_ids_returns_400(self):
        # tag_idsもkeep_image_idsと同様に必須（省略時の「維持」と「全解除」の曖昧さを
        # 避けるため、PostUpdateSerializer.tag_ids参照）
        self._login()
        payload = self._payload()
        del payload["tag_ids"]

        response = self.client.put(self._url(), payload, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("tag_ids", response.json())

    def test_update_replaces_tags(self):
        self._login()
        tags = list(Tag.objects.order_by("display_order")[:2])

        response = self.client.put(
            self._url(),
            self._payload(tag_ids=f"{tags[1].id},{tags[0].id}"),
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_tag_ids = [tag["id"] for tag in response.json()["tags"]]
        self.assertEqual(returned_tag_ids, [tags[0].id, tags[1].id])

    def test_update_keeps_and_adds_images(self):
        image2 = create_post_image(
            self.post, image_url="https://example.com/2.jpg", display_order=1
        )
        self._login()

        response = self.client.put(
            self._url(),
            self._payload(
                body="画像を1枚追加",
                keep_image_ids=f"{self.image.id},{image2.id}",
                images=[make_image("new.jpg")],
            ),
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(len(body["images"]), 3)
        self.assertEqual(body["images"][0], "https://example.com/original.jpg")
        self.assertEqual(body["images"][1], "https://example.com/2.jpg")

    def test_update_removes_images_not_in_keep_image_ids(self):
        create_post_image(self.post, image_url="https://example.com/2.jpg", display_order=1)
        self._login()

        with patch("common.storage.delete_image") as mock_delete:
            response = self.client.put(
                self._url(),
                self._payload(body="1枚だけ残す", keep_image_ids=str(self.image.id)),
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["images"], ["https://example.com/original.jpg"])
        mock_delete.assert_called_once_with("https://example.com/2.jpg")

    def test_update_with_keep_image_ids_from_another_post_returns_400(self):
        other_post = create_post(self.other, body="他人の投稿")
        other_image = create_post_image(other_post, image_url="https://example.com/other.jpg")
        self._login()

        response = self.client.put(
            self._url(),
            self._payload(keep_image_ids=str(other_image.id)),
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
            self._payload(
                body="4枚超過",
                keep_image_ids=keep_ids,
                images=[make_image("a.jpg"), make_image("b.jpg")],
            ),
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_with_invalid_new_image_returns_400(self):
        self._login()

        response = self.client.put(
            self._url(),
            self._payload(
                body="不正な画像",
                keep_image_ids=str(self.image.id),
                images=[make_image("a.txt", "text/plain")],
            ),
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_rolls_back_and_does_not_delete_images_when_upload_fails_midway(self):
        self._login()
        self.client.raise_request_exception = False

        with (
            patch("posts.serializers.upload_image", side_effect=OSError),
            patch("common.storage.delete_image") as mock_delete,
        ):
            response = self.client.put(
                self._url(),
                self._payload(
                    body="失敗させる",
                    keep_image_ids=str(self.image.id),
                    images=[make_image("a.jpg")],
                ),
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        self.post.refresh_from_db()
        self.assertEqual(self.post.body, "編集前の本文")
        self.assertTrue(PostImage.objects.filter(id=self.image.id).exists())
        mock_delete.assert_not_called()

    def test_update_cleans_up_uploaded_image_when_a_later_upload_fails(self):
        # 2枚の新規画像のうち1枚目のアップロードが成功した直後に2枚目が失敗した場合、
        # DBはtransaction.atomicでロールバックされるが、既にS3へ書き込み済みの1枚目は
        # 自動では消えない。PostUpdateSerializer.updateが自分でクリーンアップすることを確認する
        self._login()
        self.client.raise_request_exception = False

        with (
            patch(
                "posts.serializers.upload_image",
                side_effect=["https://example.com/uploaded.jpg", OSError],
            ),
            patch("posts.serializers.delete_image") as mock_delete,
        ):
            response = self.client.put(
                self._url(),
                self._payload(
                    body="アップロード失敗",
                    keep_image_ids=str(self.image.id),
                    images=[make_image("a.jpg"), make_image("b.jpg")],
                ),
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_500_INTERNAL_SERVER_ERROR)
        mock_delete.assert_called_once_with("https://example.com/uploaded.jpg")
        self.assertEqual(
            PostImage.objects.filter(post=self.post).exclude(id=self.image.id).count(), 0
        )

    def test_update_succeeds_even_if_removed_image_delete_fails(self):
        # DBの更新は既に確定しているため、後始末のS3削除が1件失敗しても
        # レスポンス自体は成功として返し、残りの削除も試みることを確認する。
        # イラスト投稿は画像1枚以上必須のため、3枚のうち1枚（self.image）だけ残す形にする
        image2 = create_post_image(
            self.post, image_url="https://example.com/2.jpg", display_order=1
        )
        image3 = create_post_image(
            self.post, image_url="https://example.com/3.jpg", display_order=2
        )
        self._login()

        with patch("common.storage.delete_image", side_effect=[OSError, None]) as mock_delete:
            response = self.client.put(
                self._url(),
                self._payload(
                    body="画像を1枚だけ残して他を消す", keep_image_ids=str(self.image.id)
                ),
                format="multipart",
            )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(mock_delete.call_count, 2)
        self.assertFalse(PostImage.objects.filter(id__in=[image2.id, image3.id]).exists())


class NovelPostUpdateTests(APITestCase):
    """小説投稿（タイトル・本文必須、画像0〜1枚）の編集固有のバリデーションを確認する
    （基本設計書6.3章）。
    """

    def setUp(self):
        self.user = create_user(
            username="novel-owner", email="novel-owner@example.com", display_name="NovelOwner"
        )
        self.post = create_post(
            self.user,
            post_type=Post.PostType.NOVEL,
            title="編集前のタイトル",
            body="編集前の本文",
        )

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "novel-owner@example.com", "password": DEFAULT_PASSWORD}
        )

    def _url(self):
        return f"/api/posts/{self.post.id}"

    def _payload(self, **overrides):
        payload = {
            "title": "更新後のタイトル",
            "body": "更新後の本文",
            "keep_image_ids": "",
            "tag_ids": "",
        }
        payload.update(overrides)
        return payload

    def test_update_title_and_body_returns_200(self):
        self._login()

        response = self.client.put(self._url(), self._payload(), format="multipart")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(body["title"], "更新後のタイトル")
        self.assertEqual(body["body"], "更新後の本文")

    def test_update_without_title_returns_400(self):
        self._login()

        response = self.client.put(self._url(), self._payload(title=""), format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("title", response.json())

    def test_update_adding_second_image_returns_400(self):
        self._login()

        response = self.client.put(
            self._url(),
            self._payload(images=[make_image("a.jpg"), make_image("b.jpg")]),
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("images", response.json())
