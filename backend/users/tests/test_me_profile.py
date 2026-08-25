from rest_framework import status
from rest_framework.test import APITestCase

from users.models import Follow
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class MeProfileUpdateTests(APITestCase):
    url = "/api/users/me"

    def setUp(self):
        self.user = create_user(
            username="meuser",
            email="me@example.com",
            display_name="Me User",
            bio="編集前の自己紹介",
        )

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "me@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_update_without_login_returns_401(self):
        response = self.client.put(self.url, {"bio": "更新後"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_update_bio_returns_200_and_updated_profile(self):
        self._login()

        response = self.client.put(self.url, {"bio": "更新後の自己紹介"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.json(),
            {
                "id": self.user.id,
                "username": "meuser",
                "display_name": "Me User",
                "bio": "更新後の自己紹介",
                "avatar_url": None,
                "follower_count": 0,
                "following_count": 0,
                "followed_by_me": False,
            },
        )
        self.user.refresh_from_db()
        self.assertEqual(self.user.bio, "更新後の自己紹介")

    def test_update_with_blank_bio_clears_it(self):
        self._login()

        response = self.client.put(self.url, {"bio": ""})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIsNone(response.json()["bio"])
        self.user.refresh_from_db()
        self.assertIsNone(self.user.bio)

    def test_update_with_160_char_bio_returns_200(self):
        self._login()
        bio = "あ" * 160

        response = self.client.put(self.url, {"bio": bio})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json()["bio"], bio)

    def test_update_with_161_char_bio_returns_400(self):
        self._login()

        response = self.client.put(self.url, {"bio": "あ" * 161})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("bio", response.json())
        self.user.refresh_from_db()
        self.assertEqual(self.user.bio, "編集前の自己紹介")

    def test_update_without_bio_returns_400(self):
        self._login()

        response = self.client.put(self.url, {})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("bio", response.json())

    def test_update_reflects_follower_and_following_counts(self):
        # MeProfileView.putは_reload_with_follow_stats（usersテーブルの再SELECT）を経由せず
        # Followモデルへの軽いCOUNTクエリで件数を数える（_attach_own_follow_stats）ため、
        # その集計が実際のフォロー関係と一致することを確認する
        follower = create_user(username="follower", email="follower@example.com")
        followee = create_user(username="followee", email="followee@example.com")
        Follow.objects.add(follower, self.user)
        Follow.objects.add(self.user, followee)
        self._login()

        response = self.client.put(self.url, {"bio": "更新後"})

        body = response.json()
        self.assertEqual(body["follower_count"], 1)
        self.assertEqual(body["following_count"], 1)
        self.assertFalse(body["followed_by_me"])
