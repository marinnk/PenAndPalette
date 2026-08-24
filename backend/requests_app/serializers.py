from rest_framework import serializers

from posts.models import Post
from posts.serializers import PostSummarySerializer
from requests_app.models import Request
from users.serializers import UserSerializer


class RequestCreateSerializer(serializers.Serializer):
    """POST /api/users/{user_id}/requests のリクエストボディ検証・作成を担う（基本設計書6.7章）。

    宛先（to_user）は自分自身へは送れない（400）が、そのチェックは呼び出し元のビューで
    行う（users.views.FollowViewの自己フォローチェックと同じ理由・順序）。
    """

    # allow_blank未指定＝デフォルトFalseのため、空文字は自動的にバリデーションエラー（400）に
    # なる（基本設計書6.7章「messageは1〜280文字必須」）
    message = serializers.CharField(max_length=280, trim_whitespace=True)
    related_post_id = serializers.IntegerField(required=False, allow_null=True)

    def validate_related_post_id(self, value):
        if value is not None and not Post.objects.filter(pk=value).exists():
            raise serializers.ValidationError("指定された投稿が見つかりません。")
        return value

    def create(self, validated_data):
        return Request.objects.create(
            from_user=self.context["request"].user,
            to_user=self.context["to_user"],
            related_post_id=validated_data.get("related_post_id"),
            message=validated_data["message"],
        )


class RequestSerializer(serializers.Serializer):
    """POST /api/users/{id}/requests・GET /api/requests/received 共通のレスポンス
    （基本設計書6.7章）。
    """

    id = serializers.IntegerField(read_only=True)
    from_user = UserSerializer(read_only=True)
    related_post = PostSummarySerializer(read_only=True, allow_null=True)
    message = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
