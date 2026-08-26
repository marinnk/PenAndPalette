from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from common.permissions import IsOwner, get_owned_object_or_404
from common.storage import delete_images_best_effort
from posts.models import Comment, Like, Post, Want
from posts.serializers import (
    CommentCreateSerializer,
    CommentSerializer,
    CommentUpdateSerializer,
    LikeReactionSerializer,
    PostCreateSerializer,
    PostListQuerySerializer,
    PostSerializer,
    PostUpdateSerializer,
    WantReactionSerializer,
)


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
        # 作成直後の投稿はいいね/かきたいが0件・自分の反応も無いことが自明なため、
        # with_reactions()での再クエリ（Count/Existsの集計、JOIN）は行わず既知の初期値を設定する。
        # post.userはserializer.save()内でrequest.userをそのまま渡しているため、
        # 再取得しなくてもauthorのシリアライズに追加クエリは発生しない
        post.like_count = 0
        post.want_count = 0
        post.comment_count = 0
        post.liked_by_me = False
        post.wanted_by_me = False
        return Response(PostSerializer(post).data, status=status.HTTP_201_CREATED)


class PostDetailView(APIView):
    """GET /api/posts/{post_id} 投稿の詳細を取得する。
    PUT /api/posts/{post_id} 自分の投稿を編集する。
    DELETE /api/posts/{post_id} 自分の投稿を削除する（基本設計書6.3章）。

    permission_classesはPUT/DELETEでのみ意味を持つ。IsOwner.has_permission（未オーバーライド）
    はデフォルトTrueのため、GETの挙動（IsAuthenticatedのみ）は変わらない。put/deleteは
    common.permissions.get_owned_object_or_404()経由でオブジェクトを取得し、
    IsOwnerのオブジェクトレベル判定を必ず行う（取得と検証を分けると呼び忘れうるため）。
    """

    permission_classes = [IsAuthenticated, IsOwner]

    def get(self, request, post_id):
        # GETは全員が対象（IsOwnerのオブジェクトレベル判定はここでは呼ばない）
        post = get_object_or_404(Post.objects.with_reactions(request.user), pk=post_id)
        return Response(PostSerializer(post).data)

    def put(self, request, post_id):
        post = get_owned_object_or_404(self, request, Post, pk=post_id)
        serializer = PostUpdateSerializer(post, data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        post = serializer.save()
        # S3の実削除はDBコミット確定後に行う（PostUpdateSerializer.updateのコメント参照）
        delete_images_best_effort(post._removed_image_urls)
        post = _reload_with_reactions(post.id, request.user)
        return Response(PostSerializer(post).data)

    def delete(self, request, post_id):
        post = get_owned_object_or_404(self, request, Post, pk=post_id)
        # post.delete()の前にURLを収集しておく必要がある（削除後はpost.images・
        # post.commentsを辿れない）
        image_urls = list(post.images.values_list("image_url", flat=True))
        comment_image_urls = list(
            post.comments.exclude(image_url__isnull=True).values_list("image_url", flat=True)
        )
        # comments・likes・wants・post_imagesはON DELETE CASCADEで自動的に削除される。
        # ただしS3上の実ファイル（投稿画像・コメント画像）はCASCADEでは消えないため、
        # 下でアプリケーション側から明示的に削除する
        post.delete()
        delete_images_best_effort(image_urls + comment_image_urls)
        return Response(status=status.HTTP_204_NO_CONTENT)


def _reload_with_reactions(post_id, viewer):
    """POST/DELETE直後の最新状態を1件だけ再取得する（いいね/かきたいAPI共通）。"""
    return Post.objects.with_reactions(viewer).get(pk=post_id)


class PostLikeView(APIView):
    """POST/DELETE /api/posts/{post_id}/likes いいねの登録/解除（基本設計書6.5章）。

    UNIQUE制約(post_id, user_id)に対応する冪等な2エンドポイント。既に付与/未付与の状態への
    呼び出しもエラーにせず、常に200で現在の状態を返す。レスポンスの整形はLikeReactionSerializer
    （出力の整形はシリアライザに分離する規約）に委ねる。
    """

    def post(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        Like.objects.add(post, request.user)
        return Response(LikeReactionSerializer(_reload_with_reactions(post_id, request.user)).data)

    def delete(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        Like.objects.remove(post, request.user)
        return Response(LikeReactionSerializer(_reload_with_reactions(post_id, request.user)).data)


class PostWantView(APIView):
    """POST/DELETE /api/posts/{post_id}/wants かきたいの登録/解除（基本設計書6.5章）。"""

    def post(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        Want.objects.add(post, request.user)
        return Response(WantReactionSerializer(_reload_with_reactions(post_id, request.user)).data)

    def delete(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        Want.objects.remove(post, request.user)
        return Response(WantReactionSerializer(_reload_with_reactions(post_id, request.user)).data)


class PostCommentListCreateView(APIView):
    """GET /api/posts/{post_id}/comments コメント一覧を取得する。
    POST /api/posts/{post_id}/comments コメントを投稿する（基本設計書6.4章）。

    投稿者本人以外の利用者もコメントできるため、ログインしていれば誰でも呼べる
    （IsOwnerによる所有者チェックはここでは行わない。CommentDetailView参照）。
    """

    def get(self, request, post_id):
        get_object_or_404(Post, pk=post_id)
        comments = Comment.objects.list_for_post(post_id)
        return Response(CommentSerializer(comments, many=True).data)

    def post(self, request, post_id):
        post = get_object_or_404(Post, pk=post_id)
        serializer = CommentCreateSerializer(
            data=request.data, context={"request": request, "post": post}
        )
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        return Response(CommentSerializer(comment).data, status=status.HTTP_201_CREATED)


class CommentDetailView(APIView):
    """PUT /api/comments/{comment_id} 自分のコメントを編集する。
    DELETE /api/comments/{comment_id} 自分のコメントを削除する（基本設計書6.4章）。
    """

    permission_classes = [IsAuthenticated, IsOwner]

    def put(self, request, comment_id):
        comment = get_owned_object_or_404(self, request, Comment, pk=comment_id)
        serializer = CommentUpdateSerializer(comment, data=request.data)
        serializer.is_valid(raise_exception=True)
        comment = serializer.save()
        # S3の実削除はDBコミット確定後に行う（CommentUpdateSerializer.updateのコメント参照）
        delete_images_best_effort([comment._removed_image_url])
        return Response(CommentSerializer(comment).data)

    def delete(self, request, comment_id):
        comment = get_owned_object_or_404(self, request, Comment, pk=comment_id)
        image_url = comment.image_url
        comment.delete()
        delete_images_best_effort([image_url])
        return Response(status=status.HTTP_204_NO_CONTENT)
