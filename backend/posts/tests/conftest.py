from django.core.files.uploadedfile import SimpleUploadedFile

from posts.models import Comment, Post, PostImage, Tag


def make_image(name="image.jpg", content_type="image/jpeg", content=b"jpeg-bytes"):
    """テストで使うアップロード画像ファイルを1件作成するヘルパー。"""
    return SimpleUploadedFile(name, content, content_type=content_type)


def create_post(user, body="テスト投稿", post_type=Post.PostType.ILLUSTRATION, **extra_fields):
    """テストで使う投稿を1件作成するヘルパー（users/tests/conftest.pyのcreate_userと対になる）。

    post_typeのデフォルトはイラスト投稿：単一形式時代からのbodyのみの呼び出し（画像0枚）が
    多数あるが、画像枚数の下限はAPIバリデーションのみで課されるDB制約ではないため、
    ORM直接作成のこれらの呼び出しには影響しない。
    """
    return Post.objects.create(user=user, body=body, post_type=post_type, **extra_fields)


def create_tag(name="テスト用タグ", display_order=100, **extra_fields):
    """テストで使う分類タグを1件作成するヘルパー。

    マイグレーション（0006_seed_tags）で投入済みの固定12件と名前が衝突しないよう、
    デフォルト名・display_orderは既存12件（0〜11）とは別の値にしてある。既存の固定タグを
    使いたいテストはTag.objects.order_by("display_order")等で取得すればよく、
    このヘルパーは主に「タグが存在しない／無効なIDを指定する」系のテスト向け。
    """
    return Tag.objects.create(name=name, display_order=display_order, **extra_fields)


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
