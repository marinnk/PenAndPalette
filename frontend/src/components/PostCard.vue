<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { Post } from '@/types/post'

// S03/S07で共通利用する投稿カード（画面設計書126〜133行目）。
// いいね/かきたいのAPI呼び出しは持たず、親（TimelineView等）にemitで委ねる
const props = defineProps<{ post: Post }>()
const emit = defineEmits<{ 'toggle-like': [post: Post]; 'toggle-want': [post: Post] }>()

const router = useRouter()

const formattedDate = computed(() => props.post.created_at.slice(0, 10))

function goToDetail() {
  router.push({ name: 'post-detail', params: { id: props.post.id } })
}
</script>

<template>
  <article
    class="post-card"
    :data-testid="`post-card-${post.id}`"
    role="button"
    tabindex="0"
    @click="goToDetail"
    @keydown.enter="goToDetail"
  >
    <div class="post-card-header">
      <RouterLink
        :to="{ name: 'profile', params: { id: post.author.id } }"
        class="post-card-author"
        :data-testid="`author-link-${post.id}`"
        @click.stop
      >
        {{ post.author.display_name }}
      </RouterLink>
      <span class="post-card-meta">{{ formattedDate }}</span>
    </div>
    <p class="post-card-body">{{ post.body }}</p>
    <div class="post-card-actions">
      <button
        type="button"
        :class="{ active: post.liked_by_me }"
        :data-testid="`like-button-${post.id}`"
        @click.stop="emit('toggle-like', post)"
      >
        ♥ いいね {{ post.like_count }}
      </button>
      <button
        type="button"
        :class="{ active: post.wanted_by_me }"
        :data-testid="`want-button-${post.id}`"
        @click.stop="emit('toggle-want', post)"
      >
        ✏ かきたい {{ post.want_count }}
      </button>
      <span class="post-card-comment-count">💬 コメント {{ post.comment_count }}</span>
    </div>
  </article>
</template>
