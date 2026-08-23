import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { setLiked, setWanted } from '@/composables/usePostReactions'
import type { Post, PostListResponse } from '@/types/post'
import type { Profile } from '@/types/profile'

// S07 プロフィール画面（今回はフォロー数・フォローボタン等を含まないスタブ）
export function useProfile() {
  const profile = ref<Profile | null>(null)
  const posts = ref<Post[]>([])
  const loading = ref(false)
  const error = ref(false)

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

  function applyReaction(postId: number, patch: Partial<Post>) {
    const target = posts.value.find((p) => p.id === postId)
    if (target) Object.assign(target, patch)
  }

  async function toggleLike(post: Post) {
    const patch = await setLiked(post.id, !post.liked_by_me)
    applyReaction(post.id, patch)
  }

  async function toggleWant(post: Post) {
    const patch = await setWanted(post.id, !post.wanted_by_me)
    applyReaction(post.id, patch)
  }

  return { profile, posts, loading, error, load, toggleLike, toggleWant }
}
