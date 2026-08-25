from django.contrib.auth import authenticate
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import get_other_user_or_400
from common.storage import delete_images_best_effort
from users.cookies import (
    REFRESH_COOKIE_NAME,
    clear_auth_cookies,
    issue_auth_cookies,
    refresh_auth_cookies,
)
from users.models import Follow, InvalidRefreshToken, RefreshToken, User
from users.serializers import (
    AvatarUploadSerializer,
    FollowActionSerializer,
    LoginSerializer,
    ProfileUpdateSerializer,
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
    """フォロー/フォロー解除の直後に最新のfollower_count等を1件だけ再取得する
    （viewerが対象user_id自身とは限らない、UserProfileView・FollowView向けの汎用版）。
    """
    return User.objects.with_follow_stats(viewer).get(pk=user_id)


def _attach_own_follow_stats(user):
    """PUT /api/users/me・POST/DELETE /api/users/me/avatar向けの軽量版。

    いずれも「更新した自分自身をレスポンスとして返す」自己参照的なエンドポイントで、
    引数のuserは既にbio/avatar_url更新後の状態がメモリ上にある。_reload_with_follow_stats
    （usersテーブルへ2distinct-JOIN＋EXISTSで再SELECTする、他人の閲覧も想定した汎用版）を
    使うと、変化していないusername・display_name等まで含めて丸ごと再取得してしまい無駄が大きい。
    自己フォローはfollowsテーブルのCHECK制約で禁止されているためfollowed_by_meは常にFalseと
    自明で、follower_count・following_countもFollowモデルへの軽いCOUNTクエリ2本で済む。
    """
    user.follower_count = Follow.objects.filter(followee=user).count()
    user.following_count = Follow.objects.filter(follower=user).count()
    user.followed_by_me = False
    return user


class MeProfileView(APIView):
    """PUT /api/users/me 自分のプロフィール（自己紹介のみ）を編集する（基本設計書6.6章）。

    レスポンス形式をGET /api/users/{id}と揃えるため、UserProfileSerializerで返す。
    """

    def put(self, request):
        serializer = ProfileUpdateSerializer(request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserProfileSerializer(_attach_own_follow_stats(user)).data)


class MeAvatarView(APIView):
    """POST /api/users/me/avatar 自分のアイコン画像を登録・上書きする。
    DELETE /api/users/me/avatar 自分のアイコン画像を削除する（基本設計書6.6章）。

    どちらもrequest.user自身が対象のため、IsOwner等のオブジェクトレベル権限は不要。
    """

    def post(self, request):
        serializer = AvatarUploadSerializer(request.user, data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        # S3の実削除はDBコミット確定後に行う（AvatarUploadSerializer.updateのコメント参照）
        delete_images_best_effort([user._removed_avatar_url])
        return Response(UserProfileSerializer(_attach_own_follow_stats(user)).data)

    def delete(self, request):
        # 未設定の場合も200でエラーにせず現在の状態を返す（基本設計書6.6章、冪等）。
        # 「登録済みなら消す」の判定・保存はUser.clear_avatar()に委ねる（ビューは薄く保つ）
        old_url = request.user.clear_avatar()
        delete_images_best_effort([old_url])
        return Response(UserProfileSerializer(_attach_own_follow_stats(request.user)).data)


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
