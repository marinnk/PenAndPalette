from django.conf import settings
from django.db import models
from django.db.models import Count, Exists, OuterRef, Q


class PostQuerySet(models.QuerySet):
    def with_reactions(self, viewer):
        """一覧・詳細・作成直後の再取得すべてで使う、いいね/かきたい/コメント数の集計付き
        クエリセット。

        同一クエリでlikes・wants・commentsの3つの逆参照をCountすると、JOINが直積になり件数が
        水増しされるため、distinct=Trueが必須（基本設計書6.3章のN+1回避方針と対になる注意点）。
        """
        return (
            self.select_related("user")
            .prefetch_related("images")
            .annotate(
                like_count=Count("likes", distinct=True),
                want_count=Count("wants", distinct=True),
                comment_count=Count("comments", distinct=True),
                liked_by_me=Exists(Like.objects.filter(post=OuterRef("pk"), user=viewer)),
                wanted_by_me=Exists(Want.objects.filter(post=OuterRef("pk"), user=viewer)),
            )
        )


class PostManager(models.Manager.from_queryset(PostQuerySet)):
    def list_for_timeline(
        self, viewer, *, scope=None, user_id=None, before_id=None, after_id=None, limit=20
    ):
        """基本設計書6.3・6.9章のカーソルページネーションで投稿一覧を取得する。

        has_moreはlimit+1件取得することで判定し、追加のCOUNTクエリは発行しない。
        """
        from users.models import Follow

        qs = self.with_reactions(viewer).order_by("-id")
        if user_id:
            qs = qs.filter(user_id=user_id)
        elif scope == "following":
            qs = qs.filter(
                Q(user_id__in=Follow.objects.followee_ids(viewer)) | Q(user_id=viewer.id)
            )
        if before_id:
            qs = qs.filter(id__lt=before_id)
        if after_id is not None:
            qs = qs.filter(id__gt=after_id)

        rows = list(qs[: limit + 1])
        has_more = len(rows) > limit
        return rows[:limit], has_more


class Post(models.Model):
    """基本設計書 4.2章 postsテーブルに対応するモデル。

    「本文・画像の少なくとも一方が必要」というルールはDB制約ではなくPostCreateSerializer側の
    バリデーションで実現するため、bodyは画像のみの投稿ではNULLになりうる（NULL可）。
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    body = models.CharField(max_length=280, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PostManager()

    class Meta:
        db_table = "posts"
        ordering = ["-id"]

    def __str__(self):
        return f"Post({self.id}, user={self.user_id})"


class PostImage(models.Model):
    """基本設計書 4.2章 post_imagesテーブルに対応するモデル。1投稿につき最大4件、
    display_order（0始まり）で表示順を保持する。
    """

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="images")
    image_url = models.CharField(max_length=500)
    display_order = models.PositiveSmallIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "post_images"
        ordering = ["display_order"]

    def __str__(self):
        return f"PostImage({self.id}, post={self.post_id})"


class ReactionManager(models.Manager):
    """いいね・かきたい共通の、冪等な付与/解除ロジック（基本設計書6.5章）。"""

    def add(self, post, user):
        self.get_or_create(post=post, user=user)

    def remove(self, post, user):
        self.filter(post=post, user=user).delete()


class PostReaction(models.Model):
    """Like/Wantの共通項（user・created_at）をまとめる抽象基底クラス。"""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = ReactionManager()

    class Meta:
        abstract = True


class Like(PostReaction):
    """基本設計書 4.2章 likesテーブルに対応するモデル。"""

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="likes")

    class Meta:
        db_table = "likes"
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="uniq_like")]


class Want(PostReaction):
    """基本設計書 4.2章 wantsテーブルに対応するモデル。テーブル構造はlikesと同一だが、
    いいねとは独立して付けられるため別テーブルとする。
    """

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="wants")

    class Meta:
        db_table = "wants"
        constraints = [models.UniqueConstraint(fields=["post", "user"], name="uniq_want")]


class CommentManager(models.Manager):
    def list_for_post(self, post_id):
        """指定した投稿のコメントを古い順（id昇順）・コメント者情報込みで1回のJOINクエリ
        で取得する（基本設計書6.4章）。
        """
        return self.filter(post_id=post_id).select_related("user")


class Comment(models.Model):
    """基本設計書 4.2章 commentsテーブルに対応するモデル。「本文・画像の少なくとも一方が
    必要」というルールはPostと同様、DB制約ではなくシリアライザ側のバリデーションで実現する
    ため、content・image_urlはどちらもNULL可。
    """

    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name="comments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    content = models.CharField(max_length=280, null=True, blank=True)
    image_url = models.CharField(max_length=500, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = CommentManager()

    class Meta:
        db_table = "comments"
        ordering = ["id"]  # 古い順（Postの["-id"]とは逆）

    def __str__(self):
        return f"Comment({self.id}, post={self.post_id})"
