<script setup lang="ts">
import CommentListItem from '@/components/CommentListItem.vue'
import type { Comment } from '@/types/comment'

// S05 投稿詳細画面のコメント一覧（画面設計書182〜185行目）。表示のみを担い、
// 実際のAPI呼び出しは親（PostDetailView）がuseComments経由で行う。
//
// updateCommentは関数プロパティとして各CommentListItemにそのまま橋渡しする
// （comment.idを束縛するだけ）：CommentListItem自身が保存の成否に応じて編集モードの
// 終了を判断する必要があるため、fire-and-forgetなemitではなく戻り値を待てる形にしている
defineProps<{
  comments: Comment[]
  isPending: (id: number) => boolean
  updateComment: (
    id: number,
    payload: { content: string; image?: File; removeImage?: boolean },
  ) => Promise<Comment | null>
}>()
const emit = defineEmits<{
  delete: [id: number]
}>()
</script>

<template>
  <section class="comment-list" data-testid="comment-list">
    <h2>コメント（{{ comments.length }}件）</h2>
    <ul v-if="comments.length > 0" class="comment-list-items">
      <CommentListItem
        v-for="comment in comments"
        :key="comment.id"
        :comment="comment"
        :pending="isPending(comment.id)"
        :update-comment="(payload) => updateComment(comment.id, payload)"
        @delete="emit('delete', comment.id)"
      />
    </ul>
    <p v-else class="comment-list-empty" data-testid="comment-list-empty">
      まだコメントはありません。
    </p>
  </section>
</template>
