import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '@/lib/apiClient'
import { useTags } from './useTags'

vi.mock('@/lib/apiClient', () => ({
  apiClient: { get: vi.fn() },
}))

beforeEach(() => {
  vi.mocked(apiClient.get).mockReset()
})

describe('useTags', () => {
  it('load: GET /api/tagsから固定タグ一覧を取得する（resultsでラップされない配列レスポンス）', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      data: [
        { id: 1, name: 'オリジナル' },
        { id: 2, name: '二次創作' },
      ],
    })

    const { load, tags, loading, error } = useTags()
    await load()

    expect(apiClient.get).toHaveBeenCalledWith('/api/tags')
    expect(tags.value.map((t) => t.name)).toEqual(['オリジナル', '二次創作'])
    expect(loading.value).toBe(false)
    expect(error.value).toBe(false)
  })

  it('load: 失敗時はerrorがtrueになり、tagsは空のまま', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('failed'))

    const { load, tags, error } = useTags()
    await load()

    expect(error.value).toBe(true)
    expect(tags.value).toEqual([])
  })
})
