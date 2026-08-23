from django.urls import path

from posts.views import PostDetailView, PostLikeView, PostListCreateView, PostWantView

urlpatterns = [
    path("posts", PostListCreateView.as_view(), name="post-list-create"),
    path("posts/<int:post_id>", PostDetailView.as_view(), name="post-detail"),
    path("posts/<int:post_id>/likes", PostLikeView.as_view(), name="post-likes"),
    path("posts/<int:post_id>/wants", PostWantView.as_view(), name="post-wants"),
]
