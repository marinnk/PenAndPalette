import pytest


@pytest.fixture(autouse=True)
def use_local_media_storage(settings, tmp_path):
    """画像アップロードを伴うテストが実際のMinIOへの接続に依存しないよう、
    STORAGESを一時ディレクトリへのFileSystemStorageに差し替える。
    プロジェクト全体のテストに適用するため、アプリ別のconftest.pyではなくルートに置く。
    """
    settings.STORAGES = {
        **settings.STORAGES,
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    }
    settings.MEDIA_ROOT = str(tmp_path)
    settings.MEDIA_URL = "/media/"
