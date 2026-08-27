import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { createLatestRequest } from '@/lib/latestRequest'
import { useReactablePosts } from '@/composables/usePostReactions'
import { useDeletablePosts } from '@/composables/usePostDelete'
import type { Post, PostListResponse } from '@/types/post'
import type { Profile } from '@/types/profile'

// S07 プロフィール画面
export function useProfile() {
  const profile = ref<Profile | null>(null)
  const posts = ref<Post[]>([])
  const loading = ref(false)
  const error = ref(false)
  const followError = ref<string | null>(null)
  const followPending = ref(false)

  const { reactionError, isPending, toggleLike, toggleWant } = useReactablePosts(posts)
  const { deleteError, isDeleting, deletePost } = useDeletablePosts(posts)

  // load呼び出しの世代トークン。Vue Routerは/users/:id内の別idへの遷移でコンポーネント
  // インスタンスを使い回すため、プロフィール間を素早く行き来すると先に始まったloadの
  // 応答が後から届いて別ユーザーの表示を上書きしうる。それを防ぐ（useComments等と同じ）
  const latestLoad = createLatestRequest()

  async function load(userId: number) {
    const token = latestLoad.begin()
    loading.value = true
    error.value = false
    deleteError.value = null
    followError.value = null
    try {
      const [profileRes, postsRes] = await Promise.all([
        apiClient.get<Profile>(`/api/users/${userId}`),
        apiClient.get<PostListResponse>('/api/posts', { params: { user_id: userId } }),
      ])
      if (token.isStale()) return
      profile.value = profileRes.data
      posts.value = postsRes.data.results
    } catch {
      if (token.isStale()) return
      error.value = true
    } finally {
      if (!token.isStale()) loading.value = false
    }
  }

  // 基本設計書6.6章: フォロー/フォロー解除のPOST/DELETEは冪等で常に200を返し、
  // {followed_by_me, follower_count}を返す。usePostReactions.setLikedと同じ形の楽観更新
  async function toggleFollow() {
    if (!profile.value || followPending.value) return
    const target = profile.value
    followPending.value = true
    followError.value = null
    try {
      const { data } = target.followed_by_me
        ? await apiClient.delete<{ followed_by_me: boolean; follower_count: number }>(
            `/api/users/${target.id}/follow`,
          )
        : await apiClient.post<{ followed_by_me: boolean; follower_count: number }>(
            `/api/users/${target.id}/follow`,
          )
      Object.assign(target, data)
    } catch {
      followError.value = 'フォローの更新に失敗しました。もう一度お試しください。'
    } finally {
      followPending.value = false
    }
  }

  return {
    profile,
    posts,
    loading,
    error,
    reactionError,
    isPending,
    deleteError,
    isDeleting,
    followError,
    followPending,
    load,
    toggleLike,
    toggleWant,
    deletePost,
    toggleFollow,
  }
}
