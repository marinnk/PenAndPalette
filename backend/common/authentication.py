"""Cookie経由でJWTアクセストークンを認証するDRF認証クラス。

基本設計書 3章「認証方式」で定めた通り、DRFの標準（Authorizationヘッダー）ではなく
HttpOnly Cookie（`access_token`）からアクセストークンを読み取って認証する。

ログイン・リフレッシュ・ログアウトのビュー（Cookieの発行・失効やリフレッシュトークンの
DB管理を含む）はF-1（ログイン機能）で実装する。ここではDRFの
DEFAULT_AUTHENTICATION_CLASSESに設定できる認証クラスの土台のみを用意する。
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken


class CookieJWTAuthentication(JWTAuthentication):
    """`Authorization`ヘッダーの代わりに`access_token`Cookieからトークンを取得する。"""

    def authenticate(self, request):
        raw_token = request.COOKIES.get("access_token")
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except InvalidToken:
            return None

        return self.get_user(validated_token), validated_token
