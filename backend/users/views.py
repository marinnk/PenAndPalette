from django.contrib.auth import authenticate
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from users.cookies import (
    REFRESH_COOKIE_NAME,
    clear_auth_cookies,
    issue_auth_cookies,
    refresh_auth_cookies,
)
from users.models import InvalidRefreshToken, RefreshToken
from users.serializers import LoginSerializer, RegisterSerializer, UserSerializer

# ログイン失敗時のメッセージ。メール未登録・パスワード誤りのどちらでも同じ文言にすることで、
# メールアドレスの登録有無を外部から推測されないようにする（ユーザー列挙対策）
_INVALID_CREDENTIALS_MESSAGE = "メールアドレスまたはパスワードが正しくありません。"


class RegisterView(APIView):
    """POST /api/auth/register 会員登録する（基本設計書 6.2章）。"""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        response = Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        issue_auth_cookies(response, user)
        return response


class LoginView(APIView):
    """POST /api/auth/login メールアドレス・パスワードでログインする。"""

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = authenticate(
            request,
            username=serializer.validated_data["email"],
            password=serializer.validated_data["password"],
        )
        if user is None:
            return Response(
                {"detail": _INVALID_CREDENTIALS_MESSAGE}, status=status.HTTP_401_UNAUTHORIZED
            )

        response = Response(UserSerializer(user).data)
        issue_auth_cookies(response, user)
        return response


class LogoutView(APIView):
    """POST /api/auth/logout 両Cookieを失効させ、DB上のリフレッシュトークンも失効させる。

    permission_classesを明示していないため、REST_FRAMEWORK["DEFAULT_PERMISSION_CLASSES"]の
    IsAuthenticatedがそのまま効き、未ログイン時は401になる。
    """

    def post(self, request):
        raw_refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if raw_refresh_token:
            RefreshToken.objects.revoke(raw_refresh_token)

        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_auth_cookies(response)
        return response


class RefreshView(APIView):
    """POST /api/auth/refresh アクセス・リフレッシュ両トークンをローテーションして再発行する。"""

    # 認証自体はrefresh_token Cookieの検証で行うため、access_token前提のIsAuthenticatedは使わない
    permission_classes = [AllowAny]

    def post(self, request):
        raw_refresh_token = request.COOKIES.get(REFRESH_COOKIE_NAME)
        if not raw_refresh_token:
            return Response(
                {"detail": "リフレッシュトークンがありません。"},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            user, new_raw_refresh_token = RefreshToken.objects.rotate(raw_refresh_token)
        except InvalidRefreshToken:
            return Response(
                {"detail": "リフレッシュトークンが無効です。"}, status=status.HTTP_401_UNAUTHORIZED
            )

        response = Response(UserSerializer(user).data)
        refresh_auth_cookies(response, user, new_raw_refresh_token)
        return response


class MeView(APIView):
    """GET /api/auth/me ログイン中利用者の基本情報を取得する。"""

    def get(self, request):
        return Response(UserSerializer(request.user).data)
