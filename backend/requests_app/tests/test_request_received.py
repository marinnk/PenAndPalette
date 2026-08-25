from rest_framework import status
from rest_framework.test import APITestCase

from posts.tests.conftest import create_post
from requests_app.tests.conftest import create_request
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class ReceivedRequestListTests(APITestCase):
    def setUp(self):
        self.recipient = create_user(
            username="recipient", email="recipient@example.com", display_name="Recipient"
        )
        self.other_user = create_user(
            username="other", email="other@example.com", display_name="Other"
        )
        self.sender_a = create_user(
            username="sender_a", email="sender_a@example.com", display_name="SenderA"
        )
        self.sender_b = create_user(
            username="sender_b", email="sender_b@example.com", display_name="SenderB"
        )
        self.url = "/api/requests/received"

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "recipient@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_list_without_login_returns_401(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_empty_when_no_requests_received(self):
        self._login()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_list_returns_only_requests_addressed_to_self_newest_first(self):
        self._login()
        first = create_request(self.sender_a, self.recipient, message="1件目")
        second = create_request(self.sender_b, self.recipient, message="2件目")
        # 自分以外（other_user）宛てのリクエストは一覧に含まれないことを確認するためのノイズデータ
        create_request(self.sender_a, self.other_user, message="他人宛て")

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual([item["id"] for item in body], [second.id, first.id])
        self.assertEqual(body[0]["from_user"]["username"], "sender_b")
        self.assertEqual(body[1]["message"], "1件目")

    def test_related_post_becomes_null_after_post_is_deleted(self):
        self._login()
        post = create_post(self.sender_a, body="参考投稿")
        create_request(self.sender_a, self.recipient, message="参考投稿あり", related_post=post)

        post.delete()
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(len(body), 1)
        self.assertIsNone(body[0]["related_post"])
