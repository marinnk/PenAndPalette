import uuid
from pathlib import PurePosixPath
from urllib.parse import urlparse

from django.core.files.storage import default_storage
from rest_framework import serializers

# 基本設計書5章: 画像アップロードはjpg/png・1枚あたり5MBまで
# （投稿画像・コメント画像・アイコン画像で共通のルール）。添付できる枚数の上限は機能ごとに異なる
# （投稿は0〜4枚、コメント・アバターは1枚まで）ため、ここには含めずposts/serializers.py側に置く
#
# frontend/src/composables/usePostCreate.ts が MAX_IMAGE_SIZE_BYTES・ALLOWED_IMAGE_TYPESという
# 名前でこの2つの値を複製している。値を変更する場合は両方合わせて変更すること
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg": ".jpg", "image/png": ".png"}


def validate_image_file(file):
    """画像ファイルの形式・サイズを検証する。違反時はDRFのValidationErrorを送出し、
    呼び出し元のシリアライザでそのまま400エラーとしてまとまるようにする。
    """
    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise serializers.ValidationError("画像はjpgまたはpng形式のみ添付できます。")
    if file.size > MAX_IMAGE_SIZE_BYTES:
        raise serializers.ValidationError("画像は1枚あたり5MBまでです。")


def upload_image(file, *, folder):
    """検証済みの画像ファイルをS3（開発時はMinIO）へ保存し、公開URLを返す。
    元のファイル名は保存せずUUIDで採番し、ファイル名の衝突や利用者情報の漏えいを避ける。
    """
    extension = ALLOWED_CONTENT_TYPES[file.content_type]
    key = str(PurePosixPath(folder) / f"{uuid.uuid4()}{extension}")
    saved_path = default_storage.save(key, file)
    return default_storage.url(saved_path)


def delete_image(image_url):
    """upload_imageで発行した画像をストレージから削除する（投稿の編集・削除で使用）。

    image_urlはPostImage.image_urlに保存された公開URLであり格納キーそのものではないため、
    ここでキーへ逆算する。upload_imageは常に`{folder}/{uuid}{extension}`という1階層のキーで
    保存するため、URLの末尾2セグメント（フォルダ名・ファイル名）を取り出せばよい。この方法は
    バックエンドが本番のS3（`{scheme}://{host}/{bucket}/{key}`）でもテスト用の
    FileSystemStorage（`{MEDIA_URL}/{key}`、conftest.py参照）でも同じロジックで動く。
    対象が既に存在しない場合もS3のDeleteObjectは冪等（エラーにならない）ため、
    存在確認はせずdefault_storage.delete()にそのまま委ねる。
    """
    segments = urlparse(image_url).path.strip("/").split("/")
    key = "/".join(segments[-2:])
    default_storage.delete(key)
