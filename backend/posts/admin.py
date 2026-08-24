from django.contrib import admin

from posts.models import Like, Post, Want


@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    """開発時にDBの中身を確認するための最小限の登録。"""

    list_display = ["id", "user", "body", "created_at"]
    search_fields = ["body"]


@admin.register(Like)
class LikeAdmin(admin.ModelAdmin):
    list_display = ["id", "post", "user", "created_at"]


@admin.register(Want)
class WantAdmin(admin.ModelAdmin):
    list_display = ["id", "post", "user", "created_at"]
