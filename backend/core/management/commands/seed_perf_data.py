"""perf-tests（k6 負荷試験・Lighthouse 監査）用のダミーデータを投入する管理コマンド。

【重要】ローカルの使い捨て DB 専用。共有環境・本番相当の環境では実行しないこと。
パスワード固定（Passw0rd!）のダミーアカウントを大量に作成する。

冪等性: username が "perf_user_" で始まる既存ユーザーを削除してから再投入するため、
複数回実行しても件数は増え続けない（User への FK はすべて CASCADE のため、投稿・コメント・
いいね・かきたい・フォロー・リクエスト・リフレッシュトークンも連鎖的に消える）。
k6 の post-create / reactions シナリオが作ったデータもここでリセットされる。

使い方（詳細は perf-tests/seed/README.md）:
    python manage.py seed_perf_data
    python manage.py seed_perf_data --users 200 --posts-per-user 10
"""

import random

from django.contrib.auth.hashers import make_password
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from posts.models import Comment, Like, Post, PostTag, Tag, Want
from users.models import Follow, User

USERNAME_PREFIX = "perf_user_"
SEED_PASSWORD = "Passw0rd!"
# フォロワー一覧（意図的な非ページネーション）・プロフィールのフォロワー数集計の負荷試験対象。
POPULAR_USER_INDEX = 1


def seed_username(n: int) -> str:
    return f"{USERNAME_PREFIX}{n:04d}"


class Command(BaseCommand):
    help = "perf-tests 用のダミーデータを投入する（ユーザー・投稿・フォロー・いいね等）"

    def add_arguments(self, parser):
        parser.add_argument("--users", type=int, default=500, help="作成するダミーユーザー数")
        parser.add_argument(
            "--posts-per-user", type=int, default=20, help="1ユーザーあたりの投稿数"
        )
        parser.add_argument("--seed", type=int, default=42, help="乱数シード（再現性のため）")

    @transaction.atomic
    def handle(self, *args, **options):
        user_count = options["users"]
        posts_per_user = options["posts_per_user"]
        rng = random.Random(options["seed"])

        deleted, _ = User.objects.filter(username__startswith=USERNAME_PREFIX).delete()
        if deleted:
            self.stdout.write(f"既存の {USERNAME_PREFIX}* データを削除しました（{deleted} 行）")

        tags = list(Tag.objects.all())
        if not tags:
            raise CommandError(
                "tags が空です。先に `python manage.py migrate` を実行してください。"
            )

        # 全員同じパスワードのため、ハッシュ計算は 1 回だけ行い使い回す（pbkdf2 を人数分回さない）
        password_hash = make_password(SEED_PASSWORD)
        User.objects.bulk_create(
            User(
                username=seed_username(n),
                email=f"{seed_username(n)}@example.com",
                password=password_hash,
                display_name=f"Perf User {n:04d}",
                bio="perf-tests の負荷試験用に投入したダミーアカウント",
            )
            for n in range(1, user_count + 1)
        )
        # MySQL の bulk_create は PK を返さないため、採番済みの行を読み直す
        users = list(
            User.objects.filter(username__startswith=USERNAME_PREFIX).order_by("username")
        )
        self.stdout.write(f"ユーザー {len(users)} 件")

        # 投稿: 小説・イラストを混在させる（タイムラインの種別タブ絞り込みも試せるように）。
        # イラスト投稿は本来 1〜4 枚の画像が必須だが、S3/MinIO への依存を避けるため画像は付けない
        # （読み取り負荷の観測が目的で、DB 制約には抵触しない。詳細は perf-tests/README.md）。
        new_posts = []
        for user in users:
            for i in range(posts_per_user):
                is_novel = rng.random() < 0.5
                new_posts.append(
                    Post(
                        user=user,
                        post_type=Post.PostType.NOVEL if is_novel else Post.PostType.ILLUSTRATION,
                        title=f"perf 小説 #{i + 1} by {user.username}" if is_novel else None,
                        body=(
                            f"perf test novel body #{i + 1} by {user.username}. " * 8
                            if is_novel
                            else f"perf test illustration caption #{i + 1}"
                        ),
                    )
                )
        Post.objects.bulk_create(new_posts)
        posts = list(Post.objects.filter(user__in=users).order_by("id"))
        self.stdout.write(f"投稿 {len(posts)} 件")

        # タグ付け: 各投稿に 0〜3 個
        post_tags = []
        for post in posts:
            for tag in rng.sample(tags, rng.randint(0, min(3, len(tags)))):
                post_tags.append(PostTag(post_id=post.id, tag_id=tag.id))
        PostTag.objects.bulk_create(post_tags, ignore_conflicts=True)
        self.stdout.write(f"投稿タグ {len(post_tags)} 件")

        # フォロー: 各ユーザーが直後 10 人をフォロー（wrap-around）。加えて perf_user_0001 には
        # 残り全員をフォロワーとして付ける（非ページネーションのフォロワー一覧の挙動確認用）。
        follows = []
        seen = set()
        for idx, follower in enumerate(users):
            for offset in range(1, 11):
                followee = users[(idx + offset) % user_count]
                if followee.id != follower.id and (follower.id, followee.id) not in seen:
                    seen.add((follower.id, followee.id))
                    follows.append(Follow(follower=follower, followee=followee))
        popular = users[POPULAR_USER_INDEX - 1]
        for follower in users:
            if follower.id != popular.id and (follower.id, popular.id) not in seen:
                seen.add((follower.id, popular.id))
                follows.append(Follow(follower=follower, followee=popular))
        Follow.objects.bulk_create(follows, ignore_conflicts=True)
        self.stdout.write(f"フォロー {len(follows)} 件")

        # いいね / かきたい: 投稿ごとに 0〜19 人 / 0〜9 人
        likes, wants = [], []
        for post in posts:
            for reactor in rng.sample(users, rng.randint(0, min(19, user_count))):
                likes.append(Like(post=post, user=reactor))
            for reactor in rng.sample(users, rng.randint(0, min(9, user_count))):
                wants.append(Want(post=post, user=reactor))
        Like.objects.bulk_create(likes, ignore_conflicts=True)
        Want.objects.bulk_create(wants, ignore_conflicts=True)
        self.stdout.write(f"いいね {len(likes)} 件 / かきたい {len(wants)} 件")

        # コメント: 投稿ごとに 0〜4 件
        comments = []
        for post in posts:
            for commenter in rng.sample(users, rng.randint(0, 4)):
                comments.append(
                    Comment(
                        post=post,
                        user=commenter,
                        content=f"perf test comment by {commenter.username}",
                    )
                )
        Comment.objects.bulk_create(comments)
        self.stdout.write(f"コメント {len(comments)} 件")

        self.stdout.write(
            self.style.SUCCESS(
                f"完了。ログイン可能なダミーユーザー: {seed_username(1)}@example.com 〜 "
                f"{seed_username(user_count)}@example.com（パスワードは全員 {SEED_PASSWORD}）"
            )
        )
