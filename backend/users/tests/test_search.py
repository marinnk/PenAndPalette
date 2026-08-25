from rest_framework import status
from rest_framework.test import APITestCase

from users.tests.conftest import DEFAULT_PASSWORD, create_user


class UserSearchTests(APITestCase):
    """GET /api/users/?q=（基本設計書6.8章）。"""

    def setUp(self):
        self.viewer = create_user(
            username="viewer", email="viewer@example.com", display_name="Viewer"
        )
        self.taro = create_user(username="taro_ill", email="taro@example.com", display_name="太郎")
        self.jiro = create_user(username="jiro_ill", email="jiro@example.com", display_name="次郎")

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "viewer@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_search_without_login_returns_401(self):
        response = self.client.get("/api/users/", {"q": "taro"})

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_search_by_username_partial_match_returns_matching_users(self):
        self._login()

        response = self.client.get("/api/users/", {"q": "taro"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["id"] for row in response.json()], [self.taro.id])

    def test_search_by_display_name_partial_match_returns_matching_users(self):
        self._login()

        response = self.client.get("/api/users/", {"q": "太"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([row["id"] for row in response.json()], [self.taro.id])

    def test_search_without_q_param_returns_empty_list(self):
        self._login()

        response = self.client.get("/api/users/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_search_with_empty_q_returns_empty_list(self):
        self._login()

        response = self.client.get("/api/users/", {"q": ""})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_search_with_whitespace_only_q_returns_empty_list(self):
        self._login()

        response = self.client.get("/api/users/", {"q": "   "})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_search_with_no_matches_returns_empty_list(self):
        self._login()

        response = self.client.get("/api/users/", {"q": "nonexistent"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.json(), [])

    def test_search_response_includes_expected_fields(self):
        self._login()

        response = self.client.get("/api/users/", {"q": "taro"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            set(response.json()[0].keys()), {"id", "username", "display_name", "avatar_url"}
        )
