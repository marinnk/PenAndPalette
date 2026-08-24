from rest_framework.permissions import BasePermission


class IsOwner(BasePermission):
    """対象オブジェクトのuserが自分自身であることを要求する（基本設計書6.3・6.4章の
    「他人の◯◯を指定した場合は403」の共通実装）。

    本プロジェクトは（DRFのジェネリックビューではなく）APIViewを使っているため
    get_object()が存在せず、has_object_permissionは自動実行されない。ビュー側で
    self.check_object_permissions(request, obj)を明示的に呼び出して使うこと
    （posts/views.pyのPostDetailView.put/delete参照）。対象モデルはuser（FK）を
    持つことを前提とする（Post・将来のCommentなど）。
    """

    message = "自分以外の投稿を編集・削除することはできません。"

    def has_object_permission(self, request, view, obj):
        return obj.user_id == request.user.id
