from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Post
from users.models import Follow, User


class HealthCheckTests(APITestCase):
    def test_health_check_returns_ok(self):
        response = self.client.get("/api/health")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"status": "ok"})


class SeedPerfDataCommandTests(TestCase):
    """perf-tests 用のシード投入コマンド。件数と冪等性・ログイン可能性だけ最小限で確認する。"""

    def run_seed(self, **kwargs):
        call_command("seed_perf_data", stdout=StringIO(), **kwargs)

    def test_creates_users_posts_and_follows(self):
        self.run_seed(users=6, posts_per_user=3)

        users = User.objects.filter(username__startswith="perf_user_")
        self.assertEqual(users.count(), 6)
        self.assertEqual(Post.objects.filter(user__in=users).count(), 18)
        # perf_user_0001 は残り全員（5 人）がフォロワーになる
        popular = User.objects.get(username="perf_user_0001")
        self.assertEqual(Follow.objects.filter(followee=popular).count(), 5)
        # 投入したユーザーでログインできる（パスワードは固定）
        self.assertTrue(popular.check_password("Passw0rd!"))

    def test_is_idempotent(self):
        self.run_seed(users=5, posts_per_user=2)
        self.run_seed(users=4, posts_per_user=2)

        self.assertEqual(User.objects.filter(username__startswith="perf_user_").count(), 4)
