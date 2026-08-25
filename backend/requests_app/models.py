from django.db import models

from posts.models import Post
from users.models import User


class RequestManager(models.Manager):
    def received_by(self, user: "User"):
        """userが受信したリクエスト一覧を新しい順で返す（GET /api/requests/received）。

        学習規模のデータ量を前提にページネーションは設けない（基本設計書6.7・6.9章、
        FollowersListViewと同方針）。
        """
        return (
            self.filter(to_user=user)
            .select_related("from_user", "related_post", "related_post__user")
            .order_by("-id")
        )


class Request(models.Model):
    """基本設計書 4.2章 requestsテーブルに対応するモデル。

    承認・却下やスレッド化は行わないため、状態（ステータス）を表すカラムは持たない。
    Followと違い一意制約は無い（同じ相手に何度でも送信できる）。
    """

    from_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sent_requests")
    to_user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="received_requests")
    # 参考にしてほしい投稿（任意）。削除された場合はリクエスト自体は残し、related_post_idのみ
    # NULLにする（基本設計書4.2章 ON DELETE SET NULL）
    related_post = models.ForeignKey(
        Post, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    message = models.CharField(max_length=280)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = RequestManager()

    class Meta:
        db_table = "requests"
        constraints = [
            models.CheckConstraint(
                condition=~models.Q(from_user=models.F("to_user")), name="no_self_request"
            ),
        ]

    def __str__(self):
        return f"Request({self.id}, from={self.from_user_id}, to={self.to_user_id})"
