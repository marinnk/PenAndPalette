from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Post, Tag
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

    def test_post_type_illustration_filters_to_illustration_posts_only(self):
        self._login()
        illustration = create_post(self.user, post_type=Post.PostType.ILLUSTRATION)
        create_post(self.user, post_type=Post.PostType.NOVEL, title="小説投稿", body="本文")

        response = self.client.get(self.url, {"post_type": "illustration"})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [illustration.id])

    def test_post_type_novel_filters_to_novel_posts_only(self):
        self._login()
        create_post(self.user, post_type=Post.PostType.ILLUSTRATION)
        novel = create_post(
            self.user, post_type=Post.PostType.NOVEL, title="小説投稿", body="本文"
        )

        response = self.client.get(self.url, {"post_type": "novel"})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [novel.id])

    def test_post_type_omitted_returns_both_types(self):
        self._login()
        illustration = create_post(self.user, post_type=Post.PostType.ILLUSTRATION)
        novel = create_post(
            self.user, post_type=Post.PostType.NOVEL, title="小説投稿", body="本文"
        )

        response = self.client.get(self.url)

        ids = {row["id"] for row in response.json()["results"]}
        self.assertEqual(ids, {illustration.id, novel.id})

    def test_invalid_post_type_returns_400(self):
        self._login()

        response = self.client.get(self.url, {"post_type": "comic"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_type_combines_with_scope_following(self):
        """post_typeはscope（全体／フォロー中）とは独立した軸のため、自由に組み合わせられる
        （基本設計書6.3章）。
        """
        self._login()
        followee = create_user(
            username="followee-for-type",
            email="followee-for-type@example.com",
            display_name="FolloweeForType",
        )
        Follow.objects.create(follower=self.user, followee=followee)
        followee_novel = create_post(
            followee, post_type=Post.PostType.NOVEL, title="フォロー中の小説", body="本文"
        )
        create_post(followee, post_type=Post.PostType.ILLUSTRATION)
        create_post(self.user, post_type=Post.PostType.NOVEL, title="自分の小説", body="本文")

        response = self.client.get(self.url, {"scope": "following", "post_type": "novel"})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertIn(followee_novel.id, ids)
        for row in response.json()["results"]:
            self.assertEqual(row["post_type"], "novel")

    def test_tag_id_filters_to_posts_with_that_tag(self):
        self._login()
        fantasy = Tag.objects.get(name="ファンタジー")
        sf = Tag.objects.get(name="SF")
        tagged = create_post(self.user)
        tagged.tags.set([fantasy])
        other = create_post(self.user)
        other.tags.set([sf])
        create_post(self.user)  # タグなし

        response = self.client.get(self.url, {"tag_id": fantasy.id})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [tagged.id])

    def test_tag_id_combines_with_scope_and_post_type(self):
        """tag_idはscope・post_typeとは独立した軸で、自由に組み合わせられる（基本設計書6.3章）。"""
        self._login()
        fantasy = Tag.objects.get(name="ファンタジー")
        followee = create_user(
            username="followee-for-tag",
            email="followee-for-tag@example.com",
            display_name="FolloweeForTag",
        )
        Follow.objects.create(follower=self.user, followee=followee)
        match = create_post(
            followee, post_type=Post.PostType.NOVEL, title="フォロー中の小説", body="本文"
        )
        match.tags.set([fantasy])
        followee_illust = create_post(followee, post_type=Post.PostType.ILLUSTRATION)
        followee_illust.tags.set([fantasy])
        followee_novel_no_tag = create_post(
            followee, post_type=Post.PostType.NOVEL, title="タグなし小説", body="本文"
        )

        response = self.client.get(
            self.url, {"scope": "following", "post_type": "novel", "tag_id": fantasy.id}
        )

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [match.id])
        self.assertNotIn(followee_illust.id, ids)
        self.assertNotIn(followee_novel_no_tag.id, ids)

    def test_unknown_tag_id_returns_empty_results_not_400(self):
        self._login()
        create_post(self.user)

        response = self.client.get(self.url, {"tag_id": 999999})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["results"], [])

    def test_invalid_tag_id_returns_400(self):
        self._login()

        response = self.client.get(self.url, {"tag_id": "abc"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_tag_id_does_not_inflate_results_with_multiple_tags(self):
        """1投稿が複数タグを持っていても、tag_id絞り込みで行が重複しないこと。"""
        self._login()
        fantasy = Tag.objects.get(name="ファンタジー")
        multi = create_post(self.user)
        multi.tags.set(list(Tag.objects.all()[:5]))

        response = self.client.get(self.url, {"tag_id": fantasy.id})

        ids = [row["id"] for row in response.json()["results"]]
        self.assertEqual(ids, [multi.id])
