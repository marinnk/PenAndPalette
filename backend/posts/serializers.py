from django.db import models, transaction
from rest_framework import serializers

from common.storage import delete_image, upload_image, validate_image_file
from posts.models import Comment, Post, PostImage, Tag
from users.serializers import UserSerializer

# 投稿の種別ごとの上限値（基本設計書4.2・6.3章）。PostCreateSerializer・PostUpdateSerializerの
# 両方がこの1箇所を参照する。frontend/src/composables/postImageValidation.ts のMAX_IMAGESが
# MAX_POST_IMAGESの値を複製している。値を変更する場合は両方合わせて変更すること
MAX_POST_IMAGES = 4  # イラスト投稿の画像上限（従来からの名前をそのまま維持）
MAX_ILLUSTRATION_IMAGES = MAX_POST_IMAGES
MAX_NOVEL_IMAGES = 1  # 小説投稿のカバー画像上限
MAX_ILLUSTRATION_BODY_LENGTH = 280
MAX_NOVEL_BODY_LENGTH = 4000
MAX_TITLE_LENGTH = 100
MAX_POST_TAGS = 5


def _or_empty(value: str | None) -> str:
    """画像のみの投稿・コメントはDB上body/content=NULLになりうるが、フロントエンドの
    string型を変えずに済ませるため、レスポンスでは空文字に統一する（PostSerializer・
    PostSummarySerializer・CommentSerializerで共通）。
    """
    return value or ""


class TagSerializer(serializers.Serializer):
    """GET /api/tags のレスポンス整形（基本設計書6.11章）。固定の分類タグ一覧で、
    利用者による作成・編集はできないため書き込み用フィールドは持たない。
    """

    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)


class PostSerializer(serializers.Serializer):
    """投稿一覧・詳細・作成直後のレスポンス共通のシリアライザ（基本設計書6.3章）。

    like_count・want_count・comment_count・liked_by_me・wanted_by_meはPost.objects.
    with_reactions()のannotate()で付与された属性をそのまま読み出す。id等のフィールドと違い、
    この投稿がModelSerializerではなくSerializerな理由は、annotateされた属性・
    SerializerMethodField（body・images）が混在しモデルのフィールドだけでは完結しないため。
    """

    id = serializers.IntegerField(read_only=True)
    author = UserSerializer(source="user", read_only=True)
    post_type = serializers.CharField(read_only=True)
    title = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    image_ids = serializers.SerializerMethodField()
    tags = serializers.SerializerMethodField()
    like_count = serializers.IntegerField(read_only=True)
    want_count = serializers.IntegerField(read_only=True)
    comment_count = serializers.IntegerField(read_only=True)
    liked_by_me = serializers.BooleanField(read_only=True)
    wanted_by_me = serializers.BooleanField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_title(self, obj):
        return _or_empty(obj.title)

    def get_body(self, obj):
        return _or_empty(obj.body)

    def _resolve_images(self, obj):
        # 作成直後はPostCreateSerializer.create()で構築済みのリストを使い、DBへの再クエリを
        # 避ける（like_count等の初期値設定と同じ最適化方針）。一覧・詳細はwith_reactions()の
        # prefetch_related("images")でキャッシュ済みのobj.images.all()を使うため、
        # こちらも追加クエリは発生しない。get_images・get_image_idsの両方から呼ばれる
        images = getattr(obj, "_created_images", None)
        if images is None:
            images = obj.images.all()
        return images

    def get_images(self, obj):
        return [image.image_url for image in self._resolve_images(obj)]

    def get_image_ids(self, obj):
        # imagesと同じ並び順（どちらもdisplay_order順）のid配列。投稿編集画面で
        # 「残す既存画像」を指定するkeep_image_idsに使う（基本設計書6.3章）
        return [image.id for image in self._resolve_images(obj)]

    def _resolve_tags(self, obj):
        # _resolve_imagesと同じ理由。作成直後はPostCreateSerializer.create()でセットした
        # _created_tagsを使い、一覧・詳細はwith_reactions()のprefetch_related（display_order
        # 順にPrefetch済み）でキャッシュ済みのobj.tags.all()を使う
        tags = getattr(obj, "_created_tags", None)
        if tags is None:
            tags = obj.tags.all()
        return tags

    def get_tags(self, obj):
        return [{"id": tag.id, "name": tag.name} for tag in self._resolve_tags(obj)]


class PostSummarySerializer(serializers.Serializer):
    """投稿の軽量な要約表示（基本設計書6.7章 F-6 リクエストのrelated_post埋め込み等で使う）。

    PostSerializerと違いlike_count等のwith_reactions()によるannotateを前提にしないため、
    Post.objects単体（select_related("user") + prefetch_related("images")のみ）から
    シリアライズできる。
    """

    id = serializers.IntegerField(read_only=True)
    author = UserSerializer(source="user", read_only=True)
    body = serializers.SerializerMethodField()
    image = serializers.SerializerMethodField()
    created_at = serializers.DateTimeField(read_only=True)

    def get_body(self, obj):
        return _or_empty(obj.body)

    def get_image(self, obj):
        # 先頭1枚のURLのみ返す（一覧のサムネイル用途）。呼び出し側でprefetch_related("images")
        # を付けている前提のため、ここでの.all()[:1]は追加クエリを発生させない
        first = list(obj.images.all())[:1]
        return first[0].image_url if first else None


class LikeReactionSerializer(serializers.Serializer):
    """POST/DELETE /api/posts/{id}/likes のレスポンス整形（基本設計書6.5章）。"""

    like_count = serializers.IntegerField(read_only=True)
    liked_by_me = serializers.BooleanField(read_only=True)


class WantReactionSerializer(serializers.Serializer):
    """POST/DELETE /api/posts/{id}/wants のレスポンス整形（基本設計書6.5章）。"""

    want_count = serializers.IntegerField(read_only=True)
    wanted_by_me = serializers.BooleanField(read_only=True)


class PostTypeValidationMixin:
    """PostCreateSerializer・PostUpdateSerializerに共通の、投稿種別ごとの入力ルール検証
    （基本設計書4.2・6.3章）。

    - イラスト投稿：タイトルは送らない（送ると400）。本文は任意（0〜280文字）。
      画像は1〜4枚必須
    - 小説投稿：タイトルは必須（1〜100文字）。本文は必須（1〜4000文字）。
      画像は0〜1枚（カバー画像）

    「イラスト投稿にタイトルを送る」のような想定外の組み合わせは、既存のuser_id+
    scope=following同時指定や自己フォローと同様、黙って無視・正規化せず400にして
    気づけるようにする。
    """

    def validate_title_and_body_for_type(self, attrs):
        post_type = attrs["post_type"]
        title = attrs["title"]
        body = attrs["body"]
        if post_type == Post.PostType.NOVEL:
            if not title:
                raise serializers.ValidationError({"title": ["小説投稿ではタイトルは必須です。"]})
            if not body:
                raise serializers.ValidationError({"body": ["小説投稿では本文は必須です。"]})
        else:
            if title:
                raise serializers.ValidationError(
                    {"title": ["イラスト投稿ではタイトルを指定できません。"]}
                )
            if len(body) > MAX_ILLUSTRATION_BODY_LENGTH:
                raise serializers.ValidationError(
                    {"body": [f"イラスト投稿の本文は{MAX_ILLUSTRATION_BODY_LENGTH}文字までです。"]}
                )

    def validate_image_count_for_type(self, post_type, image_count):
        if post_type == Post.PostType.NOVEL:
            if image_count > MAX_NOVEL_IMAGES:
                raise serializers.ValidationError(
                    {"images": [f"小説投稿の画像は{MAX_NOVEL_IMAGES}枚までです。"]}
                )
        else:
            if not (1 <= image_count <= MAX_ILLUSTRATION_IMAGES):
                raise serializers.ValidationError(
                    {
                        "images": [
                            f"イラスト投稿では画像を1〜{MAX_ILLUSTRATION_IMAGES}枚添付してください。"
                        ]
                    }
                )

    def check_tag_ids(self, ids):
        """tag_idsの共通チェック（件数・重複・実在）。PostCreateSerializer.validate_tag_ids
        （ListField）・PostUpdateSerializer.validate_tag_ids（CSV文字列をパース後）の
        どちらからも呼ばれる。

        ここで実在確認のために取得したTagの実体（Tag.Meta.ordering=display_order順）を
        self._validated_tagsに保持しておき、create()・PostSerializer.get_tags向けの
        _created_tagsスタンプで再クエリしなくて済むようにする。
        """
        if len(ids) > MAX_POST_TAGS:
            raise serializers.ValidationError(f"タグは{MAX_POST_TAGS}個まで選択できます。")
        if len(set(ids)) != len(ids):
            raise serializers.ValidationError("同じタグを複数指定することはできません。")
        tags = list(Tag.objects.filter(id__in=ids))
        if len(tags) != len(ids):
            raise serializers.ValidationError("指定されたタグが見つかりません。")
        self._validated_tags = tags
        return ids


class PostCreateSerializer(PostTypeValidationMixin, serializers.Serializer):
    """POST /api/posts のリクエストボディ検証・投稿作成を担う（基本設計書6.3章）。
    multipart/form-data。post_type（'illustration'または'novel'）必須で、
    title・body・imagesの入力ルールは種別ごとに異なる（PostTypeValidationMixin参照）。
    """

    post_type = serializers.ChoiceField(
        choices=Post.PostType.choices,
        error_messages={
            "required": "post_typeは必須です。",
            "invalid_choice": "post_typeはillustrationまたはnovelを指定してください。",
        },
    )
    title = serializers.CharField(
        max_length=MAX_TITLE_LENGTH,
        trim_whitespace=True,
        required=False,
        allow_blank=True,
        default="",
    )
    body = serializers.CharField(
        max_length=MAX_NOVEL_BODY_LENGTH,
        trim_whitespace=True,
        required=False,
        allow_blank=True,
        default="",
    )
    images = serializers.ListField(child=serializers.FileField(), required=False, default=list)
    tag_ids = serializers.ListField(child=serializers.IntegerField(), required=False, default=list)

    def validate_images(self, value):
        # 枚数の上限は投稿種別により異なるため、ここでは形式・サイズのみ検証する
        # （枚数チェックはvalidate()でpost_typeと合わせて行う）
        for image in value:
            validate_image_file(image)
        return value

    def validate_tag_ids(self, value):
        return self.check_tag_ids(value)

    def validate(self, attrs):
        self.validate_title_and_body_for_type(attrs)
        self.validate_image_count_for_type(attrs["post_type"], len(attrs["images"]))
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        # transaction.atomic: 画像のアップロード中（S3/MinIOへの書き込み）に失敗した場合、
        # ここまでに作成したPost・PostImageのDB行を1件も残さずロールバックする。
        # ただし既にS3/MinIOへ書き込み済みのファイル自体はDBの取り消しでは削除されない
        # （アップロード先はDBトランザクションの対象外のため）。取りこぼした投稿が
        # 一覧に見えてしまう不整合は防げるが、孤立したファイルの後始末は今回のスコープ外とする
        post = Post.objects.create(
            user=self.context["request"].user,
            post_type=validated_data["post_type"],
            title=validated_data["title"] or None,
            body=validated_data["body"] or None,
        )
        images = [
            PostImage(
                post=post, image_url=upload_image(image, folder="posts"), display_order=order
            )
            for order, image in enumerate(validated_data["images"])
        ]
        # 画像1枚ごとにINSERTするのではなく、まとめて1回のクエリで保存する
        PostImage.objects.bulk_create(images)
        post.tags.set(validated_data["tag_ids"])
        # 作成直後のシリアライズ（PostSerializer.get_images・get_tags）で再クエリしなくて
        # 済むよう、作成したPostImage・タグのリストをその場でPostインスタンスに持たせておく。
        # _validated_tagsはcheck_tag_ids()で実在確認のために取得済みのTag実体の使い回し
        post._created_images = images
        post._created_tags = self._validated_tags
        return post


class PostUpdateSerializer(PostTypeValidationMixin, serializers.Serializer):
    """PUT /api/posts/{post_id} のリクエストボディ検証・投稿編集を担う（基本設計書6.3章）。
    multipart/form-data。既存画像はファイルとして再送信させず、keep_image_ids（残す既存画像の
    idをカンマ区切りで指定）で指定する。新規追加分のみimagesでファイルを送る。

    post_typeは作成時に固定され編集では変更できないため、フィールドとして持たない
    （PUTボディに含まれていても無視される）。title・body・imagesの入力ルールは
    self.instance.post_typeに基づき種別ごとに検証する（PostTypeValidationMixin参照）。
    """

    title = serializers.CharField(
        max_length=MAX_TITLE_LENGTH,
        trim_whitespace=True,
        required=False,
        allow_blank=True,
        default="",
    )
    body = serializers.CharField(
        max_length=MAX_NOVEL_BODY_LENGTH,
        trim_whitespace=True,
        required=False,
        allow_blank=True,
        default="",
    )
    # required=True: 省略・空文字を区別できないと「省略＝画像は変更しない」つもりの呼び出しが
    # 「keep_ids=[] → 既存画像を全削除」になってしまう危険な仕様になる（本文だけ直すつもりが
    # 画像を全部失う等）。必須にすることで、画像を全部消したい場合も明示的に空文字を送らせ、
    # 「省略」と「意図的に0件」を区別できるようにする
    keep_image_ids = serializers.CharField(allow_blank=True)
    images = serializers.ListField(child=serializers.FileField(), required=False, default=list)
    # tag_idsもkeep_image_idsと同じ理由でrequired=True・カンマ区切り文字列にする：
    # 省略時に「既存のタグ付けを維持する」のか「タグを全解除する」のか曖昧にしないため、
    # 編集のたびに希望するタグの集合全体を明示的に送らせる。ListFieldのままrequired=Trueに
    # すると、multipart/form-dataでは「空リストを明示的に送る」という表現ができず
    # （フィールド自体が送信されないのと区別が付かない）、keep_image_idsと同じCSV文字列
    # 方式にする必要がある
    tag_ids = serializers.CharField(allow_blank=True)

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

    def validate_tag_ids(self, value):
        if not value:
            return []
        try:
            ids = [int(token) for token in value.split(",") if token.strip()]
        except ValueError:
            raise serializers.ValidationError(
                "tag_idsは数値をカンマ区切りで指定してください。"
            ) from None
        return self.check_tag_ids(ids)

    def validate_images(self, value):
        # 枚数の上限は投稿種別により異なるため、ここでは形式・サイズのみ検証する
        # （枚数チェックはvalidate()でpost_typeと合わせて行う）
        for image in value:
            validate_image_file(image)
        return value

    def validate(self, attrs):
        post_type = self.instance.post_type
        self.validate_title_and_body_for_type({**attrs, "post_type": post_type})
        total_images = len(attrs.get("keep_image_ids", [])) + len(attrs.get("images", []))
        self.validate_image_count_for_type(post_type, total_images)
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

        instance.title = validated_data["title"] or None
        instance.body = validated_data["body"] or None
        instance.save(update_fields=["title", "body", "updated_at"])
        instance.images.exclude(id__in=keep_ids).delete()
        instance.tags.set(validated_data["tag_ids"])

        next_order = instance.images.aggregate(models.Max("display_order"))["display_order__max"]
        next_order = 0 if next_order is None else next_order + 1
        new_images = []
        uploaded_urls = []
        try:
            for order, image in enumerate(validated_data["images"]):
                # 2枚目以降のアップロードが失敗した場合、このtransaction.atomicブロックは
                # DB側をロールバックするが、既にS3へ書き込み済みの1枚目のファイルは
                # ロールバックの対象外で孤立してしまう。ここで例外時に自分でクリーンアップする
                url = upload_image(image, folder="posts")
                uploaded_urls.append(url)
                new_images.append(
                    PostImage(post=instance, image_url=url, display_order=next_order + order)
                )
        except Exception:
            for url in uploaded_urls:
                delete_image(url)
            raise
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
    # post_type：全体／フォロー中（scope）とは独立した軸のため、相互排他チェックは設けない
    # （基本設計書6.3章：scope=following&post_type=novel のように自由に組み合わせられる）
    post_type = serializers.ChoiceField(choices=Post.PostType.choices, required=False)
    # tag_id：分類タグによる絞り込み。scope・post_typeと同じく独立した軸で、自由に組み合わせられる
    # （基本設計書6.3章）。存在しないidを渡した場合は該当0件として扱う（400にはしない）
    tag_id = serializers.IntegerField(required=False, min_value=1)

    def validate(self, attrs):
        if attrs.get("before_id") is not None and attrs.get("after_id") is not None:
            raise serializers.ValidationError("before_idとafter_idは同時に指定できません。")
        if attrs.get("user_id") is not None and attrs.get("scope") == "following":
            raise serializers.ValidationError("user_idとscope=followingは同時に指定できません。")
        return attrs


class CommentSerializer(serializers.Serializer):
    """コメント一覧・作成・編集直後のレスポンス共通のシリアライザ（基本設計書6.4章）。"""

    id = serializers.IntegerField(read_only=True)
    author = UserSerializer(source="user", read_only=True)
    content = serializers.SerializerMethodField()
    image_url = serializers.CharField(read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
    updated_at = serializers.DateTimeField(read_only=True)

    def get_content(self, obj):
        return _or_empty(obj.content)


class CommentWriteSerializer(serializers.Serializer):
    """CommentCreateSerializer・CommentUpdateSerializerに共通の入力フィールド・検証
    （基本設計書6.4章）。content（0〜280文字）・image（0〜1枚）の少なくとも一方が必須という
    ルールは両者で同じだが、「保存後に画像が残るか」の判定（既存画像の有無を考慮するか）だけが
    異なるため、それをresulting_has_imageとしてサブクラスに委ねる。

    contentはdefault=""を持たせない：省略された場合はvalidated_dataに"content"キー自体が
    現れないというDRFの挙動を利用し、「本文を省略＝変更しない」（Update時）と
    「本文を明示的に空文字で送る＝本文を消す」を区別できるようにする（PostUpdateSerializerの
    keep_image_idsと同じ理由。ただしそちらはrequired=Trueで明示を強制する方式、こちらは
    「省略時は既存を維持」という逆方向のデフォルト動作にしたいためrequired=Falseのまま）。
    Create時はそもそも既存値が無いため、「省略」も「空文字」も同じ「本文なし」として扱う
    （validated_data.get("content")で読む）。
    """

    content = serializers.CharField(
        max_length=280, trim_whitespace=True, required=False, allow_blank=True
    )
    image = serializers.FileField(required=False)

    def validate_image(self, value):
        validate_image_file(value)
        return value

    def resulting_has_image(self, attrs) -> bool:
        return bool(attrs.get("image"))

    def validate(self, attrs):
        if not attrs.get("content") and not self.resulting_has_image(attrs):
            raise serializers.ValidationError("本文または画像のいずれかを入力してください。")
        return attrs


class CommentCreateSerializer(CommentWriteSerializer):
    """POST /api/posts/{post_id}/comments のリクエストボディ検証・コメント作成を担う
    （基本設計書6.4章）。multipart/form-data。
    """

    def create(self, validated_data):
        image = validated_data.get("image")
        image_url = upload_image(image, folder="comments") if image else None
        return Comment.objects.create(
            post=self.context["post"],
            user=self.context["request"].user,
            content=validated_data.get("content") or None,
            image_url=image_url,
        )


class CommentUpdateSerializer(CommentWriteSerializer):
    """PUT /api/comments/{comment_id} のリクエストボディ検証・コメント編集を担う
    （基本設計書6.4章）。multipart/form-data。content・image・remove_imageのいずれも
    省略した項目は既存の値をそのまま維持する（imageとremove_imageのどちらも送らない場合は
    既存画像を維持、というAPI設計は元々この方針。contentも同じ扱いに揃える）。
    """

    remove_image = serializers.BooleanField(required=False, default=False)

    def resulting_has_image(self, attrs) -> bool:
        # 新しい画像が送られていれば残る。remove_image=trueなら常に残らない。
        # どちらでもなければ既存画像の有無をそのまま引き継ぐ
        if attrs.get("image"):
            return True
        if attrs.get("remove_image"):
            return False
        return bool(self.instance.image_url)

    def update(self, instance, validated_data):
        # S3上の実ファイル削除はここでは行わず、削除対象のURLをinstance._removed_image_urlに
        # 記録するだけにとどめる。実削除はビュー側でこのメソッドの成功（＝DBコミット確定）後に
        # 行う（PostUpdateSerializer.updateと同じ理由）
        removed_url = None
        new_image = validated_data.get("image")
        if new_image:
            removed_url = instance.image_url
            instance.image_url = upload_image(new_image, folder="comments")
        elif validated_data.get("remove_image"):
            removed_url = instance.image_url
            instance.image_url = None

        # "content"キーが無い＝省略（本文は変更しない）。空文字を含め明示的に送られていれば
        # そちらを反映する（contentクラスのdocstring参照）
        if "content" in validated_data:
            instance.content = validated_data["content"] or None
        instance.save(update_fields=["content", "image_url", "updated_at"])
        instance._removed_image_url = removed_url
        return instance
