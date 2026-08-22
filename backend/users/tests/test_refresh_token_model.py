from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from users.models import InvalidRefreshToken, RefreshToken, hash_token
from users.tests.conftest import create_user


class RefreshTokenManagerTests(TestCase):
    """RefreshTokenManagerの状態遷移をビューを介さずモデル単体で検証する。"""

    def setUp(self):
        self.user = create_user(username="tokenuser", email="tokenuser@example.com")

    def test_issue_stores_only_hash_in_db(self):
        raw_token = RefreshToken.objects.issue(self.user)

        stored = RefreshToken.objects.get(user=self.user)
        self.assertNotEqual(stored.token_hash, raw_token)
        self.assertEqual(stored.token_hash, hash_token(raw_token))

    def test_rotate_revokes_old_token_and_issues_new_one(self):
        raw_token = RefreshToken.objects.issue(self.user)

        user, new_raw_token = RefreshToken.objects.rotate(raw_token)

        self.assertEqual(user, self.user)
        self.assertNotEqual(new_raw_token, raw_token)
        old = RefreshToken.objects.get(token_hash=hash_token(raw_token))
        self.assertIsNotNone(old.revoked_at)

    def test_rotate_with_unknown_token_raises(self):
        with self.assertRaises(InvalidRefreshToken):
            RefreshToken.objects.rotate("does-not-exist")

    def test_rotate_with_expired_token_raises(self):
        raw_token = RefreshToken.objects.issue(self.user)
        RefreshToken.objects.filter(user=self.user).update(
            expires_at=timezone.now() - timedelta(seconds=1)
        )

        with self.assertRaises(InvalidRefreshToken):
            RefreshToken.objects.rotate(raw_token)

    def test_rotate_with_already_revoked_token_revokes_all_active_tokens(self):
        """マルチデバイス（複数トークン）のうち1本が漏えいした場合、全トークンを失効させる。"""
        raw_token_a = RefreshToken.objects.issue(self.user)
        RefreshToken.objects.issue(self.user)
        RefreshToken.objects.rotate(raw_token_a)  # raw_token_aはここで失効済みになる

        with self.assertRaises(InvalidRefreshToken):
            RefreshToken.objects.rotate(raw_token_a)  # 失効済みトークンの再利用

        self.assertEqual(
            RefreshToken.objects.filter(user=self.user, revoked_at__isnull=True).count(), 0
        )

    def test_revoke_marks_token_as_revoked(self):
        raw_token = RefreshToken.objects.issue(self.user)

        RefreshToken.objects.revoke(raw_token)

        stored = RefreshToken.objects.get(token_hash=hash_token(raw_token))
        self.assertIsNotNone(stored.revoked_at)
