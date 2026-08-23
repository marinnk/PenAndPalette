from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from posts.models import Like, Post, Want
from posts.serializers import PostCreateSerializer, PostListQuerySerializer, PostSerializer


class PostListCreateView(APIView):
    """GET /api/posts 投稿一覧を取得する。POST /api/posts 投稿を作成する（基本設計書6.3章）。"""

    def get(self, request):
        query = PostListQuerySerializer(data=request.query_params)
        query.is_valid(raise_exception=True)
        posts, has_more = Post.objects.list_for_timeline(request.user, **query.validated_data)
        return Response({"results": PostSerializer(posts, many=True).data, "has_more": has_more})

    def post(self, request):
        serializer = PostCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        post = serializer.save()
        post = Post.objects.with_reactions(request.user).get(pk=post.pk)
        return Response(PostSerializer(post).data, status=status.HTTP_201_CREATED)


class PostDetailView(APIView):
    """GET /api/posts/{post_id} 投稿の詳細を取得する。

    編集・削除（PUT/DELETE）は今回のスコープ外（投稿編集Issueで追加する）。
    """

    def get(self, request, post_id):
        post = get_object_or_404(Post.objects.with_reactions(request.user), pk=post_id)
        return Response(PostSerializer(post).data)


def _reaction_payload(post_id, viewer, kind):
    """いいね/かきたいAPI共通のレスポンス整形。POST/DELETE直後の最新状態を1件だけ再取得する。"""
    post = Post.objects.with_reactions(viewer).get(pk=post_id)
    if kind == "like":
        return {"like_count": post.like_count, "liked_by_me": post.liked_by_me}
    return {"want_count": post.want_count, "wanted_by_me": post.wanted_by_me}


class PostLikeView(APIView):
    """POST/DELETE /api/posts/{post_id}/likes いいねの登録/解除（基本設計書6.5章）。

    UNIQUE制約(post_id, user_id)に対応する冪等な2エンドポイント。既に付与/未付与の状態への
    呼び出しもエラーにせず、常に200で現在の状態を返す。
    """

    def post(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        Like.objects.add(post, request.user)
        return Response(_reaction_payload(post_id, request.user, "like"))

    def delete(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        Like.objects.remove(post, request.user)
        return Response(_reaction_payload(post_id, request.user, "like"))


class PostWantView(APIView):
    """POST/DELETE /api/posts/{post_id}/wants かきたいの登録/解除（基本設計書6.5章）。"""

    def post(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        Want.objects.add(post, request.user)
        return Response(_reaction_payload(post_id, request.user, "want"))

    def delete(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        Want.objects.remove(post, request.user)
        return Response(_reaction_payload(post_id, request.user, "want"))
