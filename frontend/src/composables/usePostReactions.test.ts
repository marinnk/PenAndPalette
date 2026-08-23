import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { setLiked, setWanted } from './usePostReactions'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(apiClient.post).mockReset()
  vi.mocked(apiClient.delete).mockReset()
})

describe('usePostReactions', () => {
  it('setLiked(true): POST /api/posts/{id}/likes を呼ぶ', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { like_count: 1, liked_by_me: true } })

    const result = await setLiked(1, true)

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts/1/likes')
    expect(result).toEqual({ like_count: 1, liked_by_me: true })
  })

  it('setLiked(false): DELETE /api/posts/{id}/likes を呼ぶ', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { like_count: 0, liked_by_me: false },
    })

    const result = await setLiked(1, false)

    expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/1/likes')
    expect(result).toEqual({ like_count: 0, liked_by_me: false })
  })

  it('setWanted(true): POST /api/posts/{id}/wants を呼ぶ', async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: { want_count: 1, wanted_by_me: true },
    })

    const result = await setWanted(2, true)

    expect(apiClient.post).toHaveBeenCalledWith('/api/posts/2/wants')
    expect(result).toEqual({ want_count: 1, wanted_by_me: true })
  })

  it('setWanted(false): DELETE /api/posts/{id}/wants を呼ぶ', async () => {
    vi.mocked(apiClient.delete).mockResolvedValueOnce({
      data: { want_count: 0, wanted_by_me: false },
    })

    const result = await setWanted(2, false)

    expect(apiClient.delete).toHaveBeenCalledWith('/api/posts/2/wants')
    expect(result).toEqual({ want_count: 0, wanted_by_me: false })
  })
})
