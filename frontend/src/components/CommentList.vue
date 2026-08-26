<script setup lang="ts">
import CommentListItem from '@/components/CommentListItem.vue'
import type { Comment } from '@/types/comment'

// S05 投稿詳細画面のコメント一覧（画面設計書182〜185行目）。表示のみを担い、
// 実際のAPI呼び出しは親（PostDetailView）がuseComments経由で行う
defineProps<{ comments: Comment[]; isPending: (id: number) => boolean }>()
const emit = defineEmits<{
  update: [id: number, payload: { content: string; image?: File; removeImage?: boolean }]
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
        @update="(payload) => emit('update', comment.id, payload)"
        @delete="emit('delete', comment.id)"
      />
    </ul>
    <p v-else class="comment-list-empty" data-testid="comment-list-empty">
      まだコメントはありません。
    </p>
  </section>
</template>
