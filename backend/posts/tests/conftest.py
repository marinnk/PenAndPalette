from posts.models import Post


def create_post(user, body="テスト投稿", **extra_fields):
    """テストで使う投稿を1件作成するヘルパー（users/tests/conftest.pyのcreate_userと対になる）。"""
    return Post.objects.create(user=user, body=body, **extra_fields)
