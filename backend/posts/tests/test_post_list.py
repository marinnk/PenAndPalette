from rest_framework import status
from rest_framework.test import APITestCase

from posts.tests.conftest import create_post, create_post_image
from users.models import Follow
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class PostListTests(APITestCase):
    url = "/api/posts"

    def setUp(self):
        self.user = create_user(
            username="listuser", email="list@example.com", display_name="List User"
        )

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "list@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_list_without_login_returns_401(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_with_no_posts_returns_empty_results(self):
        self._login()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), {"results": [], "has_more": False})

    def test_list_returns_posts_newest_first(self):
        self._login()
        older = create_post(self.user, body="古い投稿")
        newer = create_post(self.user, body="新しい投稿")

        response = self.client.get(self.url)

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [newer.id, older.id])

    def test_limit_and_has_more(self):
        self._login()
        for i in range(3):
            create_post(self.user, body=f"投稿{i}")

        response = self.client.get(self.url, {"limit": 2})

        body = response.json()
        self.assertEqual(len(body["results"]), 2)
        self.assertTrue(body["has_more"])

    def test_has_more_is_false_when_exactly_at_limit(self):
        self._login()
        for i in range(2):
            create_post(self.user, body=f"投稿{i}")

        response = self.client.get(self.url, {"limit": 2})

        self.assertFalse(response.json()["has_more"])

    def test_before_id_returns_older_posts(self):
        self._login()
        p1 = create_post(self.user, body="1件目")
        p2 = create_post(self.user, body="2件目")
        create_post(self.user, body="3件目")

        response = self.client.get(self.url, {"before_id": p2.id + 1})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertNotIn(p2.id + 1, ids)
        self.assertIn(p1.id, ids)
        self.assertIn(p2.id, ids)

    def test_after_id_returns_newer_posts(self):
        self._login()
        p1 = create_post(self.user, body="1件目")
        p2 = create_post(self.user, body="2件目")

        response = self.client.get(self.url, {"after_id": p1.id})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [p2.id])

    def test_after_id_zero_returns_all_posts_instead_of_400(self):
        """after_id=0はフロントエンドのポーリングが「まだ投稿を1件も知らない」ことを表す
        ために使う値（useTimeline.ts参照）。空のタイムラインでもポーリングが400にならず、
        全件を取得できることを確認する。
        """
        self._login()
        post = create_post(self.user, body="1件目")

        response = self.client.get(self.url, {"after_id": 0})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [post.id])

    def test_before_id_and_after_id_together_returns_400(self):
        self._login()

        response = self.client.get(self.url, {"before_id": 1, "after_id": 1})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_user_id_filters_to_that_users_posts(self):
        self._login()
        other = create_user(
            username="otheruser", email="other@example.com", display_name="Other User"
        )
        mine = create_post(self.user, body="自分の投稿")
        create_post(other, body="他人の投稿")

        response = self.client.get(self.url, {"user_id": self.user.id})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [mine.id])

    def test_user_id_and_scope_following_together_returns_400(self):
        self._login()

        response = self.client.get(self.url, {"user_id": self.user.id, "scope": "following"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_scope_following_with_no_follows_returns_only_own_posts(self):
        """F-7（フォロー機能）未実装のため、followsテーブルは常に空。
        「フォロー中」タブが自分の投稿のみを返すのは仕様どおりの暫定挙動である。
        """
        self._login()
        other = create_user(
            username="otheruser2", email="other2@example.com", display_name="Other User2"
        )
        mine = create_post(self.user, body="自分の投稿")
        create_post(other, body="他人の投稿")

        response = self.client.get(self.url, {"scope": "following"})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [mine.id])

    def test_scope_following_includes_followees_posts(self):
        self._login()
        followee = create_user(
            username="followeeuser", email="followee@example.com", display_name="Followee"
        )
        Follow.objects.create(follower=self.user, followee=followee)
        followee_post = create_post(followee, body="フォロー中の投稿")

        response = self.client.get(self.url, {"scope": "following"})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertIn(followee_post.id, ids)

    def test_like_and_want_counts_are_not_inflated_by_join_fanout(self):
        """distinct=Trueが無いと、likes・wantsの同時annotateがJOIN直積でカウントを水増しする
        ことを検出する決定的なテスト。
        """
        self._login()
        post = create_post(self.user, body="人気の投稿")
        liker1 = create_user(username="liker1", email="liker1@example.com", display_name="Liker1")
        liker2 = create_user(username="liker2", email="liker2@example.com", display_name="Liker2")
        post.likes.create(user=liker1)
        post.likes.create(user=liker2)
        post.wants.create(user=liker1)

        response = self.client.get(self.url)

        row = next(r for r in response.json()["results"] if r["id"] == post.id)
        self.assertEqual(row["like_count"], 2)
        self.assertEqual(row["want_count"], 1)
        self.assertFalse(row["liked_by_me"])

    def test_list_returns_image_urls_in_display_order(self):
        self._login()
        post = create_post(self.user, body="画像付き投稿")
        create_post_image(post, image_url="https://example.com/2.jpg", display_order=1)
        create_post_image(post, image_url="https://example.com/1.jpg", display_order=0)

        response = self.client.get(self.url)

        row = next(r for r in response.json()["results"] if r["id"] == post.id)
        self.assertEqual(row["images"], ["https://example.com/1.jpg", "https://example.com/2.jpg"])
