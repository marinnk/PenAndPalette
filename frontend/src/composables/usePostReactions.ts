import { ref } from 'vue'
import type { Ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import type { Post } from '@/types/post'

// 基本設計書6.5章: いいね/かきたいのPOST/DELETEは冪等で常に200を返す。
// ネットワーク不調等でリクエスト自体が失敗した場合は例外を投げず null を返し、
// 呼び出し側（useReactablePosts・usePostDetail）がエラーメッセージの表示を判断できるようにする
export async function setLiked(postId: number, liked: boolean) {
  try {
    const { data } = liked
      ? await apiClient.post<{ like_count: number; liked_by_me: boolean }>(
          `/api/posts/${postId}/likes`,
        )
      : await apiClient.delete<{ like_count: number; liked_by_me: boolean }>(
          `/api/posts/${postId}/likes`,
        )
    return data
  } catch {
    return null
  }
}

export async function setWanted(postId: number, wanted: boolean) {
  try {
    const { data } = wanted
      ? await apiClient.post<{ want_count: number; wanted_by_me: boolean }>(
          `/api/posts/${postId}/wants`,
        )
      : await apiClient.delete<{ want_count: number; wanted_by_me: boolean }>(
          `/api/posts/${postId}/wants`,
        )
    return data
  } catch {
    return null
  }
}

/**
 * 投稿一覧（配列）に対するいいね/かきたいの反映ロジック。useTimeline・useProfileで共有する
 * （usePostDetailは単一投稿だけを保持するため、同じ考え方を個別に実装している）。
 *
 * - 失敗時はreactionErrorにメッセージを設定する（無反応のまま終わらせない）
 * - 同じ投稿への連打で二重にリクエストが飛ばないよう、投稿ごとの処理中状態をpendingIdsで管理する
 */
export function useReactablePosts(posts: Ref<Post[]>) {
  const reactionError = ref<string | null>(null)
  const pendingIds = ref<Set<number>>(new Set())

  function isPending(postId: number) {
    return pendingIds.value.has(postId)
  }

  function applyReaction(postId: number, patch: Partial<Post>) {
    const target = posts.value.find((p) => p.id === postId)
    if (target) Object.assign(target, patch)
  }

  async function toggleLike(post: Post) {
    if (isPending(post.id)) return
    pendingIds.value.add(post.id)
    reactionError.value = null
    try {
      const patch = await setLiked(post.id, !post.liked_by_me)
      if (!patch) {
        reactionError.value = 'いいねの更新に失敗しました。もう一度お試しください。'
        return
      }
      applyReaction(post.id, patch)
    } finally {
      pendingIds.value.delete(post.id)
    }
  }

  async function toggleWant(post: Post) {
    if (isPending(post.id)) return
    pendingIds.value.add(post.id)
    reactionError.value = null
    try {
      const patch = await setWanted(post.id, !post.wanted_by_me)
      if (!patch) {
        reactionError.value = 'かきたいの更新に失敗しました。もう一度お試しください。'
        return
      }
      applyReaction(post.id, patch)
    } finally {
      pendingIds.value.delete(post.id)
    }
  }

  return { reactionError, isPending, toggleLike, toggleWant }
}
