<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '@/components/AppHeader.vue'
import BackLink from '@/components/BackLink.vue'
import CommentComposeForm from '@/components/CommentComposeForm.vue'
import CommentList from '@/components/CommentList.vue'
import PostCard from '@/components/PostCard.vue'
import { usePostDetail } from '@/composables/usePostDetail'
import { useComments } from '@/composables/useComments'

// S05 投稿詳細画面
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
  syncCommentCount,
} = usePostDetail()
const {
  comments,
  loading: commentsLoading,
  error: commentsError,
  composeContent,
  composeImagePreview,
  composeImageError,
  submitting,
  fieldErrors,
  composeError,
  actionError,
  isPending,
  fetchComments,
  addComposeImage,
  removeComposeImage,
  submitComment,
  updateComment,
  removeComment,
} = useComments()

async function handleDelete() {
  if (await deletePost()) {
    router.push({ name: 'timeline' })
  }
}

async function handleCommentSubmit() {
  // 一覧の再取得はせず、その場でPostCard側の💬件数だけ更新する（useTimelineのいいね/
  // かきたい同様、既存のusePostDetailと同じ「レスポンスをその場で反映する」方針に揃える）。
  // commentsは既にcomments.value.pushで最新件数になっているため、それをそのまま反映する
  // （+1/-1を個別に数えると、他タブでの変更等とcomment_countがずれうる）
  if (await submitComment(Number(props.id))) {
    syncCommentCount(comments.value.length)
  }
}

async function handleCommentDelete(id: number) {
  if (await removeComment(id)) {
    syncCommentCount(comments.value.length)
  }
}

// 投稿とコメント一覧は互いの結果に依存しないため、並行して取得する
async function loadAll(id: number) {
  await Promise.all([load(id), fetchComments(id)])
}

onMounted(() => loadAll(Number(props.id)))
// 同じルート（/posts/:id）内で別の投稿idへ遷移した場合、Vue Routerはコンポーネント
// インスタンスを使い回しonMountedが再実行されないため、idの変化を監視して再読み込みする
// （ProfileView.vueと同じパターン）
watch(
  () => props.id,
  (id) => loadAll(Number(id)),
)
</script>

<template>
  <div>
    <AppHeader />
    <main class="post-detail">
      <BackLink :to="{ name: 'timeline' }" label="← タイムラインに戻る" testid="back-to-timeline" />

      <!-- 投稿本体とコメント一覧は並行して取得するため、両方が揃うまでは「読み込み中」の
      ままにする（投稿だけ先に表示すると、直前に見ていた別の投稿のコメントが一瞬映る恐れがある） -->
      <p v-if="loading || commentsLoading" data-testid="post-detail-loading">読み込み中...</p>
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

        <p v-if="commentsError" class="field-error" data-testid="comments-fetch-error">
          {{ commentsError }}
        </p>
        <p v-if="actionError" class="field-error" data-testid="comment-error">
          {{ actionError }}
        </p>
        <CommentList
          :comments="comments"
          :is-pending="isPending"
          :update-comment="updateComment"
          @delete="handleCommentDelete"
        />
        <CommentComposeForm
          :content="composeContent"
          :image-preview="composeImagePreview"
          :submitting="submitting"
          :field-errors="fieldErrors"
          :error-message="composeError"
          :image-pick-error="composeImageError"
          @update:content="composeContent = $event"
          @add-image="addComposeImage"
          @remove-image="removeComposeImage"
          @submit="handleCommentSubmit"
        />
      </template>
    </main>
  </div>
</template>
