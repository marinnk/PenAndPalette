import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { setLiked, setWanted } from '@/composables/usePostReactions'
import type { Post } from '@/types/post'

// S05 投稿詳細画面（今回はコメント一覧・投稿UIを含まないスタブ）
export function usePostDetail() {
  const post = ref<Post | null>(null)
  const loading = ref(false)
  const error = ref(false)
  const reactionError = ref<string | null>(null)
  const reactionPending = ref(false)

  async function load(postId: number) {
    loading.value = true
    error.value = false
    try {
      const { data } = await apiClient.get<Post>(`/api/posts/${postId}`)
      post.value = data
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  async function toggleLike() {
    if (!post.value || reactionPending.value) return
    reactionPending.value = true
    reactionError.value = null
    try {
      const patch = await setLiked(post.value.id, !post.value.liked_by_me)
      if (!patch) {
        reactionError.value = 'いいねの更新に失敗しました。もう一度お試しください。'
        return
      }
      Object.assign(post.value, patch)
    } finally {
      reactionPending.value = false
    }
  }

  async function toggleWant() {
    if (!post.value || reactionPending.value) return
    reactionPending.value = true
    reactionError.value = null
    try {
      const patch = await setWanted(post.value.id, !post.value.wanted_by_me)
      if (!patch) {
        reactionError.value = 'かきたいの更新に失敗しました。もう一度お試しください。'
        return
      }
      Object.assign(post.value, patch)
    } finally {
      reactionPending.value = false
    }
  }

  return { post, loading, error, reactionError, reactionPending, load, toggleLike, toggleWant }
}
