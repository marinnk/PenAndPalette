import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/vue'
import HomeView from './HomeView.vue'
import { apiClient } from '@/lib/apiClient'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

describe('HomeView', () => {
  it('backendのヘルスチェックが成功したらokと表示する', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: { status: 'ok' } })

    render(HomeView)

    await waitFor(() => {
      expect(screen.getByTestId('backend-status')).toHaveTextContent('backend: ok')
    })
  })

  it('backendのヘルスチェックが失敗したらerrorと表示する', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('network error'))

    render(HomeView)

    await waitFor(() => {
      expect(screen.getByTestId('backend-status')).toHaveTextContent('backend: error')
    })
  })
})
