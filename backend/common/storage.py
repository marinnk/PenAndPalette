import uuid
from pathlib import PurePosixPath

from django.core.files.storage import default_storage
from rest_framework import serializers

# 基本設計書5章: 画像アップロードはjpg/png・1枚あたり5MBまで
# （投稿画像・コメント画像・アイコン画像で共通のルール）
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
