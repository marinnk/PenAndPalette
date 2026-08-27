import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { createLatestRequest } from '@/lib/latestRequest'
import type { AuthUser } from '@/types/auth'

export type FollowListTab = 'following' | 'followers'

// S10 フォロー中／フォロワー一覧画面。基本設計書6.6章の
// GET /api/users/{id}/following・/followersはページネーション無しで全件返す
export function useFollowList() {
  const activeTab = ref<FollowListTab>('followers')
  const users = ref<AuthUser[]>([])
  const loading = ref(false)
  const error = ref(false)

  // load呼び出しの世代トークン。フォロワー⇔フォロー中のタブや別ユーザーの一覧を
  // 素早く切り替えたとき、先に始まったloadの応答が後から届いて上書きするのを防ぐ
  const latestLoad = createLatestRequest()

  async function load(userId: number, tab: FollowListTab) {
    const token = latestLoad.begin()
    activeTab.value = tab
    loading.value = true
    error.value = false
    try {
      const { data } = await apiClient.get<AuthUser[]>(`/api/users/${userId}/${tab}`)
      if (token.isStale()) return
      users.value = data
    } catch {
      if (token.isStale()) return
      error.value = true
    } finally {
      if (!token.isStale()) loading.value = false
    }
  }

  return { activeTab, users, loading, error, load }
}
