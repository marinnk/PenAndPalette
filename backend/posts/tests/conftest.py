import pytest

from posts.models import Post, PostImage


def create_post(user, body="テスト投稿", **extra_fields):
    """テストで使う投稿を1件作成するヘルパー（users/tests/conftest.pyのcreate_userと対になる）。"""
    return Post.objects.create(user=user, body=body, **extra_fields)


def create_post_image(
    post, image_url="https://example.com/example.jpg", display_order=0, **extra_fields
):
    """テストで使う投稿画像を1件作成するヘルパー。"""
    return PostImage.objects.create(
        post=post, image_url=image_url, display_order=display_order, **extra_fields
    )


@pytest.fixture(autouse=True)
def use_local_media_storage(settings, tmp_path):
    """画像アップロードを伴うテストが実際のMinIOへの接続に依存しないよう、
    STORAGESを一時ディレクトリへのFileSystemStorageに差し替える。
    """
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    }
    settings.MEDIA_ROOT = str(tmp_path)
    settings.MEDIA_URL = "/media/"
