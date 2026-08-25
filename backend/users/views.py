from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import get_other_user_or_400
from users.cookies import (
    REFRESH_COOKIE_NAME,
    clear_auth_cookies,
    issue_auth_cookies,
    refresh_auth_cookies,
)
from users.models import Follow, InvalidRefreshToken, RefreshToken, User
from users.serializers import (
    FollowActionSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserProfileSerializer,
    UserSerializer,
)

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


class UserProfileView(APIView):
    """GET /api/users/{user_id} 指定した利用者のプロフィールを取得する（基本設計書6.6章）。"""

    def get(self, request, user_id):
        user = get_object_or_404(User.objects.with_follow_stats(request.user), pk=user_id)
        return Response(UserProfileSerializer(user).data)


def _reload_with_follow_stats(user_id, viewer):
    """フォロー/フォロー解除の直後に最新のfollower_count等を1件だけ再取得する。"""
    return User.objects.with_follow_stats(viewer).get(pk=user_id)


class FollowView(APIView):
    """POST/DELETE /api/users/{user_id}/follow フォロー/フォロー解除する（基本設計書6.6章）。

    likes/wants（PostLikeView/PostWantView）と同じ、UNIQUE制約に対応する冪等な2エンドポイント。
    自己フォローはfollowsテーブルのCHECK制約でも防がれるが、制約違反による500ではなく
    わかりやすい400を返すため登録前にアプリケーション側でも判定する（基本設計書6.6章）。
    """

    def post(self, request, user_id):
        target, error = get_other_user_or_400(
            request, User, user_id, self_target_message="自分自身をフォローすることはできません。"
        )
        if error:
            return error
        Follow.objects.add(request.user, target)
        return Response(
            FollowActionSerializer(_reload_with_follow_stats(user_id, request.user)).data
        )

    def delete(self, request, user_id):
        target = get_object_or_404(User, pk=user_id)
        Follow.objects.remove(request.user, target)
        return Response(
            FollowActionSerializer(_reload_with_follow_stats(user_id, request.user)).data
        )


class FollowersListView(APIView):
    """GET /api/users/{user_id}/followers 指定した利用者のフォロワー一覧を取得する。

    学習規模のデータ量を前提にページネーションは設けない（基本設計書6.6・6.9章）。
    """

    def get(self, request, user_id):
        get_object_or_404(User, pk=user_id)
        followers = User.objects.filter(following__followee_id=user_id).order_by("-following__id")
        return Response(UserSerializer(followers, many=True).data)


class FollowingListView(APIView):
    """GET /api/users/{user_id}/following 指定した利用者がフォロー中の利用者一覧を取得する
    （基本設計書6.6章）。
    """

    def get(self, request, user_id):
        get_object_or_404(User, pk=user_id)
        following = User.objects.filter(followers__follower_id=user_id).order_by("-followers__id")
        return Response(UserSerializer(following, many=True).data)
