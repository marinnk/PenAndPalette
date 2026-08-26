from django.contrib import admin

from posts.models import Comment, Like, Post, PostImage, Tag, Want


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    """開発時にDBの中身を確認するための最小限の登録。"""

    list_display = ["id", "user", "post_type", "title", "body", "created_at"]
    search_fields = ["title", "body"]


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ["id", "name", "display_order"]


@admin.register(PostImage)
class PostImageAdmin(admin.ModelAdmin):
    list_display = ["id", "post", "display_order", "image_url"]


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ["id", "post", "user", "created_at"]


@admin.register(Want)
class WantAdmin(admin.ModelAdmin):
    list_display = ["id", "post", "user", "created_at"]


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ["id", "post", "user", "content", "created_at"]
    search_fields = ["content"]
