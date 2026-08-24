from rest_framework import serializers

from common.storage import upload_image, validate_image_file
from posts.models import Post, PostImage
from users.serializers import UserSerializer


class PostSerializer(serializers.Serializer):
    """投稿一覧・詳細・作成直後のレスポンス共通のシリアライザ（基本設計書6.3章）。

    like_count・want_count・liked_by_me・wanted_by_meはPost.objects.with_reactions()の
    annotate()で付与された属性をそのまま読み出す。id等のフィールドと違い、この投稿が
    ModelSerializerではなくSerializerな理由は、annotateされた属性・SerializerMethodField
    （body・images・comment_count）が混在しモデルのフィールドだけでは完結しないため。
    """

    id = serializers.IntegerField(read_only=True)
    author = UserSerializer(source="user", read_only=True)
    body = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True)
    want_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.SerializerMethodField()
    liked_by_me = serializers.BooleanField(read_only=True)
    wanted_by_me = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_body(self, obj):
        # 画像のみの投稿はDB上body=NULLになりうるが、フロントエンドのPost.body型（string）を
        # 変えずに済ませるため、レスポンスでは空文字に統一する
        return obj.body or ""

    def get_images(self, obj):
        # 作成直後はPostCreateSerializer.create()で構築済みのリストを使い、DBへの再クエリを
        # 避ける（like_count等の初期値設定と同じ最適化方針）。一覧・詳細はwith_reactions()の
        # prefetch_related("images")でキャッシュ済みのobj.images.all()を使うため、
        # こちらも追加クエリは発生しない
        images = getattr(obj, "_created_images", None)
        if images is None:
            images = obj.images.all()
        return [image.image_url for image in images]

    def get_comment_count(self, obj):
        # TODO(F-4 コメント機能): Commentモデル実装後、annotate()によるCount集計に置き換える
        return 0


class LikeReactionSerializer(serializers.Serializer):
    """POST/DELETE /api/posts/{id}/likes のレスポンス整形（基本設計書6.5章）。"""

    like_count = serializers.IntegerField(read_only=True)
    liked_by_me = serializers.BooleanField(read_only=True)


class WantReactionSerializer(serializers.Serializer):
    """POST/DELETE /api/posts/{id}/wants のレスポンス整形（基本設計書6.5章）。"""

    want_count = serializers.IntegerField(read_only=True)
    wanted_by_me = serializers.BooleanField(read_only=True)


class PostCreateSerializer(serializers.Serializer):
    """POST /api/posts のリクエストボディ検証・投稿作成を担う（基本設計書6.3章）。
    multipart/form-data。body（0〜280文字）・images（0〜4枚）の少なくとも一方が必須。
    """

    MAX_IMAGES = 4

    body = serializers.CharField(
        max_length=280, trim_whitespace=True, required=False, allow_blank=True, default=""
    )
    images = serializers.ListField(child=serializers.FileField(), required=False, default=list)

    def validate_images(self, value):
        if len(value) > self.MAX_IMAGES:
            raise serializers.ValidationError(f"画像は{self.MAX_IMAGES}枚まで添付できます。")
        for image in value:
            validate_image_file(image)
        return value

    def validate(self, attrs):
        if not attrs["body"] and not attrs["images"]:
            raise serializers.ValidationError("本文または画像のいずれかを入力してください。")
        return attrs

    def create(self, validated_data):
        post = Post.objects.create(
            user=self.context["request"].user, body=validated_data["body"] or None
        )
        # 作成直後のシリアライズ（PostSerializer.get_images）で再クエリしなくて済むよう、
        # 作成したPostImageのリストをその場でPostインスタンスに持たせておく
        post._created_images = [
            PostImage.objects.create(
                post=post, image_url=upload_image(image, folder="posts"), display_order=order
            )
            for order, image in enumerate(validated_data["images"])
        ]
        return post


class PostListQuerySerializer(serializers.Serializer):
    """GET /api/posts のクエリパラメータ検証を担う（基本設計書6.3・6.9章）。"""

    limit = serializers.IntegerField(required=False, min_value=1, max_value=50, default=20)
    before_id = serializers.IntegerField(required=False, min_value=1)
    # after_idはmin_value=0（他はmin_value=1）：フロントエンドはタイムラインが空の状態を
    # after_id=0（＝「これより新しい投稿」の下限なし）として表現し、特別分岐なしで
    # ポーリングできるようにしている（frontend/src/composables/useTimeline.ts参照）。
    # min_value=1のままだと、投稿が1件も無い利用者のポーリングが常に400になり、
    # 新着通知バナーが永久に表示されなくなる
    after_id = serializers.IntegerField(required=False, min_value=0)
    user_id = serializers.IntegerField(required=False, min_value=1)
    scope = serializers.ChoiceField(choices=["all", "following"], required=False)

    def validate(self, attrs):
        if attrs.get("before_id") is not None and attrs.get("after_id") is not None:
            raise serializers.ValidationError("before_idとafter_idは同時に指定できません。")
        if attrs.get("user_id") is not None and attrs.get("scope") == "following":
            raise serializers.ValidationError("user_idとscope=followingは同時に指定できません。")
        return attrs
