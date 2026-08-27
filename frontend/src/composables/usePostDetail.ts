import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { createLatestRequest } from '@/lib/latestRequest'
import { setLiked, setWanted } from '@/composables/usePostReactions'
import { deletePostById } from '@/composables/usePostDelete'
import type { Post } from '@/types/post'

// S05 投稿詳細画面
export function usePostDetail() {
  const post = ref<Post | null>(null)
  const loading = ref(false)
  const error = ref(false)
  const reactionError = ref<string | null>(null)
  const reactionPending = ref(false)
  const deleteError = ref<string | null>(null)
  const deleting = ref(false)
  // load呼び出しの世代トークン。useComments.fetchCommentsと同じ理由で、投稿間を
  // 素早く行き来した際に古い応答が新しい投稿の表示を上書きしないようにする
  const latestLoad = createLatestRequest()

  async function load(postId: number) {
    const token = latestLoad.begin()
    loading.value = true
    error.value = false
    deleteError.value = null
    try {
      const { data } = await apiClient.get<Post>(`/api/posts/${postId}`)
      if (token.isStale()) return
      post.value = data
    } catch {
      if (token.isStale()) return
      error.value = true
    } finally {
      if (!token.isStale()) loading.value = false
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

  async function deletePost(): Promise<boolean> {
    if (!post.value || deleting.value) return false
    deleting.value = true
    deleteError.value = null
    try {
      const ok = await deletePostById(post.value.id)
      if (!ok) deleteError.value = '削除に失敗しました。もう一度お試しください。'
      return ok
    } finally {
      deleting.value = false
    }
  }

  // コメントの投稿・削除後、postを直接いじるのはPostDetailView側ではなくここに集約する
  // （postを保持・変更する責務はこのcomposableに閉じ込め、いいね/かきたいと同じ扱いにする）。
  // コメント一覧（useComments）のcomments.length自体が既に正しい件数なので、増減を
  // 個別に計算せず、呼び出し側から渡された最新件数をそのまま反映するだけにする
  function syncCommentCount(count: number) {
    if (post.value) post.value.comment_count = count
  }

  return {
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
  }
}
