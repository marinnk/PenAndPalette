import pytest
from django.core.files.storage import default_storage
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.exceptions import ValidationError

from common.storage import delete_image, upload_image, validate_image_file


def make_file(name="a.jpg", content_type="image/jpeg", content=b"bytes"):
    return SimpleUploadedFile(name, content, content_type=content_type)


def test_validate_image_file_accepts_jpeg():
    validate_image_file(make_file(content_type="image/jpeg"))  # 例外が出なければOK


def test_validate_image_file_accepts_png():
    validate_image_file(make_file(content_type="image/png"))  # 例外が出なければOK


def test_validate_image_file_rejects_disallowed_content_type():
    with pytest.raises(ValidationError):
        validate_image_file(make_file(content_type="text/plain"))


def test_validate_image_file_rejects_oversized_file():
    oversized = make_file(content=b"x" * (5 * 1024 * 1024 + 1))
    with pytest.raises(ValidationError):
        validate_image_file(oversized)


def test_validate_image_file_accepts_file_at_exactly_the_size_limit():
    exactly_at_limit = make_file(content=b"x" * (5 * 1024 * 1024))
    validate_image_file(exactly_at_limit)  # 例外が出なければOK


def test_upload_image_returns_a_url():
    url = upload_image(make_file(), folder="posts")

    assert url


def test_upload_image_uses_folder_and_extension_not_original_filename():
    url = upload_image(make_file(name="original-name.jpg"), folder="posts")

    assert "/posts/" in url
    assert url.endswith(".jpg")
    assert "original-name" not in url


def test_upload_image_called_twice_with_same_file_returns_different_urls():
    # 元のファイル名を使わずUUIDで採番するため、同名ファイルを2回アップロードしても
    # 衝突せず別々のURLになることを確認する
    url1 = upload_image(make_file(), folder="posts")
    url2 = upload_image(make_file(), folder="posts")

    assert url1 != url2


def _key_from_url(url):
    # upload_imageが返すURLからキー（"posts/xxx.jpg"部分）を取り出す、delete_imageとは
    # 独立したテスト側のURL→キー変換（実装をそのまま再利用すると検証にならないため）
    return "posts/" + url.split("/posts/", 1)[1]


def test_delete_image_removes_uploaded_file():
    url = upload_image(make_file(), folder="posts")
    key = _key_from_url(url)
    assert default_storage.exists(key)

    delete_image(url)

    assert not default_storage.exists(key)


def test_delete_image_does_not_raise_for_already_deleted_file():
    url = upload_image(make_file(), folder="posts")

    delete_image(url)
    delete_image(url)  # 2回目もエラーにならないこと
