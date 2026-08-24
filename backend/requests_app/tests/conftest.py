from requests_app.models import Request


def create_request(from_user, to_user, message="テストリクエスト", **extra_fields):
    """テストで使うリクエストを1件作成するヘルパー
    （users/tests/conftest.pyのcreate_user・posts/tests/conftest.pyのcreate_postと対になる）。
    """
    return Request.objects.create(
        from_user=from_user, to_user=to_user, message=message, **extra_fields
    )
