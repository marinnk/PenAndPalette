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
