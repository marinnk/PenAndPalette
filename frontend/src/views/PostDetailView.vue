<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePostDetail } from '@/composables/usePostDetail'

// S05 投稿詳細画面（今回はコメント一覧・投稿UIを含まないスタブ）
const props = defineProps<{ id: string }>()
const router = useRouter()
const { post, loading, error, load, toggleLike, toggleWant } = usePostDetail()

onMounted(() => load(Number(props.id)))
</script>

<template>
  <main class="post-detail">
    <button type="button" data-testid="back-to-timeline" @click="router.push({ name: 'timeline' })">
      ← タイムラインに戻る
    </button>

    <p v-if="loading" data-testid="post-detail-loading">読み込み中...</p>
    <p v-else-if="error || !post" class="field-error" data-testid="post-detail-error">
      投稿が見つかりませんでした。
    </p>
    <article v-else class="post-card">
      <div class="post-card-header">
        <RouterLink
          :to="{ name: 'profile', params: { id: post.author.id } }"
          class="post-card-author"
        >
          {{ post.author.display_name }}
        </RouterLink>
        <span class="post-card-meta">{{ post.created_at.slice(0, 10) }}</span>
      </div>
      <p class="post-card-body">{{ post.body }}</p>
      <div class="post-card-actions">
        <button
          type="button"
          :class="{ active: post.liked_by_me }"
          data-testid="post-detail-like-button"
          @click="toggleLike"
        >
          ♥ いいね {{ post.like_count }}
        </button>
        <button
          type="button"
          :class="{ active: post.wanted_by_me }"
          data-testid="post-detail-want-button"
          @click="toggleWant"
        >
          ✏ かきたい {{ post.want_count }}
        </button>
        <span class="post-card-comment-count">💬 コメント {{ post.comment_count }}</span>
      </div>
    </article>
  </main>
</template>
