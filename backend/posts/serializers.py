from rest_framework import serializers

from posts.models import Post
from users.serializers import UserSerializer


class PostSerializer(serializers.Serializer):
    """投稿一覧・詳細・作成直後のレスポンス共通のシリアライザ（基本設計書6.3章）。

    like_count・want_count・liked_by_me・wanted_by_meはPost.objects.with_reactions()の
    annotate()で付与された属性をそのまま読み出す。id等のフィールドと違い、この投稿が
    ModelSerializerではなくSerializerな理由は、annotateされた属性・SerializerMethodField
    （images・comment_count）が混在しモデルのフィールドだけでは完結しないため。
    """

    id = serializers.IntegerField(read_only=True)
    author = UserSerializer(source="user", read_only=True)
    body = serializers.CharField(read_only=True)
    images = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True)
    want_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.SerializerMethodField()
    liked_by_me = serializers.BooleanField(read_only=True)
    wanted_by_me = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_images(self, obj):
        # TODO(画像対応Issue): PostImageモデル実装後、実際の画像URL一覧を返すようにする
        return []

    def get_comment_count(self, obj):
        # TODO(F-4 コメント機能): Commentモデル実装後、annotate()によるCount集計に置き換える
        return 0


class PostCreateSerializer(serializers.Serializer):
    """POST /api/posts のリクエストボディ検証・投稿作成を担う。

    基本設計書6.3章の本来の仕様（multipart/form-data、body・imagesの少なくとも一方必須）とは異なり、
    今回は画像添付未対応のためbodyのみ・必須とする暫定narrowing（画像対応Issueで拡張する）。
    """

    body = serializers.CharField(max_length=280, min_length=1, trim_whitespace=True)

    def create(self, validated_data):
        return Post.objects.create(user=self.context["request"].user, body=validated_data["body"])


class PostListQuerySerializer(serializers.Serializer):
    """GET /api/posts のクエリパラメータ検証を担う（基本設計書6.3・6.9章）。"""

    limit = serializers.IntegerField(required=False, min_value=1, max_value=50, default=20)
    before_id = serializers.IntegerField(required=False, min_value=1)
    after_id = serializers.IntegerField(required=False, min_value=1)
    user_id = serializers.IntegerField(required=False, min_value=1)
    scope = serializers.ChoiceField(choices=["all", "following"], required=False)

    def validate(self, attrs):
        if attrs.get("before_id") is not None and attrs.get("after_id") is not None:
            raise serializers.ValidationError("before_idとafter_idは同時に指定できません。")
        if attrs.get("user_id") is not None and attrs.get("scope") == "following":
            raise serializers.ValidationError("user_idとscope=followingは同時に指定できません。")
        return attrs
