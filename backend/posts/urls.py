from django.urls import path

from posts.views import (
    CommentDetailView,
    PostCommentListCreateView,
    PostDetailView,
    PostLikeView,
    PostListCreateView,
    PostWantView,
    TagListView,
)

urlpatterns = [
    path("posts", PostListCreateView.as_view(), name="post-list-create"),
    path("posts/<int:post_id>", PostDetailView.as_view(), name="post-detail"),
    path("posts/<int:post_id>/likes", PostLikeView.as_view(), name="post-likes"),
    path("posts/<int:post_id>/wants", PostWantView.as_view(), name="post-wants"),
    path(
        "posts/<int:post_id>/comments",
        PostCommentListCreateView.as_view(),
        name="post-comments",
    ),
    path("comments/<int:comment_id>", CommentDetailView.as_view(), name="comment-detail"),
    path("tags", TagListView.as_view(), name="tag-list"),
]
