import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { useReactablePosts } from '@/composables/usePostReactions'
import { useDeletablePosts } from '@/composables/usePostDelete'
import type { Post, PostListResponse } from '@/types/post'
import type { Profile } from '@/types/profile'

// S07 プロフィール画面（今回はフォロー数・フォローボタン等を含まないスタブ）
export function useProfile() {
  const profile = ref<Profile | null>(null)
  const posts = ref<Post[]>([])
  const loading = ref(false)
  const error = ref(false)

  const { reactionError, isPending, toggleLike, toggleWant } = useReactablePosts(posts)
  const { deleteError, isDeleting, deletePost } = useDeletablePosts(posts)

  async function load(userId: number) {
    loading.value = true
    error.value = false
    try {
      const [profileRes, postsRes] = await Promise.all([
        apiClient.get<Profile>(`/api/users/${userId}`),
        apiClient.get<PostListResponse>('/api/posts', { params: { user_id: userId } }),
      ])
      profile.value = profileRes.data
      posts.value = postsRes.data.results
    } catch {
      error.value = true
    } finally {
      loading.value = false
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
    load,
    toggleLike,
    toggleWant,
    deletePost,
  }
}
