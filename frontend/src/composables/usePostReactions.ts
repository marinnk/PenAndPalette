import { apiClient } from '@/lib/apiClient'

// 基本設計書6.5章: いいね/かきたいのPOST/DELETEは冪等で常に200を返す。
// useTimeline・usePostDetailの両方から呼ばれるため、状態を持たない素の関数として切り出す
export async function setLiked(postId: number, liked: boolean) {
  const { data } = liked
    ? await apiClient.post<{ like_count: number; liked_by_me: boolean }>(
        `/api/posts/${postId}/likes`,
      )
    : await apiClient.delete<{ like_count: number; liked_by_me: boolean }>(
        `/api/posts/${postId}/likes`,
      )
  return data
}

export async function setWanted(postId: number, wanted: boolean) {
  const { data } = wanted
    ? await apiClient.post<{ want_count: number; wanted_by_me: boolean }>(
        `/api/posts/${postId}/wants`,
      )
    : await apiClient.delete<{ want_count: number; wanted_by_me: boolean }>(
        `/api/posts/${postId}/wants`,
      )
  return data
}
