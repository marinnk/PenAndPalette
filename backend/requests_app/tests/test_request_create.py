from rest_framework import status
from rest_framework.test import APITestCase

from posts.tests.conftest import create_post
from requests_app.models import Request
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class RequestCreateTests(APITestCase):
    def setUp(self):
        self.sender = create_user(
            username="sender", email="sender@example.com", display_name="Sender"
        )
        self.recipient = create_user(
            username="recipient", email="recipient@example.com", display_name="Recipient"
        )
        self.url = f"/api/users/{self.recipient.id}/requests"

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "sender@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_create_without_login_returns_401(self):
        response = self.client.post(self.url, {"message": "続きを書いてほしいです"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_without_related_post_returns_201(self):
        self._login()

        response = self.client.post(self.url, {"message": "続きを書いてほしいです"})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        body = response.json()
        self.assertEqual(body["message"], "続きを書いてほしいです")
        self.assertIsNone(body["related_post"])
        self.assertEqual(
            body["from_user"],
            {
                "id": self.sender.id,
                "username": "sender",
                "display_name": "Sender",
                "avatar_url": None,
            },
        )
        self.assertTrue(
            Request.objects.filter(from_user=self.sender, to_user=self.recipient).exists()
        )

    def test_create_with_recipient_post_returns_embedded_summary(self):
        self._login()
        post = create_post(self.recipient, body="参考にしてほしい投稿")

        response = self.client.post(
            self.url, {"message": "この投稿の続きを書いてほしいです", "related_post_id": post.id}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        related_post = response.json()["related_post"]
        self.assertEqual(related_post["id"], post.id)
        self.assertEqual(related_post["body"], "参考にしてほしい投稿")

    def test_create_with_own_post_returns_embedded_summary(self):
        # 参考にしてほしい投稿は「自分・相手どちらの投稿でもよい」（F-6機能仕様4.1節）
        self._login()
        post = create_post(self.sender, body="自分の投稿")

        response = self.client.post(
            self.url, {"message": "この投稿の続きを書いてほしいです", "related_post_id": post.id}
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.json()["related_post"]["id"], post.id)

    def test_related_post_belonging_to_unrelated_user_returns_400(self):
        # 送信者・宛先のどちらでもない第三者の投稿は参考投稿として指定できない
        self._login()
        unrelated_user = create_user(
            username="unrelated", email="unrelated@example.com", display_name="Unrelated"
        )
        post = create_post(unrelated_user, body="無関係な投稿")

        response = self.client.post(
            self.url, {"message": "無関係な投稿を指定", "related_post_id": post.id}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("related_post_id", response.json())

    def test_self_request_returns_400(self):
        self._login()

        response = self.client.post(
            f"/api/users/{self.sender.id}/requests", {"message": "自分宛て"}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(
            Request.objects.filter(from_user=self.sender, to_user=self.sender).exists()
        )

    def test_recipient_not_found_returns_404(self):
        self._login()

        response = self.client.post(
            f"/api/users/{self.recipient.id + 999}/requests", {"message": "存在しない相手"}
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_blank_message_returns_400(self):
        self._login()

        response = self.client.post(self.url, {"message": ""})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.json())

    def test_missing_message_returns_400(self):
        self._login()

        response = self.client.post(self.url, {})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.json())

    def test_message_over_280_chars_returns_400(self):
        self._login()

        response = self.client.post(self.url, {"message": "あ" * 281})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("message", response.json())

    def test_nonexistent_related_post_id_returns_400(self):
        self._login()

        response = self.client.post(
            self.url, {"message": "存在しない投稿を指定", "related_post_id": 999999}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("related_post_id", response.json())
