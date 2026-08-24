import { ref } from 'vue'
import type { Ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { extractDetail } from '@/lib/apiError'
import type { Post } from '@/types/post'

// usePostDetail.ts（単一投稿、配列を持たない）向け。setLiked/setWantedと同じく
// 例外を投げずbooleanで返す
export async function deletePostById(postId: number): Promise<boolean> {
  try {
    await apiClient.delete(`/api/posts/${postId}`)
    return true
  } catch {
    return false
  }
}

/**
 * 投稿一覧（配列）に対する削除の反映ロジック。useTimeline・useProfileで共有する
 * （usePostReactions.tsのuseReactablePostsと同じ形）。
 *
 * - 失敗時はdeleteErrorにメッセージを設定する
 * - 同じ投稿への連打で二重にリクエストが飛ばないよう、投稿ごとの処理中状態をpendingIdsで管理する
 * - 成功時は一覧の再取得をせず、その場でposts配列から取り除く
 */
export function useDeletablePosts(posts: Ref<Post[]>) {
  const deleteError = ref<string | null>(null)
  const pendingIds = ref<Set<number>>(new Set())

  function isDeleting(postId: number) {
    return pendingIds.value.has(postId)
  }

  async function deletePost(post: Post) {
    if (isDeleting(post.id)) return
    pendingIds.value.add(post.id)
    deleteError.value = null
    try {
      await apiClient.delete(`/api/posts/${post.id}`)
      posts.value = posts.value.filter((p) => p.id !== post.id)
    } catch (err) {
      deleteError.value = extractDetail(err) ?? '削除に失敗しました。もう一度お試しください。'
    } finally {
      pendingIds.value.delete(post.id)
    }
  }

  return { deleteError, isDeleting, deletePost }
}
