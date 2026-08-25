import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import type { Profile } from '@/types/profile'

// 特定の利用者のプロフィール情報だけを取得する軽量なcomposable。GET /api/users/{id}を
// そのまま使うが、useProfile.tsと違い投稿一覧・フォロートグルは持たない。
// S06（RequestCreateView）が宛先の表示名だけを知りたい用途で使う
export function useUserLookup() {
  const user = ref<Profile | null>(null)
  const loading = ref(false)
  const error = ref(false)

  async function load(userId: number) {
    loading.value = true
    error.value = false
    try {
      const { data } = await apiClient.get<Profile>(`/api/users/${userId}`)
      user.value = data
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { user, loading, error, load }
}
