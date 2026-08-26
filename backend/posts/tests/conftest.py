from django.core.files.uploadedfile import SimpleUploadedFile

from posts.models import Comment, Post, PostImage


def make_image(name="image.jpg", content_type="image/jpeg", content=b"jpeg-bytes"):
    """テストで使うアップロード画像ファイルを1件作成するヘルパー。"""
    return SimpleUploadedFile(name, content, content_type=content_type)


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


def create_comment(post, user, content="テストコメント", **extra_fields):
    """テストで使うコメントを1件作成するヘルパー。"""
    return Comment.objects.create(post=post, user=user, content=content, **extra_fields)
