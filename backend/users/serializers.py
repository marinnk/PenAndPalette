from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

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


class UserProfileSerializer(serializers.ModelSerializer):
    """GET /api/users/{id} のレスポンス（基本設計書6.6章のプロフィール取得の暫定narrowing）。

    follower_count・following_count・followed_by_meはF-7（フォロー機能）実装時に追加する。
    """

    class Meta:
        model = User
        fields = ["id", "username", "display_name", "bio", "avatar_url"]
