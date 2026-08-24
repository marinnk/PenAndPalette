import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useReceivedRequests } from './useReceivedRequests'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('useReceivedRequests', () => {
  it('load: 届いたリクエスト一覧を取得する', async () => {
    const items = [
      {
        id: 1,
        from_user: { id: 2, username: 'jiro', display_name: '次郎', avatar_url: null },
        related_post: null,
        message: '続きを書いてほしいです',
        created_at: '2026-08-24T00:00:00Z',
      },
    ]
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: items })

    const { load, receivedRequests, error } = useReceivedRequests()
    await load()

    expect(apiClient.get).toHaveBeenCalledWith('/api/requests/received')
    expect(receivedRequests.value).toEqual(items)
    expect(error.value).toBe(false)
  })

  it('load: 失敗時はerrorがtrueになる', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('failed'))

    const { load, error, receivedRequests } = useReceivedRequests()
    await load()

    expect(error.value).toBe(true)
    expect(receivedRequests.value).toEqual([])
  })
})
