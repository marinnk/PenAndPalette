<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import TimelineTabs from '@/components/TimelineTabs.vue'
import PostTypeTabs from '@/components/PostTypeTabs.vue'
import NewPostBanner from '@/components/NewPostBanner.vue'
import PostCard from '@/components/PostCard.vue'
import { useTimeline } from '@/composables/useTimeline'

// S03 タイムライン画面（画面設計書114〜145行目）。このコンポーネントはuseTimelineから
// 受け取った状態をどう表示するかにのみ専念する
const router = useRouter()
const {
  posts,
  loading,
  error,
  scope,
  postType,
  newPostCount,
  reactionError,
  isPending,
  deleteError,
  isDeleting,
  load,
  loadMore,
  revealNewPosts,
  toggleLike,
  toggleWant,
  deletePost,
  stopPolling,
} = useTimeline()

const sentinel = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function emptyMessage() {
  const typeLabel = postType.value === 'novel' ? '小説の' : 'イラストの'
  return scope.value === 'following'
    ? `フォロー中の利用者の${typeLabel}投稿がまだありません。`
    : `${typeLabel}投稿がまだありません。`
}

function handleReveal() {
  revealNewPosts()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(async () => {
  await load()
  observer = new IntersectionObserver((entries) => {
    if (entries[0]?.isIntersecting) {
      loadMore()
    }
  })
  if (sentinel.value) observer.observe(sentinel.value)
})

onUnmounted(() => {
  stopPolling()
  observer?.disconnect()
})

watch(scope, (newScope) => {
  load(newScope, postType.value)
})

watch(postType, (newPostType) => {
  load(scope.value, newPostType)
})
</script>

<template>
  <div>
    <AppHeader />
    <main class="timeline">
      <button
        type="button"
        class="form-submit timeline-compose-button"
        data-testid="compose-button"
        @click="router.push({ name: 'post-create' })"
      >
        投稿する
      </button>
      <p v-if="reactionError" class="field-error" data-testid="reaction-error">
        {{ reactionError }}
      </p>
      <p v-if="deleteError" class="field-error" data-testid="delete-error">
        {{ deleteError }}
      </p>
      <NewPostBanner :count="newPostCount" @reveal="handleReveal" />
      <TimelineTabs v-model="scope" />
      <PostTypeTabs v-model="postType" />

      <p v-if="loading" data-testid="timeline-loading">読み込み中...</p>
      <p v-else-if="error" class="field-error" data-testid="timeline-error">
        投稿の取得に失敗しました。
      </p>
      <p v-else-if="posts.length === 0" class="empty-state" data-testid="timeline-empty">
        {{ emptyMessage() }}
      </p>
      <!-- イラスト／小説どちらのタブも同じPostCardを単一列で並べる。タブによって変わるのは
      post_typeによる絞り込みだけで、見た目（画像枚数・並び方）は共通（画面設計書114〜167行目） -->
      <template v-else>
        <PostCard
          v-for="post in posts"
          :key="post.id"
          :post="post"
          :pending="isPending(post.id) || isDeleting(post.id)"
          @toggle-like="toggleLike"
          @toggle-want="toggleWant"
          @delete="deletePost"
        />
      </template>

      <div ref="sentinel" data-testid="timeline-sentinel"></div>
    </main>
  </div>
</template>
