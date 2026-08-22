import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import { createPinia } from 'pinia'
import HomeView from './HomeView.vue'
import { apiClient } from '@/lib/apiClient'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

// HomeViewはuseAuthStore()を使うため、アクティブなPiniaインスタンスが無いと生成に失敗する
function renderHomeView() {
  return render(HomeView, { global: { plugins: [createPinia()] } })
}

describe('HomeView', () => {
  it('backendのヘルスチェックが成功したらokと表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { status: 'ok' } })

    renderHomeView()

    await waitFor(() => {
      expect(screen.getByTestId('backend-status')).toHaveTextContent('backend: ok')
    })
  })

  it('backendのヘルスチェックが失敗したらerrorと表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network error'))

    renderHomeView()

    await waitFor(() => {
      expect(screen.getByTestId('backend-status')).toHaveTextContent('backend: error')
    })
  })
})
