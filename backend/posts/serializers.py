from django.db import models, transaction
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
    image_ids = serializers.SerializerMethodField()
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

    def get_image_ids(self, obj):
        # imagesと同じ並び順（どちらもdisplay_order順）のid配列。投稿編集画面で
        # 「残す既存画像」を指定するkeep_image_idsに使う（基本設計書6.3章）
        images = getattr(obj, "_created_images", None)
        if images is None:
            images = obj.images.all()
        return [image.id for image in images]

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

    # frontend/src/composables/usePostCreate.ts のMAX_IMAGESがこの値を複製している。
    # 値を変更する場合は両方合わせて変更すること
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

    @transaction.atomic
    def create(self, validated_data):
        # transaction.atomic: 画像のアップロード中（S3/MinIOへの書き込み）に失敗した場合、
        # ここまでに作成したPost・PostImageのDB行を1件も残さずロールバックする。
        # ただし既にS3/MinIOへ書き込み済みのファイル自体はDBの取り消しでは削除されない
        # （アップロード先はDBトランザクションの対象外のため）。取りこぼした投稿が
        # 一覧に見えてしまう不整合は防げるが、孤立したファイルの後始末は今回のスコープ外とする
        post = Post.objects.create(
            user=self.context["request"].user, body=validated_data["body"] or None
        )
        images = [
            PostImage(
                post=post, image_url=upload_image(image, folder="posts"), display_order=order
            )
            for order, image in enumerate(validated_data["images"])
        ]
        # 画像1枚ごとにINSERTするのではなく、まとめて1回のクエリで保存する
        PostImage.objects.bulk_create(images)
        # 作成直後のシリアライズ（PostSerializer.get_images）で再クエリしなくて済むよう、
        # 作成したPostImageのリストをその場でPostインスタンスに持たせておく
        post._created_images = images
        return post


class PostUpdateSerializer(serializers.Serializer):
    """PUT /api/posts/{post_id} のリクエストボディ検証・投稿編集を担う（基本設計書6.3章）。
    multipart/form-data。既存画像はファイルとして再送信させず、keep_image_ids（残す既存画像の
    idをカンマ区切りで指定）で指定する。新規追加分のみimagesでファイルを送る。
    """

    body = serializers.CharField(
        max_length=280, trim_whitespace=True, required=False, allow_blank=True, default=""
    )
    keep_image_ids = serializers.CharField(required=False, allow_blank=True, default="")
    images = serializers.ListField(child=serializers.FileField(), required=False, default=list)

    def validate_keep_image_ids(self, value):
        if not value:
            return []
        try:
            ids = [int(token) for token in value.split(",") if token.strip()]
        except ValueError:
            raise serializers.ValidationError(
                "keep_image_idsは数値をカンマ区切りで指定してください。"
            ) from None
        valid_ids = set(self.instance.images.values_list("id", flat=True))
        if set(ids) - valid_ids:
            raise serializers.ValidationError("指定された画像がこの投稿に存在しません。")
        return ids

    def validate_images(self, value):
        if len(value) > PostCreateSerializer.MAX_IMAGES:
            raise serializers.ValidationError(
                f"画像は{PostCreateSerializer.MAX_IMAGES}枚まで添付できます。"
            )
        for image in value:
            validate_image_file(image)
        return value

    def validate(self, attrs):
        total_images = len(attrs.get("keep_image_ids", [])) + len(attrs.get("images", []))
        if total_images > PostCreateSerializer.MAX_IMAGES:
            raise serializers.ValidationError(
                f"画像は{PostCreateSerializer.MAX_IMAGES}枚まで添付できます。"
            )
        if not attrs["body"] and total_images == 0:
            raise serializers.ValidationError("本文または画像のいずれかを入力してください。")
        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):
        # S3上の実ファイル削除はここでは行わず、削除対象のURLをinstance._removed_image_urlsに
        # 記録するだけにとどめる。実削除はビュー側でこのメソッドの成功（＝DBコミット確定）後に
        # 行う（posts/views.pyのPostDetailView.put参照）。ここで先にS3を消してしまうと、
        # このtransaction.atomicブロック自体が後続のupload_image失敗でロールバックした際に、
        # 「DB上は画像が復活したのにS3の実体は既に消えている」という不整合を生んでしまうため
        keep_ids = validated_data["keep_image_ids"]
        removed_urls = list(
            instance.images.exclude(id__in=keep_ids).values_list("image_url", flat=True)
        )

        instance.body = validated_data["body"] or None
        instance.save(update_fields=["body", "updated_at"])
        instance.images.exclude(id__in=keep_ids).delete()

        next_order = instance.images.aggregate(models.Max("display_order"))["display_order__max"]
        next_order = 0 if next_order is None else next_order + 1
        new_images = [
            PostImage(
                post=instance,
                image_url=upload_image(image, folder="posts"),
                display_order=next_order + order,
            )
            for order, image in enumerate(validated_data["images"])
        ]
        PostImage.objects.bulk_create(new_images)

        instance._removed_image_urls = removed_urls
        return instance


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
