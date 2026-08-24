<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import PostCard from '@/components/PostCard.vue'
import { usePostDetail } from '@/composables/usePostDetail'

// S05 投稿詳細画面（今回はコメント一覧・投稿UIを含まないスタブ）
const props = defineProps<{ id: string }>()
const router = useRouter()
const {
  post,
  loading,
  error,
  reactionError,
  reactionPending,
  deleteError,
  deleting,
  load,
  toggleLike,
  toggleWant,
  deletePost,
} = usePostDetail()

async function handleDelete() {
  if (await deletePost()) {
    router.push({ name: 'timeline' })
  }
}

onMounted(() => load(Number(props.id)))
// 同じルート（/posts/:id）内で別の投稿idへ遷移した場合、Vue Routerはコンポーネント
// インスタンスを使い回しonMountedが再実行されないため、idの変化を監視して再読み込みする
// （ProfileView.vueと同じパターン）
watch(
  () => props.id,
  (id) => load(Number(id)),
)
</script>

<template>
  <div>
    <AppHeader />
    <main class="post-detail">
      <button
        type="button"
        data-testid="back-to-timeline"
        @click="router.push({ name: 'timeline' })"
      >
        ← タイムラインに戻る
      </button>

      <p v-if="loading" data-testid="post-detail-loading">読み込み中...</p>
      <p v-else-if="error || !post" class="field-error" data-testid="post-detail-error">
        投稿が見つかりませんでした。
      </p>
      <template v-else>
        <p v-if="reactionError" class="field-error" data-testid="reaction-error">
          {{ reactionError }}
        </p>
        <p v-if="deleteError" class="field-error" data-testid="delete-error">
          {{ deleteError }}
        </p>
        <!-- clickable=false: 詳細画面自身への遷移（同じ投稿への無駄な再ナビゲーション）を避ける -->
        <PostCard
          :post="post"
          :clickable="false"
          :pending="reactionPending || deleting"
          @toggle-like="toggleLike"
          @toggle-want="toggleWant"
          @delete="handleDelete"
        />
      </template>
    </main>
  </div>
</template>
