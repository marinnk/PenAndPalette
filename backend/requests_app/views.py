from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

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
        target = get_object_or_404(User, pk=user_id)
        if target.id == request.user.id:
            return Response(
                {"detail": "自分自身にリクエストを送ることはできません。"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = RequestCreateSerializer(
            data=request.data, context={"request": request, "to_user": target}
        )
        serializer.is_valid(raise_exception=True)
        created = serializer.save()
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
