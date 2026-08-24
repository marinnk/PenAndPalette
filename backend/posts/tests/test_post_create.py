from rest_framework import status
from rest_framework.test import APITestCase

from users.tests.conftest import DEFAULT_PASSWORD, create_user


class PostCreateTests(APITestCase):
    url = "/api/posts"

    def setUp(self):
        self.user = create_user(
            username="creator", email="creator@example.com", display_name="Creator"
        )

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "creator@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_create_without_login_returns_401(self):
        response = self.client.post(self.url, {"body": "本文"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_with_valid_body_returns_201(self):
        self._login()

        response = self.client.post(self.url, {"body": "はじめての投稿です"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["body"], "はじめての投稿です")
        self.assertEqual(body["author"]["id"], self.user.id)
        self.assertEqual(body["like_count"], 0)
        self.assertEqual(body["want_count"], 0)
        self.assertEqual(body["comment_count"], 0)
        self.assertEqual(body["images"], [])
        self.assertFalse(body["liked_by_me"])

    def test_create_with_empty_body_returns_400(self):
        self._login()

        response = self.client.post(self.url, {"body": ""})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_with_too_long_body_returns_400(self):
        self._login()

        response = self.client.post(self.url, {"body": "あ" * 281})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
