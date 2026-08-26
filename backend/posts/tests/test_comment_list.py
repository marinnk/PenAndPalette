from rest_framework import status
from rest_framework.test import APITestCase

from posts.tests.conftest import create_comment, create_post
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class CommentListTests(APITestCase):
    def setUp(self):
        self.user = create_user(username="owner", email="owner@example.com", display_name="Owner")
        self.other = create_user(username="other", email="other@example.com", display_name="Other")
        self.post = create_post(self.user, body="コメント一覧確認用の投稿")

    def _login(self, email="owner@example.com"):
        self.client.post("/api/auth/login", {"email": email, "password": DEFAULT_PASSWORD})

    def _url(self, post_id=None):
        return f"/api/posts/{post_id or self.post.id}/comments"

    def test_list_without_login_returns_401(self):
        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_with_nonexistent_post_returns_404(self):
        self._login()

        response = self.client.get(self._url(self.post.id + 999))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_list_with_no_comments_returns_empty_list(self):
        self._login()

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_list_returns_comments_oldest_first_with_author_info(self):
        first = create_comment(self.post, self.other, content="1件目")
        second = create_comment(self.post, self.user, content="2件目")
        self._login()

        response = self.client.get(self._url())

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual([c["id"] for c in body], [first.id, second.id])
        self.assertEqual(body[0]["content"], "1件目")
        self.assertEqual(body[0]["author"]["id"], self.other.id)
        self.assertEqual(body[1]["author"]["id"], self.user.id)

    def test_list_only_includes_comments_of_the_specified_post(self):
        other_post = create_post(self.user, body="別の投稿")
        create_comment(other_post, self.user, content="別の投稿へのコメント")
        create_comment(self.post, self.user, content="この投稿へのコメント")
        self._login()

        response = self.client.get(self._url())

        body = response.json()
        self.assertEqual(len(body), 1)
        self.assertEqual(body[0]["content"], "この投稿へのコメント")
