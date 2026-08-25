import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'
import type { RequestItem } from '@/types/request'

// S07 プロフィール画面（自分の場合のみ）: 届いたリクエスト一覧。
// 基本設計書6.7・6.9章の通りページネーション無しで全件取得する
export function useReceivedRequests() {
  const receivedRequests = ref<RequestItem[]>([])
  const loading = ref(false)
  const error = ref(false)

  async function load() {
    loading.value = true
    error.value = false
    try {
      const { data } = await apiClient.get<RequestItem[]>('/api/requests/received')
      receivedRequests.value = data
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  return { receivedRequests, loading, error, load }
}
