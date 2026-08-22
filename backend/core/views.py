from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthCheckView(APIView):
    """開発環境セットアップ時点での起動確認用エンドポイント。

    認証・DB接続を必要とせず、backendプロセスが起動していることだけを確認する。
    """

    permission_classes = [AllowAny]

    def get(self, request):
        return Response({"status": "ok"})
