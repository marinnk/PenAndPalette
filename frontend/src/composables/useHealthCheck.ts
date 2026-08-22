import { ref } from 'vue'
import { apiClient } from '@/lib/apiClient'

// backendとの疎通確認用。API通信のロジックをコンポーネントから分離するcomposableの土台。
// 実際の機能（ログイン等）のcomposableもこの形（状態 + 非同期処理を返す）に揃える
export function useHealthCheck() {
  const status = ref<'idle' | 'ok' | 'error'>('idle')

  async function checkHealth() {
    try {
      await apiClient.get('/api/health')
      status.value = 'ok'
    } catch {
      status.value = 'error'
    }
  }

  return { status, checkHealth }
}
