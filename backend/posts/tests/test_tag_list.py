from rest_framework import status
from rest_framework.test import APITestCase

from posts.models import Tag
from users.tests.conftest import DEFAULT_PASSWORD, create_user


class TagListTests(APITestCase):
    """GET /api/tags のテスト（基本設計書6.11章）。固定の分類タグ12件は
    マイグレーション（posts/migrations/0006_seed_tags.py）で投入済み。
    """

    url = "/api/tags"

    def setUp(self):
        self.user = create_user(
            username="tag-viewer", email="tag-viewer@example.com", display_name="TagViewer"
        )

    def _login(self):
        self.client.post(
            "/api/auth/login", {"email": "tag-viewer@example.com", "password": DEFAULT_PASSWORD}
        )

    def test_list_without_login_returns_401(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_list_returns_12_fixed_tags_in_display_order(self):
        self._login()

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        body = response.json()
        self.assertEqual(len(body), 12)
        expected_names = list(Tag.objects.order_by("display_order").values_list("name", flat=True))
        self.assertEqual([tag["name"] for tag in body], expected_names)
        self.assertEqual(
            body[0], {"id": Tag.objects.get(name="オリジナル").id, "name": "オリジナル"}
        )
        # レスポンスはdisplay_orderを含まない{id, name}のみ（基本設計書6.11章）
        self.assertEqual(set(body[0].keys()), {"id", "name"})
