from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import BasePermission
from rest_framework.response import Response


class IsOwner(BasePermission):
    """対象オブジェクトのuserが自分自身であることを要求する（基本設計書6.3・6.4章の
    「他人の◯◯を指定した場合は403」の共通実装）。

    本プロジェクトは（DRFのジェネリックビューではなく）APIViewを使っているため
    get_object()が存在せず、has_object_permissionは自動実行されない。単体では
    check_object_permissions()の呼び出し忘れを防げないため、ビュー側では直接使わず
    下のget_owned_object_or_404()経由で使うこと。対象モデルはuser（FK）を持つことを
    前提とする（Post・将来のCommentなど）。
    """

    message = "自分以外の投稿を編集・削除することはできません。"

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id


def get_owned_object_or_404(view, request, queryset, **kwargs):
    """get_object_or_404で対象を取得すると同時に、必ずcheck_object_permissions()
    （IsOwner等のオブジェクトレベル権限）を検証する。

    IsOwnerはAPIViewにget_object()が無いため自動実行されず、各ビューメソッドで
    check_object_permissions()を個別に呼び出す必要があった。呼び出しを1箇所忘れても
    気づけない（views.pyがそのメソッドだけ他人のオブジェクトを操作できてしまう）弱点が
    あったため、取得と検証を1つの関数にまとめ、取得だけして検証を忘れることを防ぐ。
    """
    obj = get_object_or_404(queryset, **kwargs)
    view.check_object_permissions(request, obj)
    return obj


def get_other_user_or_400(request, user_model, user_id, *, self_target_message):
    """指定したuser_idの利用者をget_object_or_404で取得し、request.user自身を
    指定していないか検証する共通実装（users.views.FollowView・
    requests_app.views.UserRequestCreateViewの「自分自身は指定できない」チェック）。

    自分自身を指定した場合はDBのCHECK制約でも防がれるが、制約違反による500ではなく
    わかりやすい400を返すため、登録前にアプリケーション側でも判定する。戻り値は
    (target, error_response)のタプルで、呼び出し側は次の形でそのまま使う：
        target, error = get_other_user_or_400(request, User, user_id, self_target_message="...")
        if error:
            return error
    """
    target = get_object_or_404(user_model, pk=user_id)
    if target.id == request.user.id:
        return None, Response({"detail": self_target_message}, status=status.HTTP_400_BAD_REQUEST)
    return target, None
