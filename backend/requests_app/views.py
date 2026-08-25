from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import get_other_user_or_400
from requests_app.models import Request
from requests_app.serializers import RequestCreateSerializer, RequestSerializer
from users.models import User


class UserRequestCreateView(APIView):
    """POST /api/users/{user_id}/requests 指定した利用者にリクエストを送る（基本設計書6.7章）。

    自分自身へのリクエストはrequestsテーブルのCHECK制約でも防がれるが、制約違反による
    500ではなく利用者にわかりやすい400を返すため、登録前にアプリケーション側でも判定する
    （users.views.FollowViewの自己フォローチェックと同じ方針）。
    """

    def post(self, request, user_id):
        target, error = get_other_user_or_400(
            request,
            User,
            user_id,
            self_target_message="自分自身にリクエストを送ることはできません。",
        )
        if error:
            return error
        serializer = RequestCreateSerializer(
            data=request.data, context={"request": request, "to_user": target}
        )
        serializer.is_valid(raise_exception=True)
        created = serializer.save()
        # 作成直後のレスポンスもrelated_post.user・related_post.imagesを含むため、
        # ReceivedRequestListViewと同じselect_related/prefetch_relatedを付けて
        # N+1を避けるために1件だけ取得し直す
        created = (
            Request.objects.select_related("from_user", "related_post", "related_post__user")
            .prefetch_related("related_post__images")
            .get(pk=created.pk)
        )
        return Response(RequestSerializer(created).data, status=status.HTTP_201_CREATED)


class ReceivedRequestListView(APIView):
    """GET /api/requests/received 自分宛てに届いたリクエスト一覧を取得する（基本設計書6.7章）。

    学習規模のデータ量を前提にページネーションは設けない（FollowersListViewと同方針）。
    """

    def get(self, request):
        received = Request.objects.received_by(request.user).prefetch_related(
            "related_post__images"
        )
        return Response(RequestSerializer(received, many=True).data)
