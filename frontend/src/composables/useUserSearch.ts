import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import { createLatestRequest } from '@/lib/latestRequest'
import type { AuthUser } from '@/types/auth'

// S09 ユーザー検索画面。基本設計書6.8章のGET /api/users/?qは
// キーワード未入力時に呼び出さない（機能仕様書F-9の「キーワードが未入力→検索を実行しない」）。
// hasSearchedは「まだ一度も検索していない（初期表示）」と「検索したが0件だった」を
// 区別するためだけに持つ。区別しないと画面を開いた直後に「該当なし」と誤表示してしまう
export function useUserSearch() {
  const keyword = ref('')
  const users = ref<AuthUser[]>([])
  const loading = ref(false)
  const error = ref(false)
  const hasSearched = ref(false)

  // search呼び出しの世代トークン。キーワードを変えて短時間に連続検索したとき、
  // 先に始まった検索の応答が後から届いて新しいキーワードの結果を上書きするのを防ぐ
  const latestSearch = createLatestRequest()

  async function search() {
    error.value = false
    const trimmed = keyword.value.trim()
    if (!trimmed) return
    const token = latestSearch.begin()
    hasSearched.value = true
    loading.value = true
    try {
      const { data } = await apiClient.get<AuthUser[]>('/api/users/', { params: { q: trimmed } })
      if (token.isStale()) return
      users.value = data
    } catch {
      if (token.isStale()) return
      error.value = true
    } finally {
      if (!token.isStale()) loading.value = false
    }
  }

  return { keyword, users, loading, error, hasSearched, search }
}
