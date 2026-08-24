from django.conf import settings
from django.db import models
from django.db.models import Count, Exists, OuterRef, Q


class PostQuerySet(models.QuerySet):
    def with_reactions(self, viewer):
        """一覧・詳細・作成直後の再取得すべてで使う、いいね/かきたいの集計付きクエリセット。

        同一クエリでlikes・wantsの2つの逆参照をCountすると、JOINが直積になり件数が
        水増しされるため、distinct=Trueが必須（基本設計書6.3章のN+1回避方針と対になる注意点）。
        """
        return self.select_related("user").annotate(
            like_count=Count("likes", distinct=True),
            want_count=Count("wants", distinct=True),
            liked_by_me=Exists(Like.objects.filter(post=OuterRef("pk"), user=viewer)),
            wanted_by_me=Exists(Want.objects.filter(post=OuterRef("pk"), user=viewer)),
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

    画像添付（post_images）は今回のスコープ外（画像対応Issueで別途実装）のため、
    bodyは本文・画像の少なくとも一方必須という設計書の制約とは異なり、今回は必須項目とする。
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="posts"
    )
    body = models.CharField(max_length=280)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = PostManager()

    class Meta:
        db_table = "posts"
        ordering = ["-id"]

    def __str__(self):
        return f"Post({self.id}, user={self.user_id})"


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
