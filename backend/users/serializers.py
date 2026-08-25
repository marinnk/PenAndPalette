from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers

from common.storage import upload_image, validate_image_file
from users.models import User


class RegisterSerializer(serializers.Serializer):
    """POST /api/auth/register のリクエストボディ検証・利用者作成を担う。"""

    username = serializers.CharField(max_length=50)
    email = serializers.EmailField(max_length=255)
    password = serializers.CharField(write_only=True)

    def validate_username(self, value):
        # usernameはDB側もUNIQUE制約があるが、事前チェック無しだと重複時にIntegrityError→500に
        # なってしまうため、ここでバリデーションエラー（400）として検出する
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("このユーザー名は既に使用されています。")
        return value

    def validate_email(self, value):
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("このメールアドレスは既に登録されています。")
        return value

    def validate_password(self, value):
        try:
            validate_password(value)
        except DjangoValidationError as exc:
            # DjangoのValidationErrorとDRFのValidationErrorは型が異なるため変換する
            raise serializers.ValidationError(exc.messages) from exc
        return value

    def create(self, validated_data):
        # 画面設計（S02）にdisplay_name入力欄が無いため、登録時はusernameをそのまま初期値にする
        return User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
            display_name=validated_data["username"],
        )


class LoginSerializer(serializers.Serializer):
    """POST /api/auth/login のリクエストボディ検証を担う。"""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)


class UserSerializer(serializers.ModelSerializer):
    """認証系レスポンス共通の利用者情報（基本設計書 6.2章 /api/auth/me 相当）。"""

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "avatar_url"]


class UserProfileSerializer(serializers.Serializer):
    """GET /api/users/{id} のレスポンス（基本設計書6.6章）。

    posts.PostSerializerと同じ理由（モデルのフィールドとannotateされた属性が混在するため）で
    ModelSerializerではなくSerializerを使う。follower_count・following_count・followed_by_meは、
    呼び出し元（UserProfileView）がUser.objects.with_follow_stats(viewer)で付与した
    annotate結果をそのまま読み出す。
    """

    id = serializers.IntegerField(read_only=True)
    username = serializers.CharField(read_only=True)
    display_name = serializers.CharField(read_only=True)
    bio = serializers.CharField(read_only=True)
    avatar_url = serializers.CharField(read_only=True)
    follower_count = serializers.IntegerField(read_only=True)
    following_count = serializers.IntegerField(read_only=True)
    followed_by_me = serializers.BooleanField(read_only=True)


class FollowActionSerializer(serializers.Serializer):
    """POST/DELETE /api/users/{id}/follow のレスポンス整形（基本設計書6.6章）。"""

    followed_by_me = serializers.BooleanField(read_only=True)
    follower_count = serializers.IntegerField(read_only=True)


class ProfileUpdateSerializer(serializers.Serializer):
    """PUT /api/users/me のリクエストボディ検証・自己紹介の更新を担う（基本設計書6.6章）。

    bioは0〜160文字（空文字も許可）。省略と空文字を区別する必要が無い（posts.PostUpdateSerializerの
    keep_image_idsと違い、bioは他のフィールドの状態に影響しないため）ため、他のCharField同様に
    required=Trueのみで足りる。
    """

    bio = serializers.CharField(max_length=160, allow_blank=True, trim_whitespace=True)

    def update(self, instance, validated_data):
        instance.bio = validated_data["bio"] or None
        instance.save(update_fields=["bio", "updated_at"])
        return instance


class AvatarUploadSerializer(serializers.Serializer):
    """POST /api/users/me/avatar のリクエストボディ検証・アイコン画像の登録／置き換えを担う
    （基本設計書6.6章）。multipart/form-data、フィールド名`file`。
    """

    file = serializers.FileField()

    def validate_file(self, value):
        validate_image_file(value)
        return value

    @transaction.atomic
    def update(self, instance, validated_data):
        # S3上の旧画像の実削除はここでは行わず、旧URLをinstance._removed_avatar_urlに
        # 記録するだけにとどめる。実削除はビュー側でこのメソッドの成功（＝DBコミット確定）後に
        # 行う（posts.PostUpdateSerializer.updateと同じ理由：先に消すとロールバック時に
        # 「DB上は旧URLに戻ったのにS3の実体は既に消えている」という不整合を生むため）
        old_url = instance.avatar_url
        instance.avatar_url = upload_image(validated_data["file"], folder="avatars")
        instance.save(update_fields=["avatar_url", "updated_at"])
        instance._removed_avatar_url = old_url
        return instance
