import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import type { AuthUser } from '@/types/auth'

export type FollowListTab = 'following' | 'followers'

// S10 フォロー中／フォロワー一覧画面。基本設計書6.6章の
// GET /api/users/{id}/following・/followersはページネーション無しで全件返す
export function useFollowList() {
  const activeTab = ref<FollowListTab>('followers')
  const users = ref<AuthUser[]>([])
  const loading = ref(false)
  const error = ref(false)

  async function load(userId: number, tab: FollowListTab) {
    activeTab.value = tab
    loading.value = true
    error.value = false
    try {
      const { data } = await apiClient.get<AuthUser[]>(`/api/users/${userId}/${tab}`)
      users.value = data
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { activeTab, users, loading, error, load }
}
